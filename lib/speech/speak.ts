import { SPEECH_LANG, type Lang } from "@/lib/prefs";

// One speaker for the whole app: starting a new read stops the previous one.
let gen = 0; // bumps on every speak/stop; stale loops check it and exit
let audio: HTMLAudioElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only on purpose
let utter: SpeechSynthesisUtterance | null = null; // held so Chrome doesn't GC it mid-speech
let release: (() => void) | null = null; // resolves whatever chunk is playing
let rateNow = 1;
let bhashiniOff = false; // remembered for this page session after a 503

const hasWindow = () => typeof window !== "undefined";

export function isSpeechSupported(): boolean {
  return hasWindow() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  if (!isSpeechSupported()) return undefined;
  const voices = speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const exact = SPEECH_LANG[lang].toLowerCase();
  return voices.find((v) => norm(v) === exact) ?? voices.find((v) => norm(v).startsWith(lang));
}

export function hasVoiceFor(lang: Lang): boolean {
  return Boolean(pickVoice(lang));
}

function voicesReady(): Promise<void> {
  if (speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const t = setTimeout(res, 1000);
    speechSynthesis.addEventListener("voiceschanged", () => (clearTimeout(t), res()), { once: true });
  });
}

/** Split by sentence, then pack sentences into chunks ≤ max chars (Chrome cuts long utterances). */
export function chunkText(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g) ?? [];
  const out: string[] = [];
  let cur = "";
  for (let s of sentences) {
    while (s.length > max) {
      // overlong sentence: cut at the last comma/space before max
      const cut = Math.max(s.lastIndexOf(",", max), s.lastIndexOf(" ", max));
      const at = cut > max / 3 ? cut + 1 : max;
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      out.push(s.slice(0, at).trim());
      s = s.slice(at);
    }
    if ((cur + s).length > max && cur.trim()) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function fetchTts(text: string, lang: Lang): Promise<string | null> {
  try {
    const res = await fetch("/api/speech/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 503) bhashiniOff = true;
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.audio === "string" ? data.audio : null;
  } catch {
    return null;
  }
}

function playAudio(b64: string): Promise<boolean> {
  return new Promise((res) => {
    const a = new Audio(`data:audio/wav;base64,${b64}`);
    a.playbackRate = rateNow;
    audio = a;
    release = () => res(true);
    a.onended = () => res(true);
    a.onerror = () => res(false);
    a.play().catch(() => res(false));
  }).then((ok) => {
    audio = null;
    release = null;
    return ok as boolean;
  });
}

async function sayBrowser(text: string, lang: Lang): Promise<void> {
  if (!isSpeechSupported()) return;
  await voicesReady();
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[lang];
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = rateNow;
    u.onend = u.onerror = () => res();
    utter = u;
    release = res;
    speechSynthesis.speak(u);
  });
}

export async function speak(text: string, opts: { lang: Lang; rate?: number; onEnd?: () => void; onError?: () => void }): Promise<void> {
  if (!hasWindow()) return;
  stopSpeaking();
  const my = ++gen;
  const alive = () => my === gen;
  rateNow = opts.rate ?? 1;

  // Bhashini gets bigger chunks (fewer round trips); browser speech gets ~200-char chunks.
  let queue = chunkText(text, 1000);
  if (opts.lang !== "en" && !bhashiniOff) {
    while (queue.length && alive()) {
      const b64 = await fetchTts(queue[0], opts.lang);
      if (!alive()) return;
      if (!b64 || !(await playAudio(b64))) break; // fall back to browser for the rest
      queue = queue.slice(1);
    }
  }
  for (const part of queue.flatMap((q) => chunkText(q, 200))) {
    if (!alive()) return;
    await sayBrowser(part, opts.lang);
  }
  if (alive()) {
    utter = null;
    opts.onEnd?.();
  } else {
    opts.onError?.();
  }
}

export function stopSpeaking(): void {
  if (!hasWindow()) return;
  gen++;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
  if (isSpeechSupported()) speechSynthesis.cancel();
  utter = null;
  release?.();
  release = null;
}

export function pauseSpeaking(): void {
  if (!hasWindow()) return;
  if (audio) audio.pause();
  else if (isSpeechSupported()) speechSynthesis.pause();
}

export function resumeSpeaking(): void {
  if (!hasWindow()) return;
  if (audio) audio.play().catch(() => {});
  else if (isSpeechSupported()) speechSynthesis.resume();
}

/** Change speed mid-read: applies now for Bhashini audio, from the next sentence for browser speech. */
export function setSpeakingRate(rate: number): void {
  rateNow = rate;
  if (audio) audio.playbackRate = rate;
}

