// ponytail: per-instance memory, move to a shared store (Upstash/Redis) for global limits.
const hits = new Map<string, number[]>();

/** Sliding window. Returns ok=false with seconds until a slot frees up. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((arr[0] + windowMs - now) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= windowMs) hits.delete(k);
  }
  return { ok: true };
}

export const WEB_LIMIT = 20;
export const API_LIMIT = 60;
