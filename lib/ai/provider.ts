import { GoogleGenAI, ApiError, type Part } from "@google/genai";
import { z } from "zod";
import { AnswerSchema, type Mode } from "@/lib/schema";
import type { Prefs } from "@/lib/prefs";
import { AppError, type Source } from "@/lib/input";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { demoAnswer } from "./demo";

export interface AIProvider {
  name: string;
  available(): boolean;
  generate(input: { system: string; user: string; source: Source; model: string; timeoutMs?: number }): Promise<unknown>;
}

function stripSchemaMeta(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripSchemaMeta);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = stripSchemaMeta(v);
    }
    return out;
  }
  return node;
}
const ANSWER_JSON_SCHEMA = stripSchemaMeta(z.toJSONSchema(AnswerSchema));

const PRIMARY_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 45_000;

let client: GoogleGenAI | null = null;

export const gemini: AIProvider = {
  name: "gemini",
  available: () => !!process.env.GEMINI_API_KEY,
  async generate({ system, user, source, model, timeoutMs = TOTAL_TIMEOUT_MS }) {
    client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parts: Part[] = [];
    if (source.media) parts.push({ inlineData: { mimeType: source.media.mimeType, data: source.media.base64 } });
    parts.push({ text: user });
    const res = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: ANSWER_JSON_SCHEMA,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
    const text = res.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    const json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!AnswerSchema.safeParse(json).success) throw new Error("SCHEMA_MISMATCH");
    return json;
  },
};

/** Stable public Gemini model names tried when the configured ones 404. */
const KNOWN_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite"];

/** Model name discovered at runtime when the configured names 404 (cached per instance). */
let discovered: string | null = null;

/**
 * Ask Gemini which models this key can use and pick the best "flash" model
 * that supports generateContent. Prefers non-lite, non-preview, highest version.
 */
async function discoverFlashModels(): Promise<string[]> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const names: string[] = [];
  for await (const m of await client.models.list()) {
    if (m.name && m.supportedActions?.includes("generateContent")) names.push(m.name.replace(/^models\//, ""));
  }
  const flash = names.filter((n) => /flash/.test(n) && !/(image|tts|audio|live|embedding|thinking)/.test(n));
  const score = (n: string) =>
    (/lite/.test(n) ? 0 : 1000) + (/(preview|exp)/.test(n) ? 0 : 500) + (parseFloat(n.match(/(\d+(\.\d+)?)/)?.[1] ?? "0") * 10);
  flash.sort((a, b) => score(b) - score(a));
  console.warn("[ai] configured Gemini model not found; available flash models:", flash.slice(0, 8));
  return flash.slice(0, 3);
}

const BUSY = "The AI service is busy right now. Please wait one minute and try again.";

export async function orchestrate(
  source: Source,
  prefs: Prefs,
  mode: Mode,
): Promise<{ answer: unknown; provider: "gemini" | "demo" }> {
  if (!gemini.available()) {
    if (!source.text)
      throw new AppError("NO_AI_KEY", "Photos, audio and video need the AI key. Please paste the text instead.", 400);
    return { answer: demoAnswer(source.text, prefs.language, mode), provider: "demo" };
  }
  const system = buildSystemPrompt(prefs, mode);
  const user = buildUserPrompt(source);
  const models = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
  ];
  if (discovered) models.unshift(discovered);
  const start = Date.now();
  let sawBusy = false;
  let sawNotFound = false;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const left = TOTAL_TIMEOUT_MS - (Date.now() - start);
    if (left < 3_000) break;
    try {
      const timeoutMs = i === 0 ? Math.min(PRIMARY_TIMEOUT_MS, left) : left;
      const answer = await gemini.generate({ system, user, source, model, timeoutMs });
      if (sawNotFound) discovered = model;
      return { answer, provider: "gemini" };
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined;
      if (status === 429 || status === 503) sawBusy = true;
      // Configured model name doesn't exist for this key: discover a real one once, then try it.
      if (status === 404 && !sawNotFound) {
        sawNotFound = true;
        const found = await discoverFlashModels().catch((err) => {
          console.warn("[ai] model discovery failed", err instanceof Error ? err.message.slice(0, 160) : "unknown");
          return [] as string[];
        });
        // Discovered names first (one may be overloaded), then known names as a last resort.
        for (const m of [...found, ...KNOWN_MODELS]) if (!models.includes(m)) models.push(m);
      }
      // Never log document content — only model, status and error name.
      console.warn("[ai] gemini failed", { model, status, err: e instanceof Error ? e.name + ":" + e.message.slice(0, 80) : "unknown" });
    }
  }
  if (sawBusy) throw new AppError("AI_BUSY", BUSY, 429);
  throw new AppError("AI_FAILED", "The AI could not explain this document right now. Please try again in a moment.", 502);
}
