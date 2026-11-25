# SaralSaathi — Build Plan (PS 29)

## Skills used
| Task | Skill |
|---|---|
| shadcn init, theme, components | `vercel:shadcn` (non-interactive `init -d`, Tailwind v4 font gotcha) |
| Onboarding, result UI, focus, live regions | `ecc:frontend-a11y`, `ecc:accessibility` (WCAG 2.2 AA: 24px+ targets, focus appearance, live regions) |
| Next.js App Router, route handlers | `vercel:nextjs` |
| Playwright + axe tests | `ecc:e2e-testing` |
| Link fetch SSRF, API-key hashing, rate limit | `ecc:security-review` |
| Deploy | `vercel:deployments-cicd`, `vercel:vercel-cli` |
| Review pass | separate reviewer subagent (`ecc:code-reviewer` / `ecc:a11y-architect`) |

No project-level `.claude/skills` existed; skills come from installed plugins.

## Order of work
1. **Setup** (sequential, me): Next.js + TS + Tailwind v4, shadcn init (radix), a11y theme, PWA manifest, folder structure, .env.example. Commit.
2. **Contracts** (sequential, me): `lib/schema.ts` (zod answer), `lib/prefs.ts` (preferences type), API route signatures. Commit. These unblock parallel work.
3. **Parallel subagents** (one owner per area, disjoint folders):
   - A. AI engine + API — `lib/ai/*`, `lib/input/*`, `app/api/explain`, `app/api/v1/explain`, fraud + source linking, rate limit, SSRF guard.
   - B. Frontend + a11y — `app/page.tsx`, `app/setup`, `app/app` (main+result), `app/settings`, `components/*` (not `components/ui`).
   - C. Speech + language — `lib/speech/*`, `app/api/speech/*` (Bhashini adapter), `components/speech/*`, i18n strings `lib/i18n.ts`.
   - D. Input, widget, tests — `components/input/*` (file, camera, paste, link), `public/widget.js`, `app/institutions`, `app/docs`, `supabase/migrations`, `lib/supabase.ts`, `lib/apikeys.ts`, `tests/*`, `public/samples/*`.
4. **Integrate** (me): wire B ↔ C ↔ D, fix build/lint.
5. **Test**: Playwright main flow + axe on every page; Lighthouse a11y ≥ 95.
6. **Review**: separate reviewer subagent (did not write code). Fix findings.
7. **Deploy**: Vercel (needs CLI login/token — see DECISIONS.md). README, DECISIONS, DEMO.

## Architecture
Client (web app, widget, browser speech) → Next.js UI (WCAG 2.2 AA) → API:
1. Input handler (`lib/input`) — type/size checks, PDF text extraction, image/audio/video passthrough as inline base64 to multimodal model, link fetch with SSRF guard.
2. Needs + prompt builder (`lib/ai/prompt.ts`) — prefs → instructions.
3. Orchestration (`lib/ai/provider.ts`) — Gemini free API only: primary model → fallback Gemini model (rate limit/error) → demo heuristic mode; Bhashini for Indian-language speech. No Claude (user decision).
4. Result checker (`lib/ai/check.ts`) — zod validate, verify each source_sentence exists in source text (fuzzy), rule-based fraud signals merged with model risk.
5. Formatter — response JSON + always-on "check the original" notice.
Data: Supabase `preferences`, `api_keys` (sha256 hash) with RLS. No document storage, no content logging.
