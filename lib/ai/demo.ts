import type { Answer, Mode } from "@/lib/schema";
import { fraudSignals, splitSentences } from "./verify";

// ponytail: regex heuristics only — used when GEMINI_API_KEY is unset so the app still demos end-to-end.

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर";
const DATE_RE = new RegExp(
  `\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS}),?\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}`,
  "gi",
);
const AMOUNT_RE = /(?:₹|Rs\.?|INR|रु\.?)\s?\d[\d,]*(?:\.\d+)?(?:\s?\/-)?/gi;

export function demoAnswer(text: string, language: string, mode: Mode = "default"): Answer {
  const sentences = splitSentences(text);
  const informative = sentences.filter((s) => s.split(/\s+/).length >= 4);
  const limit = mode === "shorter" ? 2 : mode === "more_detail" ? 6 : 4;
  const pick = (informative.length ? informative : sentences).slice(0, limit);
  const first = sentences[0] ?? text.slice(0, 200);

  const deadlines: Answer["deadlines"] = [];
  const amounts: Answer["amounts"] = [];
  for (const s of sentences) {
    for (const m of s.match(DATE_RE) ?? []) deadlines.push({ date: m, what: s });
    for (const m of s.match(AMOUNT_RE) ?? []) amounts.push({ value: m.trim(), what: s });
  }
  const signals = fraudSignals(text);
  const risk = signals.length >= 2 ? "high" : signals.length ? "medium" : "low";
  const warnings = [
    ...(signals.length ? ["This message shows signs of a scam: " + signals.join("; ") + ". Do not share OTP, PIN or passwords."] : []),
    ...(amounts.length ? ["Check the amount with the office before you pay anything."] : []),
  ];
  const points = pick.map((s) => ({ text: s, source_sentence: s }));
  const simpleParts = mode === "shorter" ? pick.slice(0, 2) : [first, ...pick.filter((s) => s !== first)];
  const simple =
    mode === "simpler"
      ? simpleParts.map((s) => s.trim()).join("\n")
      : simpleParts.join(" ");
  const modeTag =
    mode === "simpler" ? "Simpler view. " : mode === "shorter" ? "Short view. " : mode === "more_detail" ? "More detail. " : "";
  const speech = [
    `Demo mode. ${modeTag}The AI key is not set, so this is a simple summary.`,
    simple,
    deadlines.length ? `Important dates: ${deadlines.map((d) => d.date).join(", ")}.` : "",
    amounts.length ? `Amounts: ${amounts.map((a) => a.value.replace(/₹|Rs\.?|INR|रु\.?/gi, "").trim() + " rupees").join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const todo = [
    ...(deadlines.length ? [`Note the date: ${deadlines[0].date}.`] : []),
    "Read the original document carefully.",
    ...(mode === "shorter" ? [] : ["Contact the office that sent it if you are not sure."]),
    ...(mode === "more_detail" ? ["Keep a copy or photo of the original notice and any receipt."] : []),
  ];
  return {
    what_it_is: "(Demo mode — AI key not set) " + first,
    what_to_do: todo,
    deadlines,
    amounts,
    warnings,
    fraud_check: { risk, reason: signals.length ? "Simple checks found scam signs." : "No common scam signs found by simple checks." },
    key_points: points,
    simple_text: simple,
    speech_text: speech,
    language,
  };
}
