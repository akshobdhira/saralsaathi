"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/live-region";
import { usePrefs } from "@/lib/use-prefs";
import { START_WORDS, t } from "@/lib/i18n";
import { SPEECH_LANG } from "@/lib/prefs";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noop = () => () => {};

export default function Landing() {
  const { prefs, hasOnboarded } = usePrefs();
  const lang = prefs.language;
  const router = useRouter();
  const announce = useAnnounce();
  const canListen = useSyncExternalStore(noop, () => getRecognition() !== null, () => false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const target = hasOnboarded ? "/app" : "/setup";

  useEffect(() => () => recRef.current?.stop(), []);

  function listen() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = SPEECH_LANG[lang];
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    let heard = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results[0] ?? [], (a) => a.transcript.toLowerCase()).join(" ");
      if (START_WORDS[lang].some((w) => said.includes(w))) {
        heard = true;
        router.push(target);
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      setListening(false);
      if (!heard) announce(t(lang, "voice_failed"));
    };
    setListening(true);
    announce(t(lang, "listening"));
    try {
      rec.start();
    } catch {
      setListening(false);
      announce(t(lang, "voice_failed"));
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold leading-tight">{t(lang, "landing_title")}</h1>
        <p className="max-w-prose text-xl">{t(lang, "landing_purpose")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="min-h-14 px-8 text-xl">
            <Link href={target}>
              {t(lang, "start")}
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          {canListen && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-14 px-6 text-xl"
              aria-pressed={listening}
              onClick={listen}
            >
              <Mic aria-hidden="true" className="size-5" />
              {listening ? t(lang, "listening") : t(lang, "say_start")}
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="who-heading" className="space-y-3">
        <h2 id="who-heading" className="text-2xl font-bold">
          {t(lang, "who_heading")}
        </h2>
        <ul className="list-disc space-y-2 pl-6 text-lg">
          <li>{t(lang, "who_1")}</li>
          <li>{t(lang, "who_2")}</li>
          <li>{t(lang, "who_3")}</li>
          <li>{t(lang, "who_4")}</li>
        </ul>
      </section>

      <p>
        <Link href="/institutions" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold underline">
          <Building2 aria-hidden="true" className="size-5" />
          {t(lang, "for_institutions")}
        </Link>
      </p>
    </div>
  );
}
