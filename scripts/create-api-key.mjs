#!/usr/bin/env node
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-api-key.mjs "Institution name" [label]
// Prints the raw key ONCE. Only its sha256 hash is stored.
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [name, label = "default"] = process.argv.slice(2);
if (!name) {
  console.error('Usage: node scripts/create-api-key.mjs "Institution name" [label]');
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let { data: inst, error } = await db.from("institutions").select("id").eq("name", name).limit(1).maybeSingle();
if (error) throw error;
if (!inst) {
  ({ data: inst, error } = await db.from("institutions").insert({ name }).select("id").single());
  if (error) throw error;
}

const raw = "ss_live_" + randomBytes(32).toString("base64url");
const key_hash = createHash("sha256").update(raw, "utf8").digest("hex");
const { error: keyErr } = await db.from("api_keys").insert({ institution_id: inst.id, key_hash, label });
if (keyErr) throw keyErr;

console.log(`API key for "${name}" (shown once, store it safely):\n\n${raw}\n`);
