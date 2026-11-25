import { connection } from "next/server";
import { bhashiniConfigured } from "@/lib/speech/bhashini";

// Note: no `runtime` export — cacheComponents is on and forbids it (Node.js is the default).
export async function GET() {
  await connection(); // read env at request time, not at build
  return Response.json({ bhashini: bhashiniConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
