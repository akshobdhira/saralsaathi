"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Search, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/live-region";
import { t, type I18nKey } from "@/lib/i18n";
import type { Lang, Prefs } from "@/lib/prefs";
import type { CheckedAnswer, CheckedKeyPoint } from "@/lib/schema";

/** Locate `sentence` in `source`, tolerant of whitespace/case differences. */
export function findSpan(source: string, sentence: string): [number, number] | null {
  const words = sentence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return null;
  for (const n of [words.length, 8, 5]) {
    if (n > words.length) continue;
    const m = new RegExp(words.slice(0, n).join("\\s+"), "i").exec(source);
    if (m) return [m.index, m.index + m[0].length];
  }
  return null;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-lg border-2 border-border p-4">
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const RISK = {
  low: { key: "risk_low", Icon: ShieldCheck },
  medium: { key: "risk_medium", Icon: ShieldQuestion },
  high: { key: "risk_high", Icon: ShieldAlert },
} as const satisfies Record<string, { key: I18nKey; Icon: unknown }>;

function KeyPoint({
  point,
  lang,
  contentLang,
  canFind,
  onFind,
}: {
  point: CheckedKeyPoint;
  lang: Lang;
  contentLang?: string;
  canFind: boolean;
  onFind: (sentence: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="space-y-2">
      <p lang={contentLang}>{point.text}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t(lang, "hide_source") : t(lang, "show_source")}
        </Button>
        {canFind && (
          <Button type="button" variant="outline" size="sm" onClick={() => onFind(point.source_sentence)}>
            <Search aria-hidden="true" />
            {t(lang, "find_in_original")}
          </Button>
        )}
      </div>
      <div id={id} hidden={!open} className="space-y-1">
        <p className="flex items-center gap-2 font-semibold">
          {point.verified ? (
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          )}
          {point.verified ? t(lang, "verified") : t(lang, "not_verified")}
        </p>
        <blockquote lang={contentLang} className="border-l-4 border-border pl-4 italic">
          {point.source_sentence}
        </blockquote>
      </div>
    </li>
  );
}

export default function ResultView({
  result,
  sourceText,
  lang,
  reading,
}: {
  result: CheckedAnswer;
  sourceText: string | null;
  lang: Lang;
  reading: Prefs["reading"];
}) {
  const announce = useAnnounce();
  const [hl, setHl] = useState<{ span: [number, number]; n: number } | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const contentLang = result.language && result.language !== lang ? result.language : undefined;

  useEffect(() => {
    if (!hl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    markRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    markRef.current?.focus({ preventScroll: true });
  }, [hl]);

  function find(sentence: string) {
    const span = sourceText ? findSpan(sourceText, sentence) : null;
    if (!span) {
      announce(t(lang, "not_found_in_text"));
      return;
    }
    if (detailsRef.current) detailsRef.current.open = true;
    setHl((h) => ({ span, n: (h?.n ?? 0) + 1 }));
  }

  const risk = RISK[result.fraud_check.risk];
  const p = (text: string) => <p lang={contentLang}>{text}</p>;
  const list = (items: ReactNode[], ordered = false) => {
    if (!items.length) return <p>{t(lang, "none_found")}</p>;
    const Tag = ordered ? "ol" : "ul";
    return (
      <Tag lang={contentLang} className={`${ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </Tag>
    );
  };

  const sections: Record<string, ReactNode> = {
    scam: (
      <Section id="r-scam" title={t(lang, "h_scam")}>
        {result.fraud_check.risk === "high" ? (
          <Alert variant="destructive" className="border-2 border-destructive">
            <risk.Icon aria-hidden="true" />
            <AlertTitle className="text-lg font-bold">{t(lang, risk.key)}</AlertTitle>
            <AlertDescription lang={contentLang} className="text-base text-destructive">
              {result.fraud_check.reason}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="flex items-center gap-2 text-lg font-bold">
              <risk.Icon aria-hidden="true" className="size-6 shrink-0" />
              {t(lang, risk.key)}
            </p>
            {p(result.fraud_check.reason)}
          </>
        )}
      </Section>
    ),
    what: (
      <Section id="r-what" title={t(lang, "h_what")}>
        {p(result.what_it_is)}
      </Section>
    ),
    todo: (
      <Section id="r-todo" title={t(lang, "h_todo")}>
        {list(result.what_to_do, true)}
      </Section>
    ),
    dates: (
      <Section id="r-dates" title={t(lang, "h_dates")}>
        {list(
          result.deadlines.map((d) => (
            <>
              <strong>{d.date}</strong> — {d.what}
            </>
          )),
        )}
      </Section>
    ),
    money: result.amounts.length > 0 && (
      <Section id="r-money" title={t(lang, "h_money")}>
        {list(
          result.amounts.map((a) => (
            <>
              <strong>{a.value}</strong> — {a.what}
            </>
          )),
        )}
      </Section>
    ),
    warnings: result.warnings.length > 0 && (
      <Section id="r-warnings" title={t(lang, "h_warnings")}>
        {list(result.warnings)}
      </Section>
    ),
    points: result.key_points.length > 0 && (
      <Section id="r-points" title={t(lang, "h_points")}>
        <ul className="space-y-4">
          {result.key_points.map((kp, i) => (
            <KeyPoint
              key={i}
              point={kp}
              lang={lang}
              contentLang={contentLang}
              canFind={!!sourceText}
              onFind={find}
            />
          ))}
        </ul>
      </Section>
    ),
    simple: result.simple_text && (
      <Section id="r-simple" title={t(lang, "h_simple")}>
        <p lang={contentLang} className="text-xl leading-relaxed whitespace-pre-line">
          {result.simple_text}
        </p>
      </Section>
    ),
    image: result.image_description && (
      <Section id="r-image" title={t(lang, "h_image")}>
        {p(result.image_description)}
      </Section>
    ),
    transcript: result.transcript && (
      <Section id="r-transcript" title={t(lang, "h_transcript")}>
        <p lang={contentLang} className="whitespace-pre-line">
          {result.transcript}
        </p>
      </Section>
    ),
  };

  // Hard reading: simple version first, then actions and dates.
  const order =
    reading === "hard"
      ? ["simple", "todo", "dates", "scam", "what", "money", "warnings", "points", "image", "transcript"]
      : ["scam", "what", "todo", "dates", "money", "warnings", "points", "simple", "image", "transcript"];

  return (
    <div className="space-y-6">
      {order.map((k) => sections[k] && <div key={k}>{sections[k]}</div>)}

      {sourceText && (
        <Section id="r-original" title={t(lang, "h_original")}>
          <details ref={detailsRef}>
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
              <Info aria-hidden="true" className="size-5" />
              {t(lang, "show_original")}
            </summary>
            <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md bg-muted p-4 whitespace-pre-wrap">
              {hl ? (
                <>
                  {sourceText.slice(0, hl.span[0])}
                  <mark
                    key={hl.n}
                    ref={markRef}
                    tabIndex={-1}
                    className="source-highlight rounded bg-accent px-0.5 text-accent-foreground"
                  >
                    {sourceText.slice(hl.span[0], hl.span[1])}
                  </mark>
                  {sourceText.slice(hl.span[1])}
                </>
              ) : (
                sourceText
              )}
            </div>
          </details>
        </Section>
      )}
    </div>
  );
}
