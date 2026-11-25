// Server-only Bhashini (ULCA) adapter. Do not import from client components.
// Request/response shapes follow Bhashini's public ULCA docs; verify with real keys.
// Never log text or audio content.
import type { Lang } from "@/lib/prefs";

export class BhashiniUnavailable extends Error {
  constructor(message = "Bhashini is not configured") {
    super(message);
    this.name = "BhashiniUnavailable";
  }
}

type Task = "tts" | "asr" | "translation";
type Config = { url: string; headerName: string; headerValue: string; serviceId: string; at: number };

const CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const TTL = 30 * 60_000;
const TIMEOUT = 15_000;
const cache = new Map<string, Config>();

export function bhashiniConfigured(): boolean {
  return Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY && process.env.BHASHINI_PIPELINE_ID);
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bhashini request failed (${res.status})`);
  return res.json();
}

function language(src: Lang, tgt?: Lang) {
  return tgt ? { sourceLanguage: src, targetLanguage: tgt } : { sourceLanguage: src };
}

async function getConfig(task: Task, src: Lang, tgt?: Lang): Promise<Config> {
  if (!bhashiniConfigured()) throw new BhashiniUnavailable();
  const key = `${task}:${src}:${tgt ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit;

  const data = await post(
    CONFIG_URL,
    { userID: process.env.BHASHINI_USER_ID!, ulcaApiKey: process.env.BHASHINI_API_KEY! },
    {
      pipelineTasks: [{ taskType: task, config: { language: language(src, tgt) } }],
      pipelineRequestConfig: { pipelineId: process.env.BHASHINI_PIPELINE_ID },
    },
  );
  const ep = data?.pipelineInferenceAPIEndPoint;
  const serviceId = data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  if (!ep?.callbackUrl || !ep?.inferenceApiKey?.name || !serviceId) {
    throw new Error("Bhashini config response missing fields");
  }
  const cfg: Config = {
    url: ep.callbackUrl,
    headerName: ep.inferenceApiKey.name,
    headerValue: ep.inferenceApiKey.value,
    serviceId,
    at: Date.now(),
  };
  cache.set(key, cfg);
  return cfg;
}

async function infer(task: Task, src: Lang, extra: Record<string, unknown>, inputData: unknown, tgt?: Lang) {
  const cfg = await getConfig(task, src, tgt);
  const data = await post(
    cfg.url,
    { [cfg.headerName]: cfg.headerValue },
    {
      pipelineTasks: [{ taskType: task, config: { language: language(src, tgt), serviceId: cfg.serviceId, ...extra } }],
      inputData,
    },
  );
  return data?.pipelineResponse?.[0];
}

/** Returns base64 WAV. */
export async function tts(text: string, lang: Lang): Promise<string> {
  const out = await infer("tts", lang, { gender: "female" }, { input: [{ source: text }] });
  const audio = out?.audio?.[0]?.audioContent;
  if (!audio) throw new Error("Bhashini TTS returned no audio");
  return audio;
}

export async function asr(base64Audio: string, lang: Lang): Promise<string> {
  const out = await infer("asr", lang, { audioFormat: "wav", samplingRate: 16000 }, { audio: [{ audioContent: base64Audio }] });
  return out?.output?.[0]?.source ?? "";
}

export async function translate(text: string, from: Lang, to: Lang): Promise<string> {
  const out = await infer("translation", from, {}, { input: [{ source: text }] }, to);
  const target = out?.output?.[0]?.target;
  if (typeof target !== "string") throw new Error("Bhashini translation returned no text");
  return target;
}
