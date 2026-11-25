import { hashApiKey, verifyApiKey } from "@/lib/apikeys";
import { AppError, parseV1Body } from "@/lib/input";
import { errorResponse, runExplain } from "@/lib/ai/pipeline";
import { API_LIMIT, rateLimit } from "@/lib/ratelimit";

// Node.js runtime is the default; `export const runtime` is rejected when cacheComponents is on.
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-api-key,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const raw =
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!raw) return errorResponse(new AppError("NO_API_KEY", "Missing API key. Send it in the x-api-key header.", 401), CORS);

  // Rate-limit before verifyApiKey so invalid-key floods cannot hit the database.
  const keyHash = hashApiKey(raw).slice(0, 32);
  const rl = rateLimit(`api:${keyHash}`, API_LIMIT);
  if (!rl.ok)
    return errorResponse(
      new AppError("RATE_LIMITED", `Rate limit is ${API_LIMIT} requests per minute. Retry in ${rl.retryAfter} seconds.`, 429),
      { ...CORS, "Retry-After": String(rl.retryAfter) },
    );

  const auth = await verifyApiKey(raw);
  if (!auth.ok) return errorResponse(new AppError("BAD_API_KEY", "This API key is not valid.", 401), CORS);
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("BAD_REQUEST", "The request body must be JSON.");
    }
    const parsed = await parseV1Body(body);
    return Response.json(await runExplain(parsed), { headers: { ...CORS, "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e, CORS);
  }
}
