import { z } from "zod";

/** Needs-based preferences. Never a diagnosis — only what the user wants. */
export const PrefsSchema = z.object({
  canSee: z.enum(["yes", "partly", "no"]),
  canHear: z.enum(["yes", "partly", "no"]),
  reading: z.enum(["easy", "some", "hard"]),
  readAloud: z.boolean(),
  language: z.enum(["en", "hi", "kn", "ta"]),
  theme: z.enum(["system", "light", "dark", "contrast"]),
  textSize: z.enum(["normal", "large", "xlarge"]),
  /** Read-aloud rate, 0.5–1.5. */
  speechRate: z.number().min(0.5).max(1.5),
});
export type Prefs = z.infer<typeof PrefsSchema>;
export type Lang = Prefs["language"];

export const DEFAULT_PREFS: Prefs = {
  canSee: "yes",
  canHear: "yes",
  reading: "easy",
  readAloud: false,
  language: "en",
  theme: "system",
  textSize: "normal",
  speechRate: 1,
};

/** One-tap presets for onboarding. */
export const PRESETS: Record<string, { label: string; prefs: Partial<Prefs> }> = {
  screenReader: { label: "I use a screen reader", prefs: { canSee: "no", readAloud: true, textSize: "normal" } },
  lowVision: { label: "I see a little", prefs: { canSee: "partly", textSize: "xlarge", theme: "contrast", readAloud: true } },
  deaf: { label: "I can't hear audio", prefs: { canHear: "no", readAloud: false } },
  easyRead: { label: "Keep it very simple", prefs: { reading: "hard", textSize: "large", readAloud: true } },
};

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  kn: "ಕನ್ನಡ (Kannada)",
  ta: "தமிழ் (Tamil)",
};

/** BCP-47 tags for Web Speech API. */
export const SPEECH_LANG: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
};

const KEY = "saralsaathi.prefs.v1";

export function loadPrefs(): Prefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = PrefsSchema.safeParse({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode — preferences just won't persist */
  }
  applyPrefsToDocument(p);
  window.dispatchEvent(new CustomEvent("saralsaathi:prefs", { detail: p }));
}

/** Apply theme + text size + lang to <html>. Safe to call on every change. */
export function applyPrefsToDocument(p: Prefs) {
  const html = document.documentElement;
  html.classList.remove("dark", "contrast");
  const theme =
    p.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : p.theme;
  if (theme !== "light") html.classList.add(theme);
  html.dataset.text = p.textSize;
  html.lang = p.language;
}
