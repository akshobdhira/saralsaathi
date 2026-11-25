"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnnounce } from "@/components/live-region";
import { ChoiceGroup } from "@/components/onboarding/choice-group";
import { fmtRate, t, type I18nKey } from "@/lib/i18n";
import { LANG_NAMES, type Lang, type Prefs } from "@/lib/prefs";
import { usePrefs } from "@/lib/use-prefs";

export default function SettingsForm() {
  const { prefs, setPrefs } = usePrefs();
  const lang = prefs.language;
  const announce = useAnnounce();

  function update(p: Partial<Prefs>) {
    setPrefs(p);
    announce(t(p.language ?? lang, "saved"));
  }
  const choices = <V extends string>(pairs: [V, I18nKey][]) =>
    pairs.map(([value, key]) => ({ value, label: t(lang, key) }));
  const ability = choices<"yes" | "partly" | "no">([
    ["yes", "opt_yes"],
    ["partly", "opt_partly"],
    ["no", "opt_no"],
  ]);
  const rateText = t(lang, "speed_value", { rate: fmtRate(prefs.speechRate) });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">{t(lang, "settings_title")}</h1>

      <div className="space-y-2">
        <Label htmlFor="s-language" className="text-xl font-bold">
          {t(lang, "s_language")}
        </Label>
        <select
          id="s-language"
          value={lang}
          onChange={(e) => update({ language: e.target.value as Lang })}
          className="block min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 text-lg"
        >
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <option key={l} value={l} lang={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </div>

      <ChoiceGroup
        legend={t(lang, "s_theme")}
        name="theme"
        value={prefs.theme}
        options={choices<Prefs["theme"]>([
          ["system", "theme_system"],
          ["light", "theme_light"],
          ["dark", "theme_dark"],
          ["contrast", "theme_contrast"],
        ])}
        onChange={(theme) => update({ theme })}
      />

      <ChoiceGroup
        legend={t(lang, "s_text")}
        name="textSize"
        value={prefs.textSize}
        options={choices<Prefs["textSize"]>([
          ["normal", "text_normal"],
          ["large", "text_large"],
          ["xlarge", "text_xlarge"],
        ])}
        onChange={(textSize) => update({ textSize })}
      />

      <ChoiceGroup
        legend={t(lang, "q_reading")}
        name="reading"
        value={prefs.reading}
        options={choices<Prefs["reading"]>([
          ["easy", "opt_easy"],
          ["some", "opt_some"],
          ["hard", "opt_hard"],
        ])}
        onChange={(reading) => update({ reading })}
      />

      <div className="flex min-h-12 items-center gap-3">
        <Switch
          id="s-readaloud"
          checked={prefs.readAloud}
          onCheckedChange={(readAloud) => update({ readAloud })}
        />
        <Label htmlFor="s-readaloud" className="cursor-pointer text-xl font-bold">
          {t(lang, "s_readAloud")}
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="s-speed" className="text-xl font-bold">
          {t(lang, "s_speed")}
        </Label>
        <p id="s-speed-value" className="text-lg" aria-hidden="true">
          {rateText}
        </p>
        <input
          id="s-speed"
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={prefs.speechRate}
          aria-valuetext={rateText}
          onChange={(e) => update({ speechRate: Number(e.target.value) })}
          className="h-11 w-full cursor-pointer accent-primary"
        />
      </div>

      <ChoiceGroup
        legend={t(lang, "q_canSee")}
        name="canSee"
        value={prefs.canSee}
        options={ability}
        onChange={(canSee) => update({ canSee })}
      />

      <ChoiceGroup
        legend={t(lang, "q_canHear")}
        name="canHear"
        value={prefs.canHear}
        options={ability}
        onChange={(canHear) => update({ canHear })}
      />

      <p>
        <Link href="/setup" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold underline">
          <RotateCcw aria-hidden="true" className="size-5" />
          {t(lang, "run_setup")}
        </Link>
      </p>
    </div>
  );
}
