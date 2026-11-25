"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnnounce } from "@/components/live-region";
import { ChoiceGroup, type Choice } from "@/components/onboarding/choice-group";
import { usePrefs } from "@/lib/use-prefs";
import { t, type I18nKey } from "@/lib/i18n";
import { LANG_NAMES, PRESETS, type Lang, type Prefs } from "@/lib/prefs";
import { isSpeechSupported, speak, stopSpeaking } from "@/lib/speech/speak";

type Question = {
  q: I18nKey;
  options: (lang: Lang) => Choice<string>[];
  get: (p: Prefs) => string;
  set: (v: string) => Partial<Prefs>;
};

const opts = (lang: Lang, pairs: [string, I18nKey][]) =>
  pairs.map(([value, key]) => ({ value, label: t(lang, key) }));
const ABILITY: [string, I18nKey][] = [
  ["yes", "opt_yes"],
  ["partly", "opt_partly"],
  ["no", "opt_no"],
];
const LANG_CHOICES: Choice<string>[] = (Object.keys(LANG_NAMES) as Lang[]).map((l) => ({
  value: l,
  label: LANG_NAMES[l],
  lang: l,
}));

const QUESTIONS: Question[] = [
  {
    q: "q_canSee",
    options: (l) => opts(l, ABILITY),
    get: (p) => p.canSee,
    set: (v) => ({ canSee: v as Prefs["canSee"] }),
  },
  {
    q: "q_canHear",
    options: (l) => opts(l, ABILITY),
    get: (p) => p.canHear,
    set: (v) => ({ canHear: v as Prefs["canHear"] }),
  },
  {
    q: "q_reading",
    options: (l) =>
      opts(l, [
        ["easy", "opt_easy"],
        ["some", "opt_some"],
        ["hard", "opt_hard"],
      ]),
    get: (p) => p.reading,
    set: (v) => ({ reading: v as Prefs["reading"] }),
  },
  {
    q: "q_readAloud",
    options: (l) =>
      opts(l, [
        ["yes", "opt_read_yes"],
        ["no", "opt_read_no"],
      ]),
    get: (p) => (p.readAloud ? "yes" : "no"),
    set: (v) => ({ readAloud: v === "yes" }),
  },
  {
    q: "q_language",
    options: () => LANG_CHOICES,
    get: (p) => p.language,
    set: (v) => ({ language: v as Lang }),
  },
];

const noop = () => () => {};

export default function SetupFlow() {
  const { prefs, setPrefs } = usePrefs();
  const router = useRouter();
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Partial<Prefs>>({});
  const [step, setStep] = useState<"start" | number>("start");
  const [speakPref, setSpeakPref] = useState<boolean | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const canSpeak = useSyncExternalStore(noop, () => isSpeechSupported(), () => false);

  const d: Prefs = { ...prefs, ...draft };
  const lang = d.language; // choosing a language switches the UI immediately
  // Spoken prompts default off for screen-reader users (don't talk over the screen reader)
  // and for deaf/hard-of-hearing users who explicitly said they cannot hear audio.
  const speakOn = canSpeak && d.canHear !== "no" && (speakPref ?? d.canSee !== "no");
  const question = typeof step === "number" ? QUESTIONS[step] : null;
  const spoken = question
    ? [t(lang, question.q), ...question.options(lang).map((o) => o.label)].join(". ")
    : "";

  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!speakOn || !spoken) return;
    speak(spoken, { lang, rate: d.speechRate }).catch(() => {});
    return () => stopSpeaking();
  }, [speakOn, spoken, lang, d.speechRate]);

  function go(next: "start" | number) {
    moved.current = true;
    setStep(next);
    if (typeof next === "number") {
      announce(t(lang, "question_of", { n: next + 1, total: QUESTIONS.length }));
    }
  }

  function finish(p: Prefs) {
    stopSpeaking();
    setPrefs(p);
    announce(t(p.language, "setup_done"));
    router.push("/app");
  }

  const speakToggle = canSpeak && (
    <div className="flex min-h-11 items-center gap-3">
      <Switch id="speak-questions" checked={speakOn} onCheckedChange={setSpeakPref} />
      <Label htmlFor="speak-questions" className="cursor-pointer text-lg">
        {t(lang, "speak_questions")}
      </Label>
    </div>
  );

  return (
    <div lang={lang} className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t(lang, "setup_title")}</h1>
        <p className="text-lg">{t(lang, "setup_intro")}</p>
        {speakToggle}
      </div>

      {step === "start" ? (
        <>
          <ChoiceGroup
            legend={t(lang, "q_language")}
            name="start-language"
            value={lang}
            options={LANG_CHOICES}
            onChange={(v) => setDraft((x) => ({ ...x, language: v as Lang }))}
          />
          <section aria-labelledby="presets-heading" className="space-y-3">
            <h2 id="presets-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
              {t(lang, "presets_heading")}
            </h2>
            <p className="text-lg">{t(lang, "presets_hint")}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <li key={key}>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-auto min-h-14 w-full justify-start whitespace-normal py-3 text-left"
                    onClick={() => finish({ ...d, ...preset.prefs })}
                  >
                    {t(lang, `preset_${key}` as I18nKey)}
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => go(0)}>
              {t(lang, "answer_questions")}
              <ArrowRight aria-hidden="true" />
            </Button>
          </section>
        </>
      ) : (
        question && (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < QUESTIONS.length - 1) go(step + 1);
              else finish(d);
            }}
          >
            <p className="text-lg font-semibold">
              {t(lang, "question_of", { n: step + 1, total: QUESTIONS.length })}
            </p>
            <ChoiceGroup
              legend={
                <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
                  {t(lang, question.q)}
                </h2>
              }
              name={question.q}
              value={question.get(d)}
              options={question.options(lang)}
              onChange={(v) => setDraft((x) => ({ ...x, ...question.set(v) }))}
            />
            {canSpeak && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => speak(spoken, { lang, rate: d.speechRate }).catch(() => {})}
              >
                <Volume2 aria-hidden="true" />
                {t(lang, "hear_question")}
              </Button>
            )}
            <div className="flex flex-wrap justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => go(step === 0 ? "start" : step - 1)}
              >
                <ArrowLeft aria-hidden="true" />
                {t(lang, "back")}
              </Button>
              <Button type="submit" size="lg">
                {step < QUESTIONS.length - 1 ? t(lang, "next") : t(lang, "finish")}
                {step < QUESTIONS.length - 1 ? (
                  <ArrowRight aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
              </Button>
            </div>
          </form>
        )
      )}
    </div>
  );
}
