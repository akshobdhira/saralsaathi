"use client";

import { useId, useState } from "react";
import { Camera, FileUp, Link2, Mic, Type, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAnnounce } from "@/components/live-region";
import VoiceInput from "@/components/speech/voice-input";
import { t, type I18nKey } from "@/lib/i18n";
import { LIMITS, type ExplainInput } from "@/lib/schema";
import type { Lang, Prefs } from "@/lib/prefs";
import { SAMPLES } from "@/lib/samples";
import { shrinkImage } from "./shrink-image";
import { CameraCapture } from "./camera-capture";

type Props = {
  onSubmit: (input: ExplainInput) => void;
  busy: boolean;
  lang: Lang;
  canSee: Prefs["canSee"];
};

/** Vercel caps request bodies at 4.5 MB, so check 4 MB on the client. */
const CLIENT_MAX_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function SubmitButton({ busy, lang }: { busy: boolean; lang: Lang }) {
  return (
    <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
      {busy ? t(lang, "btn_working") : t(lang, "btn_explain")}
    </Button>
  );
}

function FieldError({ id, error }: { id: string; error: string }) {
  return error ? (
    <p id={id} role="alert" className="font-semibold text-destructive">
      {error}
    </p>
  ) : null;
}

const ROUTES: { value: string; key: I18nKey; Icon: typeof FileUp }[] = [
  { value: "file", key: "tab_file", Icon: FileUp },
  { value: "camera", key: "tab_camera", Icon: Camera },
  { value: "text", key: "tab_text", Icon: Type },
  { value: "speak", key: "tab_speak", Icon: Mic },
  { value: "link", key: "tab_link", Icon: Link2 },
];

export default function InputPanel({ onSubmit, busy, lang, canSee }: Props) {
  const [tab, setTab] = useState<string>("file");
  const announce = useAnnounce();

  return (
    <section aria-labelledby="input-heading" className="space-y-6">
      <h2 id="input-heading" className="text-2xl font-bold">
        {t(lang, "input_heading")}
      </h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t(lang, "input_tablist")} className="h-auto w-full flex-wrap gap-1">
          {ROUTES.map(({ value, key, Icon }) => (
            <TabsTrigger key={value} value={value} className="min-h-11 flex-1 px-3 text-base">
              <Icon aria-hidden="true" />
              {t(lang, key)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="rounded-lg border-2 border-border p-4 text-base">
          <TabsContent value="file">
            <FileRoute busy={busy} lang={lang} onSubmit={onSubmit} />
          </TabsContent>
          <TabsContent value="camera">
            <CameraCapture lang={lang} canSee={canSee} busy={busy} onFile={(file) => onSubmit({ kind: "file", file })} />
          </TabsContent>
          <TabsContent value="text">
            <TextRoute busy={busy} lang={lang} onSubmit={onSubmit} label={t(lang, "text_label")} />
          </TabsContent>
          <TabsContent value="speak">
            <TextRoute busy={busy} lang={lang} onSubmit={onSubmit} label={t(lang, "speak_text_label")} voice />
          </TabsContent>
          <TabsContent value="link">
            <LinkRoute busy={busy} lang={lang} onSubmit={onSubmit} />
          </TabsContent>
        </div>
      </Tabs>

      <section aria-labelledby="samples-heading" className="space-y-3">
        <h3 id="samples-heading" className="text-xl font-bold">
          {t(lang, "samples_heading")}
        </h3>
        <p>{t(lang, "samples_hint")}</p>
        <ul className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={busy}
                aria-busy={busy}
                onClick={async () => {
                  try {
                    const res = await fetch(s.file);
                    if (!res.ok) throw new Error();
                    onSubmit({ kind: "text", text: await res.text(), label: s.title });
                  } catch {
                    announce(t(lang, "err_sample_load"), "assertive");
                  }
                }}
              >
                <FileText aria-hidden="true" />
                {s.title}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function FileRoute({ busy, lang, onSubmit }: { busy: boolean; lang: Lang; onSubmit: Props["onSubmit"] }) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const announce = useAnnounce();

  async function choose(picked: File | undefined) {
    setFile(null);
    if (!picked) return setError("");
    const f = await shrinkImage(picked);
    if (f.type && !(LIMITS.acceptedMime as readonly string[]).includes(f.type)) {
      return setError(t(lang, "err_bad_file"));
    }
    if (f.size > CLIENT_MAX_BYTES) {
      return setError(t(lang, "err_big_file"));
    }
    setError("");
    setFile(f);
    announce(t(lang, "file_announced", { name: f.name, size: formatSize(f.size) }));
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return setError(t(lang, "err_no_file"));
        onSubmit({ kind: "file", file });
      }}
    >
      <label htmlFor={`${id}-file`} className="block text-lg font-semibold">
        {t(lang, "file_label")}
      </label>
      <p id={`${id}-hint`}>{t(lang, "file_hint")}</p>
      <input
        id={`${id}-file`}
        type="file"
        accept={LIMITS.acceptedMime.join(",")}
        disabled={busy}
        aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        aria-invalid={!!error}
        onChange={(e) => void choose(e.target.files?.[0])}
        className="block min-h-11 w-full rounded-lg border-2 border-input p-2 focus-visible:outline-3 focus-visible:outline-ring file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-foreground"
      />
      {file && (
        <p>
          {t(lang, "file_chosen")} <strong>{file.name}</strong> ({formatSize(file.size)})
        </p>
      )}
      <FieldError id={`${id}-err`} error={error} />
      <SubmitButton busy={busy} lang={lang} />
    </form>
  );
}

function TextRoute({
  busy,
  lang,
  onSubmit,
  label,
  voice = false,
}: {
  busy: boolean;
  lang: Lang;
  onSubmit: Props["onSubmit"];
  label: string;
  voice?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return setError(t(lang, voice ? "err_no_speech_text" : "err_no_text"));
        setError("");
        onSubmit({ kind: "text", text: text.trim() });
      }}
    >
      {voice && (
        <VoiceInput
          lang={lang}
          label={t(lang, "start_speaking")}
          onResult={(said) => setText((prev) => (prev ? `${prev} ${said}` : said).slice(0, LIMITS.maxTextChars))}
        />
      )}
      <label htmlFor={`${id}-text`} className="block text-lg font-semibold">
        {label}
      </label>
      <Textarea
        id={`${id}-text`}
        value={text}
        maxLength={LIMITS.maxTextChars}
        rows={8}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={`${id}-count${error ? ` ${id}-err` : ""}`}
        aria-invalid={!!error}
        className="min-h-40 text-base md:text-base"
      />
      <p id={`${id}-count`} className="text-sm">
        {t(lang, "char_count", { count: text.length.toLocaleString(), max: LIMITS.maxTextChars.toLocaleString() })}
      </p>
      <FieldError id={`${id}-err`} error={error} />
      <SubmitButton busy={busy} lang={lang} />
    </form>
  );
}

function LinkRoute({ busy, lang, onSubmit }: { busy: boolean; lang: Lang; onSubmit: Props["onSubmit"] }) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        let ok = false;
        try {
          ok = ["http:", "https:"].includes(new URL(url.trim()).protocol);
        } catch {}
        if (!ok) return setError(t(lang, "err_bad_link"));
        setError("");
        onSubmit({ kind: "link", url: url.trim() });
      }}
    >
      <label htmlFor={`${id}-url`} className="block text-lg font-semibold">
        {t(lang, "link_label")}
      </label>
      <p id={`${id}-hint`}>{t(lang, "link_hint")}</p>
      <Input
        id={`${id}-url`}
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        aria-invalid={!!error}
        className="text-base md:text-base"
      />
      <FieldError id={`${id}-err`} error={error} />
      <SubmitButton busy={busy} lang={lang} />
    </form>
  );
}
