import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | null | undefined;
let browser: SupabaseClient | null | undefined;

/** Server only — uses the service role key. null when Supabase is not configured. */
export function getServiceClient(): SupabaseClient | null {
  if (typeof window !== "undefined") throw new Error("getServiceClient is server-only");
  if (service !== undefined) return service;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  service = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return service;
}

/** Browser client with the public anon key. null when not configured. */
export function getBrowserClient(): SupabaseClient | null {
  if (browser !== undefined) return browser;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browser = url && key ? createClient(url, key) : null;
  return browser;
}
