import { AnswerSchema, type CheckedAnswer } from "@/lib/schema";
import { AppError, type Source } from "@/lib/input";
import { applyFraudRules, matchSourceSentence, splitSentences } from "./verify";

/** Validate the model's answer, verify quotes against the source, and apply rule-based fraud checks. */
export function checkAnswer(raw: unknown, source: Source): CheckedAnswer {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError("AI_BAD_OUTPUT", "The AI gave an answer we could not read. Please try again.", 502);
  const a = parsed.data;
  const text = source.text;
  const sentences = text ? splitSentences(text) : [];
  const key_points = a.key_points.map((kp) => {
    const match = text ? matchSourceSentence(kp.source_sentence, text, sentences) : null;
    return match ? { ...kp, source_sentence: match, verified: true } : { ...kp, verified: false };
  });
  const checked: CheckedAnswer = { ...a, key_points, fraud_check: { ...a.fraud_check }, warnings: [...a.warnings] };
  // Media-only sources: model transcript/description is the only text we have; still scan it for scam signals.
  return applyFraudRules(checked, text ?? [a.transcript, a.image_description].filter(Boolean).join("\n"));
}
