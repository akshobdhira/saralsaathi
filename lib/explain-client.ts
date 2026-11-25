import type { ExplainInput, ExplainResponse, Mode } from "@/lib/schema";
import type { Prefs } from "@/lib/prefs";
import { t } from "@/lib/i18n";

/** Calls POST /api/explain. Never throws except on abort (AbortError). */
export async function explain(
  input: ExplainInput,
  prefs: Prefs,
  mode: Mode,
  signal?: AbortSignal,
): Promise<ExplainResponse> {
  const body = new FormData();
  body.set("kind", input.kind);
  if (input.kind === "text") body.set("text", input.text);
  else if (input.kind === "link") body.set("url", input.url);
  else body.set("file", input.file);
  body.set("prefs", JSON.stringify(prefs));
  body.set("mode", mode);

  let res: Response;
  try {
    res = await fetch("/api/explain", { method: "POST", body, signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ok: false, error: { code: "NETWORK", message: t(prefs.language, "net_error") } };
  }
  try {
    return (await res.json()) as ExplainResponse;
  } catch (e) {
    if (signal?.aborted) throw e;
    if (res.status === 413) {
      return { ok: false, error: { code: "TOO_BIG", message: t(prefs.language, "too_big") } };
    }
    return {
      ok: false,
      error: { code: `HTTP_${res.status}`, message: t(prefs.language, "net_error") },
    };
  }
}
