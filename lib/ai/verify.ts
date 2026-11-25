// Pure helpers (no runtime imports) so scripts/check-selftest.ts can run them under plain node.
import type { Answer } from "@/lib/schema";

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<!\b(?:Rs|No|Mr|Mrs|Ms|Dr|Sr|Ref|St|Smt|Shri)\.)(?<=[.!?।])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lowercase, drop punctuation, collapse whitespace. Unicode-aware so Devanagari/Kannada/Tamil survive. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the claimed quote in the source. Returns the real source sentence (or the quote itself on
 * exact substring match), or null when it can't be found.
 */
export function matchSourceSentence(quote: string, sourceText: string, sentences = splitSentences(sourceText)): string | null {
  const q = normalize(quote);
  if (!q) return null;
  const exact = sentences.find((s) => normalize(s).includes(q) || (q.includes(normalize(s)) && normalize(s).length > 20));
  if (exact) return exact;
  if (normalize(sourceText).includes(q)) return quote.trim();
  const qTokens = q.split(" ");
  if (qTokens.length < 3) return null;
  let best: { s: string; score: number } | null = null;
  for (const s of sentences) {
    const set = new Set(normalize(s).split(" "));
    const score = qTokens.filter((t) => set.has(t)).length / qTokens.length;
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 0.8 ? best.s : null;
}

/**
 * Sentences that *warn* against sharing credentials are legitimate security notices, not scams.
 * This guard strips those protective sentences before we apply the fraud rules.
 */
function stripSafetyWarnings(text: string): string {
  // Remove lines that contain a "never / do not / don't share / ask for X" denial pattern
  // (English and Hindi). These are legitimate security warnings, not scam requests.
  return text
    .split(/\n+/)
    .filter((line) => {
      const l = line.toLowerCase();
      // "staff will never ask for your OTP / PIN / password"
      // "do not share your OTP"  "never share OTP"
      const engDenial =
        /\b(?:never|do not|don't|n't)\b.{0,50}\b(?:ask|share|give|send|provide|disclose)\b/i.test(l);
      // Hindi: "OTP माँगे तो न दें", "OTP या पासवर्ड न दें", "OTP माँगे उसे न दें"
      const hindiDenial =
        /(?:otp|पिन|पासवर्ड|ओटीपी).{0,30}(?:न दें|मत दें|नहीं देना)/i.test(l) ||
        /(?:न दें|मत दें|नहीं देना).{0,30}(?:otp|पिन|पासवर्ड|ओटीपी)/i.test(l);
      return !engDenial && !hindiDenial;
    })
    .join("\n");
}

const FRAUD_RULES: [RegExp, string][] = [
  [/\bOTP\b|one[- ]time password|ओटीपी/i, "asks for an OTP"],
  [/\b(?:ATM |UPI )?PIN\b|(?<!\p{L})पिन(?!\s*कोड|\p{L})/u, "asks for a PIN"],
  [/\bCVV\b/i, "asks for a card CVV"],
  [/\bpassword\b|पासवर्ड/i, "mentions a password"],
  [/click (?:on )?(?:the |this |below )?link|लिंक पर क्लिक/i, "asks you to click a link"],
  [/\bKYC\b/i, "mentions KYC (a common scam topic)"],
  [/\blotter(?:y|ies)\b|\bprize\b|\bjackpot\b|you (?:have )?won|लॉटरी|इनाम/i, "mentions a lottery or prize"],
  [/account (?:will be |has been |is )?(?:blocked|suspended|deactivated|closed)|खाता (?:बंद|ब्लॉक)/i, "threatens to block your account"],
  [/\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|shorturl\.at|tiny\.cc)\//i, "contains a short link that hides the real website"],
  [/\b[\w.-]{2,}@(?:ybl|okaxis|oksbi|okhdfcbank|okicici|paytm|upi|apl|ibl|axl)\b/i, "asks to pay to a personal UPI ID"],
];

export function fraudSignals(text: string): string[] {
  const stripped = stripSafetyWarnings(text);
  return FRAUD_RULES.filter(([re]) => re.test(stripped)).map(([, why]) => why);
}

const RANK = { low: 0, medium: 1, high: 2 } as const;

/** Rule-based fraud signals can only RAISE the model's risk, never lower it. Mutates and returns answer. */
export function applyFraudRules<T extends Pick<Answer, "fraud_check" | "warnings">>(answer: T, sourceText: string): T {
  const signals = fraudSignals(sourceText);
  if (signals.length) {
    const ruleRisk = signals.length >= 2 ? "high" : "medium";
    if (RANK[ruleRisk] > RANK[answer.fraud_check.risk]) answer.fraud_check.risk = ruleRisk;
    answer.fraud_check.reason = [answer.fraud_check.reason, "Safety check: " + signals.join("; ") + "."].filter(Boolean).join(" ");
  }
  if (answer.fraud_check.risk !== "low" && !answer.warnings.length)
    answer.warnings.push("This may be a scam. Never share OTP, PIN, CVV or passwords, and do not pay or click links until you check with the real office.");
  return answer;
}
