"use client";

import type { ReactNode } from "react";

export type Choice<V extends string> = { value: V; label: string; lang?: string };

/** Native radio group: <fieldset><legend>, big (≥44px) tappable rows, checked state not colour-only. */
export function ChoiceGroup<V extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: ReactNode;
  name: string;
  value: V;
  options: Choice<V>[];
  onChange: (v: V) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xl font-bold">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          lang={o.lang}
          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border px-4 py-2 text-lg has-[:checked]:border-primary has-[:checked]:bg-muted has-[:checked]:font-bold"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="size-5 shrink-0 accent-primary"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
