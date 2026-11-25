import { CHECK_ORIGINAL_NOTICE, type ExplainResponse } from "@/lib/schema";
import { AppError, type ParsedRequest } from "@/lib/input";
import { orchestrate } from "./provider";
import { checkAnswer } from "./check";

const SOURCE_TEXT_MAX = 20_000;

/** Shared by the web and v1 routes: orchestrate → check → ExplainResponse. */
export async function runExplain({ source, prefs, mode }: ParsedRequest): Promise<ExplainResponse> {
  const { answer, provider } = await orchestrate(source, prefs, mode);
  return {
    ok: true,
    result: checkAnswer(answer, source),
    source_text: source.text ? source.text.slice(0, SOURCE_TEXT_MAX) : null,
    provider,
    notice: CHECK_ORIGINAL_NOTICE,
  };
}

/** Turn any thrown error into a plain-language ExplainError + HTTP status. */
export function errorResponse(e: unknown, headers: HeadersInit = {}): Response {
  const err =
    e instanceof AppError
      ? e
      : new AppError("SERVER_ERROR", "Something went wrong on our side. Please try again in a moment.", 500);
  if (!(e instanceof AppError)) console.error("[explain] unexpected", e instanceof Error ? e.name + ":" + e.message.slice(0, 120) : "unknown");
  const body: ExplainResponse = { ok: false, error: { code: err.code, message: err.message } };
  return Response.json(body, { status: err.status, headers: { "Cache-Control": "no-store", ...headers } });
}
