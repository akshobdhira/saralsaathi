// Run: node --experimental-strip-types lib/speech/speech-text.selftest.ts
import assert from "node:assert/strict";
// @ts-expect-error -- node strip-types needs the .ts extension
import { toSpeechFriendly as f } from "./speech-text.ts";

assert.equal(f("Pay ₹1,200 now", "en"), "Pay 1,200 rupees now.");
assert.equal(f("Fee Rs. 1200", "en"), "Fee 1200 rupees.");
assert.equal(f("INR 1200/-", "en"), "1200 rupees.");
assert.equal(f("₹1,200", "hi"), "1,200 रुपये।");
assert.equal(f("₹1,200", "kn"), "1,200 ರೂಪಾಯಿ.");
assert.equal(f("₹1,200", "ta"), "1,200 ரூபாய்.");
assert.equal(f("Due 15/03/2026", "en"), "Due 15 March 2026.");
assert.equal(f("Due 15/03/2026", "hi"), "Due 15/03/2026।");
assert.equal(f("Bad 45/13/2026", "en"), "Bad 45/13/2026.");
assert.equal(f("- **Pay** the bill\n- Visit https://example.gov.in/x_y", "en"), "Pay the bill. Visit a web link.");
assert.equal(f("## Title\nSee [the site](https://a.b) now!", "en"), "Title. See the site now!");
assert.equal(f("देखें www.example.in", "hi"), "देखें एक वेब लिंक।");
assert.equal(f("Already done.", "en"), "Already done.");
console.log("speech-text selftest: ok");
