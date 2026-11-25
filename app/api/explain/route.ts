import { AppError, parseExplainRequest } from "@/lib/input";
import { errorResponse, runExplain } from "@/lib/ai/pipeline";
import { rateLimit, WEB_LIMIT } from "@/lib/ratelimit";

// Node.js runtime is the default; `export const runtime` is rejected when cacheComponents is on.
export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const rl = rateLimit(`web:${ip}`, WEB_LIMIT);
  if (!rl.ok)
    return errorResponse(
      new AppError("RATE_LIMITED", `Too many requests. Please wait ${rl.retryAfter} seconds and try again.`, 429),
      { "Retry-After": String(rl.retryAfter) },
    );
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError("BAD_REQUEST", "We could not read what you sent. Please try again.");
    }
    const parsed = await parseExplainRequest(form);
    return Response.json(await runExplain(parsed), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
