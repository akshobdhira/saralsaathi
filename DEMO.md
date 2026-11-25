# Demo script (≈ 6 minutes)

Open the deployed URL in Chrome. Have NVDA (Windows) or TalkBack (Android) ready for flow 1.

## 1. Blind user — screen reader + keyboard only (2.5 min)
1. Turn on NVDA. Close your eyes / turn the screen away from the audience if you like.
2. Press **Tab**: "Skip to main content". Tab again → **Start**, press **Enter**.
3. Setup: choose the preset **"I use a screen reader"** with Tab + Enter. NVDA announces the step; finish.
4. Main screen: Tab to **Try a sample document** → **"Bank KYC message"** → Enter.
5. NVDA announces "Processing your document…" then "Done. Your result is ready." Focus is on the result heading.
6. Press **H** to move by heading: *Is this a scam?* → "High risk" read as words, with the reason (asks for OTP, shortened link, 24-hour threat).
7. Tab to a key point → **Show source** → the exact sentence from the message is read.
8. Tab to **Read aloud → Play**, then **Read slower**.
Point out: no prompting, fixed structure, scam warning, "Check the original document before paying or signing."

## 2. Deaf user — everything as text (1.5 min)
1. **Settings** → "Can you hear audio?" = **No**, Language = **हिन्दी**, Text size = **Large**.
2. Main screen → **Choose file** → pick a short audio or video clip of an announcement (needs `GEMINI_API_KEY`).
   No key? Use **Paste text** with the electricity notice instead and explain that audio/video go through the same pipeline.
3. Result shows **Transcript**, summary, **Important dates** and **Money** as text in Hindi; nothing autoplays.
4. Press **Simpler**, then **Shorter** — the same document is re-explained, nothing is stored.

## 3. Institution widget (1.5 min)
1. Open **For institutions**. Show the sample bank notice with the injected **"Explain this notice"** button (demo key).
2. Activate it with the keyboard: an accessible dialog opens, focus moves inside, the explanation appears, **Esc** returns focus to the button.
3. Open **API docs** and run the curl example in a terminal:
   ```bash
   curl -X POST https://<deployment>/api/v1/explain \
     -H "Content-Type: application/json" -H "x-api-key: demo-institution-key" \
     -d '{"text":"Your electricity bill of Rs 2,450 is overdue. Pay by 15/12/2026 to avoid disconnection.","language":"hi","reading":"hard"}'
   ```
4. Mention: keys are stored hashed, documents are never stored, rate-limited, CORS-enabled, one script tag to embed.

## Backup lines for judges
- "Why not just ChatGPT?" → no prompting, screen-reader-first UI, fixed answer shape, source-linked points, fraud checks, embeddable for institutions.
- "What if the AI is wrong?" → every point links to its source sentence, unverified points are flagged, and every result says to check the original before paying or signing.
