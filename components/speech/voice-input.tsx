"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/live-region";
import { t, type I18nKey } from "@/lib/i18n";
import { SPEECH_LANG, type Lang } from "@/lib/prefs";

// Minimal Web Speech recognition types (not in TS's DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Mode = "recognition" | "record" | "none";
const getMode = (): Mode =>
  getRecognition()
    ? "recognition"
    : typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
      ? "record"
      : "none";
const noop = () => () => {};

const ERROR_KEYS: Record<string, I18nKey> = {
  "not-allowed": "voice_err_mic_blocked",
  "service-not-allowed": "voice_err_mic_blocked",
  "no-speech": "voice_err_no_speech",
  "audio-capture": "voice_err_no_mic",
  network: "voice_err_network",
  "language-not-supported": "voice_err_lang",
};
const MAX_RECORD_MS = 60_000; // keeps uploads well under the 4 MB server limit

export default function VoiceInput({
  lang,
  onResult,
  label,
}: {
  lang: Lang;
  onResult: (text: string) => void;
  label?: string;
}) {
  const errText = (code: string) => t(lang, ERROR_KEYS[code] ?? "voice_err_generic");
  const announce = useAnnounce();
  const mode = useSyncExternalStore(noop, getMode, () => "recognition" as Mode);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const rec = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No in-browser recognition: check whether the server fallback exists before offering it.
  useEffect(() => {
    if (mode !== "record") return;
    fetch("/api/speech/status")
      .then((r) => r.json())
      .then((d) => setServerOk(Boolean(d?.bhashini)))
      .catch(() => setServerOk(false));
  }, [mode]);

  // Clean up mic on unmount.
  useEffect(
    () => () => {
      rec.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fail = (msg: string) => {
    setError(msg);
    setListening(false);
    announce(msg, "assertive");
  };

  const startRecognition = () => {
    const Ctor = getRecognition()!;
    const r = new Ctor();
    r.lang = SPEECH_LANG[lang];
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") fail(errText(e.error));
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      const text = finalText.trim();
      if (text) {
        onResult(text);
        announce(t(lang, "voice_added"));
      }
    };
    rec.current = r;
    r.start();
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException)?.name;
      fail(errText(name === "NotFoundError" ? "audio-capture" : "not-allowed"));
      return;
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
      recorder.current = null;
      setListening(false);
      setBusy(true);
      setInterim(t(lang, "voice_converting"));
      try {
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: mr.mimeType || "audio/webm" }), "speech");
        fd.append("lang", lang);
        const res = await fetch("/api/speech/asr", { method: "POST", body: fd });
        if (res.status === 503) {
          setServerOk(false);
          return fail(t(lang, "voice_unavailable"));
        }
        const data = await res.json().catch(() => null);
        const text = typeof data?.text === "string" ? data.text.trim() : "";
        if (!res.ok) return fail(data?.error?.message ?? t(lang, "voice_err_generic"));
        if (!text) return fail(errText("no-speech"));
        setInterim(text);
        onResult(text);
        announce(t(lang, "voice_added"));
      } catch {
        fail(errText("network"));
      } finally {
        setBusy(false);
      }
    };
    recorder.current = mr;
    mr.start();
    timer.current = setTimeout(() => mr.state === "recording" && mr.stop(), MAX_RECORD_MS);
  };

  const start = () => {
    setError("");
    setInterim("");
    setListening(true);
    announce(t(lang, "listening_start"));
    if (mode === "recognition") {
      try {
        startRecognition();
      } catch {
        fail(t(lang, "voice_err_generic"));
      }
    } else void startRecording();
  };

  const stop = () => {
    rec.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
    setListening(false);
    announce(t(lang, "stopped_listening"));
  };

  if (mode === "none" || (mode === "record" && serverOk === false)) {
    return <p className="text-sm text-muted-foreground">{t(lang, "voice_unavailable")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        variant={listening ? "destructive" : "outline"}
        onClick={listening ? stop : start}
        disabled={busy || (mode === "record" && serverOk === null)}
        className="self-start"
      >
        {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        {listening ? t(lang, "stop_listening") : (label ?? t(lang, "start_speaking"))}
      </Button>
      <div aria-live="polite" className="min-h-6 rounded-md bg-muted/50 px-3 py-2 text-base empty:hidden">
        {interim || (listening ? t(lang, "listening_short") : "")}
      </div>
      {error && (
        <p className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
