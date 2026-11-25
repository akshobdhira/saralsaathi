import { z } from "zod";

/** The fixed answer structure every model call must return (PS 29 §6). */
export const AnswerSchema = z.object({
  what_it_is: z.string(),
  what_to_do: z.array(z.string()),
  deadlines: z.array(z.object({ date: z.string(), what: z.string() })),
  amounts: z.array(z.object({ value: z.string(), what: z.string() })),
  warnings: z.array(z.string()),
  fraud_check: z.object({
    risk: z.enum(["low", "medium", "high"]),
    reason: z.string(),
  }),
  key_points: z.array(
    z.object({ text: z.string(), source_sentence: z.string() }),
  ),
  simple_text: z.string(),
  speech_text: z.string(),
  language: z.string(),
  /** Images only. */
  image_description: z.string().nullish(),
  /** Audio / video only. */
  transcript: z.string().nullish(),
});
export type Answer = z.infer<typeof AnswerSchema>;

/** Key point after the result checker verified it against the source. */
export type CheckedKeyPoint = Answer["key_points"][number] & {
  /** true when source_sentence was found (fuzzy) in the extracted source text. */
  verified: boolean;
};

export type CheckedAnswer = Omit<Answer, "key_points"> & {
  key_points: CheckedKeyPoint[];
};

/** Live re-format controls on the result screen. */
export const ModeSchema = z.enum(["default", "simpler", "shorter", "more_detail"]);
export type Mode = z.infer<typeof ModeSchema>;

export type InputKind = "text" | "file" | "link";

export type ExplainSuccess = {
  ok: true;
  result: CheckedAnswer;
  /** Extracted source text (PDF/text/link) so the UI can show/link source sentences. null for pure image/audio/video. */
  source_text: string | null;
  provider: "gemini" | "demo";
  /** Always shown with every result. */
  notice: string;
};
export type ExplainError = {
  ok: false;
  error: { code: string; message: string };
};
export type ExplainResponse = ExplainSuccess | ExplainError;

export const CHECK_ORIGINAL_NOTICE =
  "Check the original document before paying or signing. SaralSaathi can make mistakes.";

/** What the main-screen input panel hands to the explain client. */
export type ExplainInput =
  | { kind: "text"; text: string; label?: string }
  | { kind: "file"; file: File }
  | { kind: "link"; url: string };

/** Limits shared by client checks and server validation. */
export const LIMITS = {
  maxFileBytes: 15 * 1024 * 1024,
  maxTextChars: 60_000,
  acceptedMime: [
    "application/pdf",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "video/mp4",
    "video/webm",
  ],
} as const;
