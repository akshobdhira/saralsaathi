"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/live-region";
import { t } from "@/lib/i18n";
import { speak } from "@/lib/speech/speak";
import type { Lang, Prefs } from "@/lib/prefs";
import { shrinkImage } from "./shrink-image";
import { analyseFrame, HINTS, toGray, type HintId } from "./framing";

const MAX_SIDE = 2000;

type Props = {
  lang: Lang;
  canSee: Prefs["canSee"];
  busy: boolean;
  onFile: (file: File) => void;
};

export function CameraCapture({ lang, canSee, busy, onFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "unavailable">("starting");
  const [hint, setHint] = useState<HintId | null>(null);
  const [speakHints, setSpeakHints] = useState(canSee !== "yes");
  const lastSpoken = useRef<{ id: HintId | null; at: number }>({ id: null, at: 0 });
  const announce = useAnnounce();
  const id = useId();

  // Start the camera on mount; stop every track on unmount (tab change unmounts this).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera API");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");
        announce(t(lang, "cam_on"));
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [announce, lang]);

  // Framing hints every ~1.5s.
  useEffect(() => {
    if (status !== "live") return;
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!ctx || !v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 80, 60);
      setHint(analyseFrame(toGray(ctx.getImageData(0, 0, 80, 60).data), 80, 60));
    }, 1500);
    return () => clearInterval(timer);
  }, [status]);

  // Speak only when the hint changes, at most every 3s.
  useEffect(() => {
    if (!hint || !speakHints) return;
    const now = Date.now();
    if (lastSpoken.current.id === hint || now - lastSpoken.current.at < 3000) return;
    lastSpoken.current = { id: hint, at: now };
    speak(HINTS[hint][lang], { lang }).catch(() => {});
  }, [hint, speakHints, lang]);

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return announce(t(lang, "cam_err_take"), "assertive");
    announce(t(lang, "cam_taken"));
    onFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  if (status === "unavailable") {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-semibold">
          {t(lang, "cam_unavailable")}
        </p>
        <label htmlFor={`${id}-fallback`} className="block font-semibold">
          {t(lang, "cam_fallback_label")}
        </label>
        <input
          id={`${id}-fallback`}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onFile(await shrinkImage(f));
          }}
          className="block min-h-11 w-full rounded-lg border-2 border-input p-2 file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-foreground"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        aria-label={t(lang, "cam_preview")}
        muted
        playsInline
        className="aspect-[4/3] w-full max-w-xl rounded-lg border-2 border-border bg-black object-cover"
      />
      <div
        id={`${id}-hint`}
        aria-live={speakHints ? "off" : "polite"}
        role={speakHints ? undefined : "status"}
        className="min-h-11 max-w-xl rounded-lg border-2 border-border p-3 text-lg font-semibold"
      >
        {status === "starting" ? t(lang, "cam_starting") : hint ? HINTS[hint][lang] : t(lang, "cam_point")}
      </div>
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          className="size-5"
          checked={speakHints}
          onChange={(e) => setSpeakHints(e.target.checked)}
        />
        {t(lang, "cam_speak_hints")}
      </label>
      <Button
        type="button"
        size="lg"
        onClick={capture}
        disabled={busy || status !== "live"}
        aria-busy={busy}
        aria-describedby={`${id}-hint`}
      >
        <Camera aria-hidden="true" />
        {busy ? t(lang, "btn_working") : t(lang, "cam_capture")}
      </Button>
    </div>
  );
}
