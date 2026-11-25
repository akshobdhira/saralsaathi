# Decisions & assumptions

Recorded instead of stopping to ask (per brief).

## Scope & stack
- **GenAI is Gemini free API only** (team decision, overrides the brief's "Claude fallback"). Fallback chain: `GEMINI_MODEL` (default `gemini-3.5-flash`) → `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`, used on errors / free-tier 429s) → **demo mode**.
- **Demo mode**: with no `GEMINI_API_KEY`, text inputs still work through a deterministic heuristic (sentences → key points, regex dates/₹ amounts, keyword fraud check), clearly labelled "Demo mode". Photos/audio/video need the key and say so in plain words. Keeps the app usable for judges and makes Playwright tests deterministic.
- **Free-tier privacy caveat**: Google may use free-tier API prompts to improve its products. For production with real citizen documents, switch to a paid Gemini tier. Noted in README.
- Next.js **16** (latest create-next-app) — App Router, Turbopack, Tailwind v4, shadcn/ui CLI v4 (`radix-nova` style). shadcn uses the official `cn` package; kept.
- Font: **Atkinson Hyperlegible** (designed for low-vision readers). Indic scripts fall back to system Noto fonts (avoids shipping large font files).

## Accessibility
- Base font 18px; Large (21px) and Extra large (24px) via `html[data-text]`; all rem-based so browser zoom works too.
- Themes: light, dark, high contrast (black/white/yellow) + system; applied by an inline script before paint (no flash).
- One global focus style (3px outline + halo) overriding component styles.
- All buttons/inputs ≥ 44px tall (shadcn sizes raised).
- One app-wide pair of live regions (`polite` + `assertive`) via `useAnnounce()`.
- Onboarding questions are spoken by the app only when wanted; for screen-reader users spoken prompts default **off** (to avoid talking over the screen reader) with a "Hear this question" button. Visible and spoken text come from the same i18n string.

## Privacy & safety
- Documents processed in memory only; never written to disk/DB; logs contain only kind/size/error codes.
- Only preferences (signed-in users) and **sha256 hashes** of institution API keys are stored.
- Link fetching: http/https, ports 80/443, DNS resolved and private/loopback/link-local/CGNAT/metadata ranges blocked on every redirect hop.
- Rate limits are in-memory per serverless instance — fine for a demo; move to a shared store for production.
- "Check the original document before paying or signing" is attached to every API response and shown on every result.
- Document text is treated as data in the prompt (prompt-injection guard).

## Speech
- Browser Web Speech API for English and as the universal fallback; Bhashini (ULCA pipeline API) for Hindi/Kannada/Tamil TTS/ASR when `BHASHINI_*` keys exist. Bhashini request shapes follow the public ULCA docs and must be verified with real keys.

## Data / Supabase
- Supabase is optional. Without it: preferences live in localStorage; API keys are checked against `DEMO_API_KEYS` (hashed at runtime). Sign-in UI for syncing preferences is deferred (schema + RLS are ready).

## Process
- No git commits are made by the agent unless the team asks.
