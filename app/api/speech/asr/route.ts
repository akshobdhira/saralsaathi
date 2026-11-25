import { asr, bhashiniConfigured, BhashiniUnavailable } from "@/lib/speech/bhashini";
import { rateLimit, API_LIMIT } from "@/lib/ratelimit";


const LANGS = ["en", "hi", "kn", "ta"] as const;
const MAX = 4 * 1024 * 1024;
const H = { "Cache-Control": "no-store" };
const err = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: H });

export async function POST(req: Request) {
  if (!bhashiniConfigured()) return err(503, "NOT_CONFIGURED", "Voice typing service is not configured.");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`asr:${ip}`, API_LIMIT).ok) return err(429, "RATE_LIMITED", "Too many requests. Please wait a moment.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX + 64 * 1024) return err(413, "TOO_LARGE", "Recording is too long.");

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const lang = form?.get("lang");
  if (!(audio instanceof Blob) || audio.size === 0) return err(400, "NO_AUDIO", "No recording received.");
  if (audio.size > MAX) return err(413, "TOO_LARGE", "Recording is too long.");
  if (!LANGS.includes(lang as (typeof LANGS)[number])) return err(400, "BAD_LANG", "Unsupported language.");

  try {
    // ponytail: sends the browser's recording (often webm/opus) as-is; transcode to 16k WAV if Bhashini rejects it.
    const b64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    return Response.json({ text: await asr(b64, lang as (typeof LANGS)[number]) }, { headers: H });
  } catch (e) {
    if (e instanceof BhashiniUnavailable) return err(503, "NOT_CONFIGURED", "Voice typing service is not configured.");
    return err(502, "UPSTREAM", "The voice service did not respond. Please try again.");
  }
}
