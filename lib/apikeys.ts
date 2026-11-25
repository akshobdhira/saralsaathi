// Server-only: imports node:crypto and the Supabase service client.
import { createHash, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export async function verifyApiKey(
  rawKey: string,
): Promise<{ ok: true; institution: string } | { ok: false }> {
  if (!rawKey || rawKey.length > 200) return { ok: false };
  const hash = hashApiKey(rawKey);
  const db = getServiceClient();

  if (!db) {
    // Demo mode: compare against hashes of DEMO_API_KEYS (constant-time).
    // Always include "demo-institution-key" so the docs/institutions pages work out of the box.
    const given = Buffer.from(hash, "hex");
    const match = (process.env.DEMO_API_KEYS || "demo-institution-key")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .some((k) => timingSafeEqual(Buffer.from(hashApiKey(k), "hex"), given));
    return match ? { ok: true, institution: "Demo institution" } : { ok: false };
  }

  const { data, error } = await db
    .from("api_keys")
    .select("id, institutions(name)")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return { ok: false };
  const inst = data.institutions as { name: string } | { name: string }[] | null;
  const name = Array.isArray(inst) ? inst[0]?.name : inst?.name;
  return { ok: true, institution: name ?? "Unknown institution" };
}
