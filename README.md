# SaralSaathi

**Explain any notice simply.** SaralSaathi turns complex digital content — PDFs, photos, scanned notices, pasted text, links, audio and video — into the format each person can actually use: simplified text, speech-friendly text, image descriptions, transcripts and key dates.

Built for hackathon problem statement **PS 29: Inclusive Digital Assistant for Differently Abled Citizens**.

It is an accessible layer around a GenAI model (Gemini), not a chatbot:

- **No prompting needed** — choose a file, take a photo, paste, speak or paste a link.
- **Built for screen readers and keyboards** first (WCAG 2.2 AA).
- **Fixed answer structure**: what it is, what to do, dates, money, warnings, scam check, key points.
- **Every key point links to its source sentence**, and we say when a point could not be found in the original.
- **Fraud and verify warnings** on every result, plus "Check the original document before paying or signing."
- **Embeddable "Explain this notice" widget + REST API** for banks and government portals.

See also: [PLAN.md](PLAN.md) · [DECISIONS.md](DECISIONS.md) · [DEMO.md](DEMO.md)

## Who it serves

| Need | How SaralSaathi helps |
|---|---|
| Blind / low vision | Full screen-reader + keyboard use, file picker and camera with spoken framing hints, voice input, every state change announced, high-contrast theme, text up to 150% |
| Deaf / hard of hearing | Nothing depends on sound; audio/video become transcript + summary + dates as text |
| Finds reading hard (low literacy, cognitive disability, elderly) | Plain short language, large text, **Simpler / Shorter / More detail** buttons |
| Prefers listening | Read-aloud with adjustable speed |
| Language | English, हिन्दी, ಕನ್ನಡ, தமிழ் |
| Institutions | Embeddable widget + `POST /api/v1/explain` with API key |

Onboarding asks five **needs** questions (never a diagnosis) — can you see the screen, can you hear audio, how hard is reading long text, read aloud?, language — with one-tap presets. Answers are stored as a preferences JSON in the browser (and Supabase when signed in).

## Quick start

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
npm run dev                   # http://localhost:3000
```

Without `GEMINI_API_KEY` the app runs in **demo mode**: pasted text and the sample documents still work through a simple rule-based explainer, clearly labelled. Photos, audio and video need the key.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for AI | Gemini free API key |
| `GEMINI_MODEL` | no | Primary model (default `gemini-3.5-flash`) |
| `GEMINI_FALLBACK_MODEL` | no | Used on errors / free-tier rate limits (default `gemini-3.5-flash-lite`) |
| `BHASHINI_USER_ID`, `BHASHINI_API_KEY`, `BHASHINI_PIPELINE_ID` | no | Indian-language TTS/ASR; falls back to browser speech |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Browser client (preference sync) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | no | Server: institution API keys |
| `DEMO_API_KEYS` | no | Comma-separated institution keys accepted when Supabase is not set up (default `demo-institution-key`) |

Supabase schema: `supabase/migrations/0001_init.sql` (tables `preferences`, `institutions`, `api_keys` with row-level security). Create an institution key with `node scripts/create-api-key.mjs "Bank name"` — only its sha256 hash is stored.

## Architecture

```
Client layer      citizen web app (PWA) · institution widget · browser speech APIs · (WhatsApp bot later)
      │
Next.js frontend  WCAG 2.2 AA · onboarding · result cards · live controls
      │
Backend API       POST /api/explain (web) · POST /api/v1/explain (institutions, API key, CORS)
  1. Input handler        lib/input          type + size + magic-byte checks; PDF text (unpdf); link fetch with SSRF guard
  2. Needs → prompt       lib/ai/prompt.ts   preferences + mode → model instructions
  3. GenAI orchestration  lib/ai/provider.ts Gemini primary → Gemini fallback model → demo mode; Bhashini for speech
  4. Result checker       lib/ai/check.ts    zod schema · source-sentence verification · rule-based fraud signals
  5. Response formatter   ExplainResponse + "check the original" notice
      │
Data layer        Supabase: preferences + hashed API keys only · documents processed in memory, never stored
```

## Privacy and safety

- Uploaded documents are processed in memory and never stored or logged.
- Only preferences and **hashed** API keys are stored.
- File type and size are validated (including magic bytes); APIs are rate-limited; link fetching blocks private, loopback, link-local and cloud-metadata addresses on every redirect.
- Every result carries "Check the original document before paying or signing." We never claim the output is always correct.
- Uploads are limited to 4 MB on Vercel (platform request-body limit).
- **Free-tier note:** the Gemini free tier may use prompts to improve Google products. Use a paid tier before handling real citizens' documents in production.

## Testing

```bash
npm run lint
npm run build
npm run selftest                 # result checker + speech text unit checks
npx playwright install chromium
npm run test:e2e                 # main keyboard flow, API, SSRF, axe on every page and theme
npm run lhci                     # Lighthouse accessibility ≥ 0.95 (after npm run build)
```

## Accessibility checklist

Automated: axe (`tests/a11y.spec.ts`, WCAG 2.0/2.1/2.2 A+AA, light/dark/high-contrast), Lighthouse CI accessibility ≥ 95.

Manual (run before each release):

**Keyboard only**
- [ ] Skip link is the first Tab stop and jumps to main content
- [ ] Every control reachable with Tab, in a logical order; visible focus ring everywhere
- [ ] Onboarding, every input route, live buttons and settings work with Enter / Space / arrows
- [ ] After processing, focus moves to the result heading; on error, to the error message
- [ ] Widget dialog keeps focus inside, Esc closes, focus returns to the trigger

**NVDA (Windows, Firefox/Chrome)**
- [ ] Landmarks (banner, navigation, main, contentinfo) and one h1 per page announced
- [ ] "File chosen", "Processing your document…", "Done. Your result is ready." and errors are announced
- [ ] Onboarding radio groups read as "question, radio button, 1 of 3"
- [ ] Key point "Show source" announces expanded/collapsed
- [ ] Scam risk is read as words, not only colour

**TalkBack (Android, Chrome)**
- [ ] Choose file opens the native picker and announces the file name
- [ ] Take photo: spoken framing hints match the on-screen text
- [ ] Swipe order follows the visual order on the result screen
- [ ] All targets are at least 44×44 px

**Vision / reading**
- [ ] Text at 200% browser zoom — no clipping, no horizontal scrolling at 320 px width
- [ ] High-contrast theme: all text and focus rings visible
- [ ] `prefers-reduced-motion` stops animations
- [ ] Error messages say what happened and how to fix it

**Hearing**
- [ ] Nothing requires sound; audio/video produce a text transcript
- [ ] Read-aloud never autoplays when "Can you hear audio?" = No
