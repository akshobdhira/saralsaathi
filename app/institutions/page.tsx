import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton, WidgetLoader } from "./widget-demo";

export const metadata: Metadata = { title: "For institutions" };

const SNIPPET = `<!-- 1. Load the widget once per page -->
<script src="https://YOUR-DEPLOYMENT/widget.js"
        data-api-key="YOUR_API_KEY" data-lang="hi" async></script>

<!-- 2. Mark any notice you want explained -->
<div data-saralsaathi-explain>
  Your loan EMI of ₹4,500 is due on 05/01/2027 ...
</div>

<!-- Or point to text or a public page instead -->
<span data-saralsaathi-explain data-url="https://example.org/notice"></span>`;

export default function InstitutionsPage() {
  return (
    <div lang="en" className="space-y-10 text-lg">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">SaralSaathi for institutions</h1>
        <p>
          Banks, government offices and utilities can add an <strong>“Explain this notice”</strong> button next to
          any notice on their website. People get the same simple explanation, key dates, amounts and scam check as
          in the SaralSaathi app — in English, Hindi, Kannada or Tamil, with read-aloud.
        </p>
      </header>

      <section aria-labelledby="how-heading" className="space-y-3">
        <h2 id="how-heading" className="text-2xl font-bold">
          Two ways to use it
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Widget:</strong> one script tag. It adds an accessible button (keyboard and screen reader
            friendly) after every marked notice and opens the explanation in a dialog.
          </li>
          <li>
            <strong>REST API:</strong> send text, a public link or a file to <code>POST /api/v1/explain</code> and
            get structured JSON back. See the <Link href="/docs">API documentation</Link>.
          </li>
          <li>We never store your documents or your customers’ documents. API keys are stored only as hashes.</li>
        </ul>
      </section>

      <section aria-labelledby="demo-heading" className="space-y-3">
        <h2 id="demo-heading" className="text-2xl font-bold">
          Live demo
        </h2>
        <p>
          This page uses the widget with the public demo key <code>demo-institution-key</code>. It is a demo key
          only — real institutions get their own key.
        </p>
        <article aria-labelledby="sample-notice-heading" className="rounded-lg border-2 border-border p-4">
          <h3 id="sample-notice-heading" className="text-xl font-bold">
            Sample bank notice (fictional)
          </h3>
          <div data-saralsaathi-explain className="mt-2 space-y-2">
            <p>SAMPLE — fictional notice for demonstration. Example Cooperative Bank (sample).</p>
            <p>
              Dear Customer, the EMI of ₹4,500 for your loan account ending 0000 was not paid on 05/11/2026. Please
              pay ₹4,500 plus a late fee of ₹250 by 05/12/2026 at your branch or through the official bank app. If
              unpaid, the account may be reported as overdue. The bank will never ask for your OTP or PIN.
            </p>
          </div>
        </article>
        <WidgetLoader />
      </section>

      <section aria-labelledby="embed-heading" className="space-y-3">
        <h2 id="embed-heading" className="text-2xl font-bold">
          Embed code
        </h2>
        <pre className="whitespace-pre-wrap break-words rounded-lg border-2 border-border bg-muted p-4 text-sm">
          <code>{SNIPPET}</code>
        </pre>
        <CopyButton text={SNIPPET} />
        <p>
          Set <code>data-lang</code> to <code>en</code>, <code>hi</code>, <code>kn</code> or <code>ta</code>. The
          widget respects dark mode and reduced motion, and inserts all results as plain text.
        </p>
      </section>
    </div>
  );
}
