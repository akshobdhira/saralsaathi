// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Run: node --experimental-strip-types scripts/check-selftest.ts
import assert from "node:assert/strict";
import { matchSourceSentence, fraudSignals, applyFraudRules, splitSentences } from "../lib/ai/verify.ts";

const src = "Dear customer, your electricity bill of Rs. 2,450 is due on 15 March 2026. Please pay at the nearest office. Late payment attracts a fine.";

// splitting keeps "Rs. 2,450" in one sentence
assert.equal(splitSentences(src).length, 3);
// exact (case/punctuation-insensitive) match → returns the real source sentence
assert.equal(matchSourceSentence("please PAY at the nearest office", src), "Please pay at the nearest office.");
// fuzzy: one word changed, ≥0.8 token overlap
assert.equal(
  matchSourceSentence("Your electricity bill of Rs 2,450 is due on 15 March 2026 dear customer", src),
  splitSentences(src)[0],
);
// invented quote → null
assert.equal(matchSourceSentence("Your gas connection will be cut tomorrow", src), null);
// Hindi
const hi = "आपका बिजली बिल ₹2,450 है। कृपया 15 मार्च 2026 तक जमा करें।";
assert.equal(matchSourceSentence("कृपया 15 मार्च 2026 तक जमा करें", hi), "कृपया 15 मार्च 2026 तक जमा करें।");

// fraud: rules only raise
const scam = "Your SBI account will be blocked today. Click the link bit.ly/abc and share OTP to update KYC.";
assert.ok(fraudSignals(scam).length >= 3);
const a = applyFraudRules({ fraud_check: { risk: "low", reason: "Looks fine" }, warnings: [] }, scam);
assert.equal(a.fraud_check.risk, "high");
assert.match(a.fraud_check.reason, /Safety check/);
assert.ok(a.warnings.length > 0);
const b = applyFraudRules({ fraud_check: { risk: "high", reason: "model says" }, warnings: ["x"] }, src);
assert.equal(b.fraud_check.risk, "high"); // never lowered
assert.equal(fraudSignals(src).length, 0);
assert.equal(fraudSignals("Pay to ramesh123@ybl now").length, 1);

console.log("check-selftest: all passed");
