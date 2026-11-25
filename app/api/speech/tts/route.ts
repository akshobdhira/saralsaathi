import { bhashiniConfigured, BhashiniUnavailable, tts } from "@/lib/speech/bhashini";
import { rateLimit, API_LIMIT } from "@/lib/ratelimit";


const LANGS = ["en", "hi", "kn", "ta"] as const;
const H = { "Cache-Control": "no-store" };
const err = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: H });

export async function POST(req: Request) {
  if (!bhashiniConfigured()) return err(503, "NOT_CONFIGURED", "Bhashini speech is not configured.");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`tts:${ip}`, API_LIMIT).ok) return err(429, "RATE_LIMITED", "Too many requests. Please wait a moment.");

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const lang = body?.lang;
  if (!text || text.length > 3000) return err(400, "BAD_TEXT", "Text must be 1 to 3000 characters.");
  if (!LANGS.includes(lang)) return err(400, "BAD_LANG", "Unsupported language.");

  try {
    return Response.json({ audio: await tts(text, lang), mime: "audio/wav" }, { headers: H });
  } catch (e) {
    if (e instanceof BhashiniUnavailable) return err(503, "NOT_CONFIGURED", "Bhashini speech is not configured.");
    return err(502, "UPSTREAM", "The speech service did not respond. Please try again.");
  }
}
