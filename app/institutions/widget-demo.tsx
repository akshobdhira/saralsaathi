"use client";

import { useState } from "react";
import Script from "next/script";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/live-region";

declare global {
  interface Window {
    SaralSaathi?: { scan: () => void };
  }
}

/** Loads /widget.js with the demo key; re-scans on client-side navigation back to this page. */
export function WidgetLoader() {
  return (
    <Script
      src="/widget.js"
      data-api-key="demo-institution-key"
      data-lang="en"
      strategy="afterInteractive"
      onReady={() => window.SaralSaathi?.scan()}
    />
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const announce = useAnnounce();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          announce("Code copied.");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          announce("Could not copy. Please select the code and copy it yourself.", "assertive");
        }
      }}
    >
      <Copy aria-hidden="true" />
      {copied ? "Copied" : "Copy code"}
    </Button>
  );
}
