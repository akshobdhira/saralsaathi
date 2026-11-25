"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, Square, Turtle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAnnounce } from "@/components/live-region";
import { fmtRate, t } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import {
  isSpeechSupported,
  pauseSpeaking,
  resumeSpeaking,
  setSpeakingRate,
  speak,
  stopSpeaking,
} from "@/lib/speech/speak";
import { toSpeechFriendly } from "@/lib/speech/speech-text";

type Status = "idle" | "playing" | "paused";
const noop = () => () => {};
const round = (r: number) => Math.round(Math.min(1.5, Math.max(0.5, r)) * 10) / 10;

export default function ReadAloud({
  text,
  lang,
  rate,
  onRateChange,
  autoPlay,
}: {
  text: string;
  lang: Lang;
  rate: number;
  onRateChange: (r: number) => void;
  autoPlay?: boolean;
}) {
  const announce = useAnnounce();
  const supported = useSyncExternalStore(noop, isSpeechSupported, () => true);
  const [status, setStatus] = useState<Status>("idle");
  const active = useRef(false); // does this instance own the (global) speaker?
  const autoStarted = useRef(false);
  const speedId = useId();

  // `say` is false for autoplay: announcing would overwrite the page's own
  // "result is ready" message before a screen reader can read it.
  const play = (say = true) => {
    active.current = true;
    setStatus("playing");
    if (say) announce(t(lang, "reading_aloud"));
    void speak(toSpeechFriendly(text, lang), {
      lang,
      rate,
      onEnd: () => {
        active.current = false;
        setStatus("idle");
        if (say) announce(t(lang, "finished_reading"));
      },
      onError: () => {
        active.current = false;
        setStatus("idle");
      },
    });
  };

  const stop = (say = true) => {
    if (active.current) stopSpeaking();
    active.current = false;
    setStatus("idle");
    if (say) announce(t(lang, "stopped"));
  };

  // Stop when the text changes or the component unmounts.
  useEffect(
    () => () => {
      if (active.current) stopSpeaking();
      active.current = false;
      setStatus("idle");
    },
    [text],
  );

  useEffect(() => {
    if (autoPlay && supported && !autoStarted.current && text) {
      autoStarted.current = true;
      play(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoplay once, on mount
  }, []);

  useEffect(() => {
    if (active.current) setSpeakingRate(rate);
  }, [rate]);

  if (!supported) {
    return (
      <section aria-label={t(lang, "read_aloud")}>
        <Alert>
          <AlertDescription>{t(lang, "read_unsupported")}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const toggle = () => {
    if (status === "idle") play();
    else if (status === "playing") {
      pauseSpeaking();
      setStatus("paused");
      announce(t(lang, "paused"));
    } else {
      resumeSpeaking();
      setStatus("playing");
      announce(t(lang, "reading_aloud"));
    }
  };

  const ToggleIcon = status === "playing" ? Pause : Play;
  const toggleLabel = status === "idle" ? t(lang, "play") : status === "playing" ? t(lang, "pause") : t(lang, "resume");

  return (
    <section aria-label={t(lang, "read_aloud")} className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap gap-2">
        {/* One button that changes label, so keyboard focus stays put. */}
        <Button type="button" size="lg" onClick={toggle} disabled={!text}>
          <ToggleIcon aria-hidden="true" />
          {toggleLabel}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => stop()}>
          <Square aria-hidden="true" />
          {t(lang, "stop")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => onRateChange(round(rate - 0.2))}
          disabled={rate <= 0.5}
        >
          <Turtle aria-hidden="true" />
          {t(lang, "btn_slower")}
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={speedId} className="text-sm font-medium">
          {t(lang, "speed_label", { rate: rate.toFixed(1) })}
        </label>
        <input
          id={speedId}
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={rate}
          aria-valuetext={t(lang, "speed_value", { rate: fmtRate(rate) })}
          onChange={(e) => onRateChange(round(Number(e.target.value)))}
          className="h-11 w-full max-w-xs accent-primary"
        />
      </div>
    </section>
  );
}
