"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Announce = (message: string, politeness?: "polite" | "assertive") => void;
const Ctx = createContext<Announce>(() => {});

/**
 * One app-wide pair of live regions. Call `useAnnounce()(msg)` for every
 * state change: file chosen, processing started/done, errors.
 */
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((message, politeness = "polite") => {
    const set = politeness === "assertive" ? setAssertive : setPolite;
    // Clear then set so repeating the same message is re-announced.
    set("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set(message), 50);
  }, []);

  return (
    <Ctx.Provider value={announce}>
      {children}
      <div aria-live="polite" role="status" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </Ctx.Provider>
  );
}

export const useAnnounce = () => useContext(Ctx);
