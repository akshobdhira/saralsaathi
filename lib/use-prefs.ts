"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";

const EVENT = "saralsaathi:prefs";
/** Last prefs saved in this tab — keeps working when localStorage is blocked. */
let memory: string | null = null;

function subscribe(onChange: () => void) {
  const onPrefs = (e: Event) => {
    memory = JSON.stringify((e as CustomEvent<Prefs>).detail);
    onChange();
  };
  const onStorage = () => {
    memory = null;
    onChange();
  };
  window.addEventListener(EVENT, onPrefs);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onPrefs);
    window.removeEventListener("storage", onStorage);
  };
}

// Snapshots are strings so they compare by value (stable for useSyncExternalStore).
const getSnapshot = () => memory ?? JSON.stringify(loadPrefs());
const getServerSnapshot = () => "null";
const noop = () => () => {};

/** Hydration-safe preferences. `ready` is false on the server and the first client render. */
export function usePrefs() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const stored = useMemo(() => JSON.parse(raw) as Prefs | null, [raw]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    const current = (memory ? (JSON.parse(memory) as Prefs) : loadPrefs()) ?? DEFAULT_PREFS;
    savePrefs({ ...current, ...p });
  }, []);

  return { prefs: stored ?? DEFAULT_PREFS, setPrefs, ready, hasOnboarded: stored !== null };
}
