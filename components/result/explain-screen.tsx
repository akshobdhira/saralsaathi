"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Copy, Info, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAnnounce } from "@/components/live-region";
import InputPanel from "@/components/input/input-panel";
import ReadAloud from "@/components/speech/read-aloud";
import ResultView from "@/components/result/result-view";
import { explain } from "@/lib/explain-client";
import { t, type I18nKey } from "@/lib/i18n";
import { stopSpeaking } from "@/lib/speech/speak";
import { usePrefs } from "@/lib/use-prefs";
import type { CheckedAnswer, ExplainInput, ExplainResponse, Mode } from "@/lib/schema";

const MODES: { mode: Mode; key: I18nKey }[] = [
  { mode: "simpler", key: "btn_simpler" },
  { mode: "shorter", key: "btn_shorter" },
  { mode: "more_detail", key: "btn_more" },
];

function plainText(r: CheckedAnswer, notice: string): string {
  return [
    r.what_it_is,
    ...r.what_to_do.map((x, i) => `${i + 1}. ${x}`),
    ...r.deadlines.map((d) => `${d.date}: ${d.what}`),
    ...r.amounts.map((a) => `${a.value}: ${a.what}`),
    ...r.warnings,
    r.simple_text,
    notice,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ExplainScreen() {
  const { prefs, setPrefs, ready, hasOnboarded } = usePrefs();
  const lang = prefs.language;
  const announce = useAnnounce();
  const [lastInput, setLastInput] = useState<ExplainInput | null>(null);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [res, setRes] = useState<{ data: ExplainResponse; n: number } | null>(null);
  const [panelKey, setPanelKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const focusRef = useRef<HTMLElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  // Move focus to the new result heading (or the error) once it renders.
  useEffect(() => {
    if (res) focusRef.current?.focus();
  }, [res]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(input: ExplainInput, mode: Mode) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    stopSpeaking();
    setLastInput(input);
    setBusy(mode);
    announce(t(lang, "processing"));
    try {
      const data = await explain(input, prefs, mode, ctrl.signal);
      setRes((r) => ({ data, n: (r?.n ?? 0) + 1 }));
      announce(data.ok ? t(lang, "done") : data.error.message, data.ok ? "polite" : "assertive");
    } catch {
      /* aborted by a newer request */
    } finally {
      if (abortRef.current === ctrl) setBusy(null);
    }
  }

  async function copy() {
    if (!res?.data.ok) return;
    try {
      await navigator.clipboard.writeText(plainText(res.data.result, res.data.notice));
      announce(t(lang, "copied"));
    } catch {
      announce(t(lang, "error_heading"), "assertive");
    }
  }

  function startAgain() {
    abortRef.current?.abort();
    stopSpeaking();
    setRes(null);
    setLastInput(null);
    setBusy(null);
    setPanelKey((k) => k + 1);
    h1Ref.current?.focus();
  }

  const data = res?.data;

  return (
    <div className="space-y-8">
      <h1 ref={h1Ref} tabIndex={-1} className="text-3xl font-bold">
        {t(lang, "app_title")}
      </h1>

      {ready && !hasOnboarded && (
        <Alert role="note" className="border-2">
          <Info aria-hidden="true" />
          <AlertDescription className="text-base text-foreground">
            <p>
              {t(lang, "not_onboarded")}{" "}
              <Link href="/setup" className="font-semibold underline">
                {t(lang, "go_setup")}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <InputPanel
        key={panelKey}
        onSubmit={(input) => run(input, "default")}
        busy={busy !== null}
        lang={lang}
        canSee={prefs.canSee}
      />

      {busy && (
        <div className="space-y-2">
          <p className="text-lg font-semibold">
            {t(lang, "processing")}
          </p>
          <Progress
            value={null}
            aria-label={t(lang, "processing")}
            className="h-3 motion-safe:animate-pulse *:transform-none!"
          />
        </div>
      )}

      {data && !data.ok && (
        <Alert
          variant="destructive"
          ref={focusRef as React.Ref<HTMLDivElement>}
          tabIndex={-1}
          className="border-2 border-destructive"
        >
          <AlertTitle className="text-lg font-bold">{t(lang, "error_heading")}</AlertTitle>
          <AlertDescription className="text-base text-destructive">{data.error.message}</AlertDescription>
        </Alert>
      )}

      {data?.ok && (
        <section aria-labelledby="result-heading" className="space-y-6">
          <h2
            id="result-heading"
            ref={focusRef as React.Ref<HTMLHeadingElement>}
            tabIndex={-1}
            className="text-3xl font-bold"
          >
            {t(lang, "result_heading")}
          </h2>

          <Alert role="note" className="border-2">
            <Info aria-hidden="true" />
            <AlertTitle className="text-base font-bold">{t(lang, "check_original")}</AlertTitle>
            {data.notice && (
              <AlertDescription className="text-base text-foreground">{data.notice}</AlertDescription>
            )}
          </Alert>

          {data.provider === "demo" && (
            <Badge variant="outline" className="h-auto border-2 px-3 py-1 text-base whitespace-normal">
              {t(lang, "demo_mode")}
            </Badge>
          )}

          <div
            role="group"
            aria-label={t(lang, "change_answer")}
            aria-busy={busy !== null}
            className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-border p-3"
          >
            {MODES.map(({ mode, key }) => (
              <Button
                key={mode}
                type="button"
                variant="secondary"
                disabled={busy !== null || !lastInput}
                onClick={() => lastInput && run(lastInput, mode)}
              >
                {t(lang, key)}
              </Button>
            ))}
            <ReadAloud
              key={res?.n}
              text={data.result.speech_text}
              lang={lang}
              rate={prefs.speechRate}
              onRateChange={(r) => {
                setPrefs({ speechRate: r });
                announce(t(lang, "speed_now", { rate: r.toFixed(1) }));
              }}
              autoPlay={prefs.readAloud && prefs.canHear !== "no"}
            />
            <Button type="button" variant="outline" onClick={copy}>
              <Copy aria-hidden="true" />
              {t(lang, "copy")}
            </Button>
            <Button type="button" variant="outline" onClick={startAgain}>
              <RotateCcw aria-hidden="true" />
              {t(lang, "start_again")}
            </Button>
          </div>

          <ResultView
            result={data.result}
            sourceText={data.source_text}
            lang={lang}
            reading={prefs.reading}
          />
        </section>
      )}
    </div>
  );
}
