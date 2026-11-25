import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import { LIMITS, ModeSchema, type Mode } from "@/lib/schema";
import { DEFAULT_PREFS, PrefsSchema, type Prefs } from "@/lib/prefs";
import { safeFetch, SsrfError } from "@/lib/ssrf";

/** Normalized input handed to the AI layer. Everything stays in memory. */
export type Source = {
  text: string | null;
  media?: { mimeType: string; base64: string };
  kind: "text" | "pdf" | "image" | "audio" | "video" | "link";
};

/** Error with a plain-language message safe to show the user. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/*
 * Size note: we validate against LIMITS.maxFileBytes (15 MB), but on Vercel the platform
 * rejects request bodies over 4.5 MB before our code runs (HTTP 413). The UI should treat a
 * 413 as "file too big" — see TOO_BIG_MESSAGE.
 */
export const TOO_BIG_MESSAGE =
  "This file is too big. Please use a smaller file (under 4 MB works best) or paste the text instead.";

const MAX_LINK_BYTES = 2 * 1024 * 1024;
const MIN_PDF_TEXT = 80; // fewer chars than this → treat as scanned

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}
const SNIFFABLE = ["application/pdf", "image/png", "image/jpeg"];

function checkText(text: string): string {
  const t = text.trim();
  if (!t) throw new AppError("EMPTY", "There is no text to explain. Please type or paste some text.");
  if (t.length > LIMITS.maxTextChars)
    throw new AppError(
      "TOO_LONG",
      `This text is too long (more than ${LIMITS.maxTextChars.toLocaleString("en-IN")} characters). Please paste a shorter part.`,
      413,
    );
  return t;
}

/** Validate bytes + declared mime and turn them into a Source. */
export async function sourceFromBytes(bytes: Uint8Array, declared: string): Promise<Source> {
  if (!bytes.length) throw new AppError("EMPTY", "This file is empty. Please choose another file.");
  if (bytes.length > LIMITS.maxFileBytes) throw new AppError("TOO_BIG", TOO_BIG_MESSAGE, 413);
  let mime = (declared || "").split(";")[0].trim().toLowerCase();
  if (mime === "audio/mp3") mime = "audio/mpeg";
  if (mime === "audio/x-wav") mime = "audio/wav";
  const sniffed = sniff(bytes);
  if (SNIFFABLE.includes(mime) && sniffed !== mime) {
    // Renamed file (e.g. .exe called .pdf) or wrong extension between the three sniffable types.
    if (!sniffed)
      throw new AppError("BAD_FILE", "This file does not look like a real PDF or photo. Please choose another file.", 415);
    mime = sniffed;
  }
  if (!mime && sniffed) mime = sniffed;
  if (!(LIMITS.acceptedMime as readonly string[]).includes(mime))
    throw new AppError(
      "UNSUPPORTED",
      "We cannot open this type of file. Please use a PDF, photo (JPG/PNG), audio, video or plain text file.",
      415,
    );

  if (mime === "text/plain") return { kind: "text", text: checkText(new TextDecoder().decode(bytes)) };
  if (mime === "application/pdf") {
    let text = "";
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractText(pdf, { mergePages: true })).text.replace(/[ \t]+/g, " ").trim();
    } catch {
      console.warn("[input] pdf text extraction failed, sending as media", { size: bytes.length });
    }
    if (text.replace(/\s/g, "").length >= MIN_PDF_TEXT)
      return { kind: "pdf", text: text.slice(0, LIMITS.maxTextChars) };
    return { kind: "pdf", text: null, media: { mimeType: mime, base64: Buffer.from(bytes).toString("base64") } };
  }
  const kind = mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : "video";
  return { kind, text: null, media: { mimeType: mime, base64: Buffer.from(bytes).toString("base64") } };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-", rupee: "₹" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function sourceFromLink(url: string): Promise<Source> {
  let res: Response;
  try {
    res = await safeFetch(url.trim(), {
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "SaralSaathi/1.0 (document explainer)", accept: "text/html,text/plain,application/pdf,image/*" },
    });
  } catch (e) {
    if (e instanceof SsrfError) throw new AppError(e.code, e.message);
    throw new AppError("LINK_FAILED", "We could not open this link. Please check it, or copy the text and paste it instead.", 502);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new AppError("LINK_FAILED", `The website answered with an error (${res.status}). Please copy the text and paste it instead.`, 502);
  }
  // Read at most 2 MB.
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_LINK_BYTES) {
      await reader.cancel();
      throw new AppError("TOO_BIG", "This web page is too big to read. Please copy the important part and paste it instead.", 413);
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const sniffed = sniff(bytes);
  if (type === "application/pdf" || type.startsWith("image/") || sniffed) {
    return sourceFromBytes(bytes, sniffed || type);
  }
  const raw = new TextDecoder().decode(bytes);
  const text = type === "text/plain" ? raw : htmlToText(raw);
  if (text.length < 20)
    throw new AppError("LINK_EMPTY", "We could not find readable text on this page. Please copy the text and paste it instead.");
  return { kind: "link", text: text.slice(0, LIMITS.maxTextChars) };
}

export type ParsedRequest = { source: Source; prefs: Prefs; mode: Mode };

/** Web route: parse multipart form data (kind, text, url, file, prefs, mode). */
export async function parseExplainRequest(form: FormData): Promise<ParsedRequest> {
  let prefs = DEFAULT_PREFS;
  const rawPrefs = form.get("prefs");
  if (typeof rawPrefs === "string" && rawPrefs) {
    try {
      const p = PrefsSchema.safeParse({ ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) });
      if (p.success) prefs = p.data;
    } catch {
      /* bad prefs JSON → defaults */
    }
  }
  const m = ModeSchema.safeParse(form.get("mode") ?? "default");
  const mode = m.success ? m.data : "default";

  const kind = form.get("kind");
  let source: Source;
  if (kind === "text") {
    source = { kind: "text", text: checkText(String(form.get("text") ?? "")) };
  } else if (kind === "link") {
    const url = form.get("url");
    if (typeof url !== "string" || !url.trim()) throw new AppError("EMPTY", "Please paste a web link.");
    source = await sourceFromLink(url);
  } else if (kind === "file") {
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("EMPTY", "No file was received. Please choose a file again.");
    if (file.size > LIMITS.maxFileBytes) throw new AppError("TOO_BIG", TOO_BIG_MESSAGE, 413);
    source = await sourceFromBytes(new Uint8Array(await file.arrayBuffer()), file.type);
  } else {
    throw new AppError("BAD_REQUEST", "Please choose what to explain: text, a file, or a link.");
  }
  console.info("[input]", { kind: source.kind, chars: source.text?.length ?? 0, media: source.media?.mimeType ?? null });
  return { source, prefs, mode };
}

const AbilityInput = z.union([z.boolean(), z.enum(["yes", "partly", "no"])]).optional();
function toAbility(v: boolean | "yes" | "partly" | "no" | undefined): "yes" | "partly" | "no" {
  if (v === false || v === "no") return "no";
  if (v === "partly") return "partly";
  return "yes";
}

/** Institution API body (POST /api/v1/explain). */
export const V1BodySchema = z.object({
  text: z.string().optional(),
  url: z.string().optional(),
  file_base64: z.string().optional(),
  mime_type: z.string().optional(),
  language: z.enum(["en", "hi", "kn", "ta"]).optional(),
  reading: z.enum(["easy", "some", "hard"]).optional(),
  can_see: AbilityInput,
  can_hear: AbilityInput,
  mode: ModeSchema.optional(),
});

export async function parseV1Body(body: unknown): Promise<ParsedRequest> {
  const parsed = V1BodySchema.safeParse(body);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "The request body is not valid. Send JSON with one of: text, url, or file_base64 + mime_type.");
  const b = parsed.data;
  const prefs: Prefs = {
    ...DEFAULT_PREFS,
    language: b.language ?? "en",
    reading: b.reading ?? "easy",
    canSee: toAbility(b.can_see),
    canHear: toAbility(b.can_hear),
  };
  let source: Source;
  if (b.file_base64) {
    if (!b.mime_type) throw new AppError("BAD_REQUEST", "mime_type is required with file_base64.");
    if (b.file_base64.length > Math.ceil(LIMITS.maxFileBytes / 3) * 4 + 4)
      throw new AppError("TOO_BIG", TOO_BIG_MESSAGE, 413);
    source = await sourceFromBytes(new Uint8Array(Buffer.from(b.file_base64, "base64")), b.mime_type);
  } else if (b.url) {
    source = await sourceFromLink(b.url);
  } else if (b.text) {
    source = { kind: "text", text: checkText(b.text) };
  } else {
    throw new AppError("EMPTY", "Send one of: text, url, or file_base64 + mime_type.");
  }
  console.info("[input:v1]", { kind: source.kind, chars: source.text?.length ?? 0, media: source.media?.mimeType ?? null });
  return { source, prefs, mode: b.mode ?? "default" };
}
