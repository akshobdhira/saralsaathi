import type { Metadata } from "next";

export const metadata: Metadata = { title: "API documentation" };

const FIELDS: [string, string, string][] = [
  ["text", "string", "Notice text to explain (up to 60,000 characters). Send one of text, url or file_base64."],
  ["url", "string", "A public http(s) web page. Private and internal addresses are blocked."],
  ["file_base64", "string", "Base64 file contents (PDF, image, audio or video). Requires mime_type."],
  ["mime_type", "string", "For example application/pdf, image/jpeg, audio/mpeg."],
  ["language", '"en" | "hi" | "kn" | "ta"', "Answer language. Default en."],
  ["reading", '"easy" | "some" | "hard"', "How hard reading is for the person. hard gives the simplest words. Default easy."],
  ["can_see", '"yes" | "partly" | "no"', "no adds a spoken-style description for images."],
  ["can_hear", '"yes" | "partly" | "no"', "no adds a transcript for audio and video."],
  ["mode", '"default" | "simpler" | "shorter" | "more_detail"', "Re-format the answer."],
];

const ERRORS: [string, string, string][] = [
  ["NO_API_KEY", "401", "The x-api-key header is missing."],
  ["BAD_API_KEY", "401", "The key is not valid or was revoked."],
  ["BAD_REQUEST", "400", "Body is not valid JSON or has no input."],
  ["EMPTY", "400", "The input has no readable content."],
  ["BAD_URL / BLOCKED_URL", "400", "The link is malformed or points to a private address."],
  ["BAD_FILE", "415", "This file type is not supported."],
  ["TOO_BIG", "413", "The file or text is too large."],
  ["LINK_FAILED / LINK_EMPTY", "502 / 400", "The web page could not be fetched or had no text."],
  ["RATE_LIMITED", "429", "Too many requests. See the Retry-After header."],
  ["AI_BUSY", "429", "The AI service is busy. Try again shortly."],
  ["AI_FAILED / AI_BAD_OUTPUT", "502", "The AI service failed. Try again."],
  ["SERVER_ERROR", "500", "Unexpected error."],
];

const CURL = `curl -X POST https://YOUR-DEPLOYMENT/api/v1/explain \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: demo-institution-key" \\
  -d '{"text":"...","language":"hi","reading":"hard"}'`;

const RESPONSE = `{
  "ok": true,
  "result": {
    "what_it_is": "string",
    "what_to_do": ["string"],
    "deadlines": [{ "date": "string", "what": "string" }],
    "amounts": [{ "value": "string", "what": "string" }],
    "warnings": ["string"],
    "fraud_check": { "risk": "low" | "medium" | "high", "reason": "string" },
    "key_points": [{ "text": "string", "source_sentence": "string", "verified": true }],
    "simple_text": "string",
    "speech_text": "string",
    "language": "en" | "hi" | "kn" | "ta",
    "image_description": "string (images only)",
    "transcript": "string (audio/video only)"
  },
  "source_text": "string | null",
  "provider": "gemini" | "demo",
  "notice": "Check the original document before paying or signing. ..."
}

// On error:
{ "ok": false, "error": { "code": "BAD_API_KEY", "message": "This API key is not valid." } }`;

const pre = "whitespace-pre-wrap break-words rounded-lg border-2 border-border bg-muted p-4 text-sm";

export default function DocsPage() {
  return (
    <div lang="en" className="space-y-10 text-lg">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">API documentation</h1>
        <p>
          The SaralSaathi REST API turns a notice into a simple, structured explanation: what it is, what to do, dates,
          amounts, warnings and a scam check, in English, Hindi, Kannada or Tamil.
        </p>
      </header>

      <section aria-labelledby="auth-heading" className="space-y-3">
        <h2 id="auth-heading" className="text-2xl font-bold">Authentication</h2>
        <p>
          Send your key in the <code>x-api-key</code> header (or <code>Authorization: Bearer &lt;key&gt;</code>). Keep
          keys on your server when you can. For testing, use the demo key <code>demo-institution-key</code>.
        </p>
      </section>

      <section aria-labelledby="endpoint-heading" className="space-y-3">
        <h2 id="endpoint-heading" className="text-2xl font-bold">Endpoint</h2>
        <p>
          <code>POST /api/v1/explain</code> with a JSON body. CORS is open (<code>Access-Control-Allow-Origin: *</code>)
          so the widget can call it from any site.
        </p>
        <div>
          <table className="w-full border-collapse text-left text-base [overflow-wrap:anywhere]">
            <caption className="mb-2 text-left font-semibold">Request body fields</caption>
            <thead>
              <tr className="border-b-2 border-border">
                <th scope="col" className="p-2">Field</th>
                <th scope="col" className="p-2">Type</th>
                <th scope="col" className="p-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(([f, t, d]) => (
                <tr key={f} className="border-b border-border align-top">
                  <th scope="row" className="p-2 font-mono font-semibold">{f}</th>
                  <td className="p-2 font-mono">{t}</td>
                  <td className="p-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="example-heading" className="space-y-3">
        <h2 id="example-heading" className="text-2xl font-bold">Example</h2>
        <pre className={pre}><code>{CURL}</code></pre>
      </section>

      <section aria-labelledby="response-heading" className="space-y-3">
        <h2 id="response-heading" className="text-2xl font-bold">Response</h2>
        <p>
          <code>key_points[].verified</code> is <code>true</code> when the quoted source sentence was found in the
          original text. Always show <code>notice</code> to your users.
        </p>
        <pre className={pre}><code>{RESPONSE}</code></pre>
      </section>

      <section aria-labelledby="errors-heading" className="space-y-3">
        <h2 id="errors-heading" className="text-2xl font-bold">Error codes</h2>
        <div>
          <table className="w-full border-collapse text-left text-base [overflow-wrap:anywhere]">
            <caption className="mb-2 text-left font-semibold">Error codes and HTTP status</caption>
            <thead>
              <tr className="border-b-2 border-border">
                <th scope="col" className="p-2">Code</th>
                <th scope="col" className="p-2">HTTP status</th>
                <th scope="col" className="p-2">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map(([c, s, m]) => (
                <tr key={c} className="border-b border-border align-top">
                  <th scope="row" className="p-2 font-mono font-semibold">{c}</th>
                  <td className="p-2">{s}</td>
                  <td className="p-2">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits-heading" className="space-y-3">
        <h2 id="limits-heading" className="text-2xl font-bold">Rate limits and size</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>60 requests per minute per API key. Over the limit you get <code>429 RATE_LIMITED</code> with a <code>Retry-After</code> header.</li>
          <li>Keep request bodies under 4 MB (base64 adds about a third to file size).</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-heading" className="space-y-3">
        <h2 id="privacy-heading" className="text-2xl font-bold">Privacy</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>We never store documents, links or results. Each request is processed and forgotten.</li>
          <li>API keys are stored only as SHA-256 hashes.</li>
          <li>Answers can contain mistakes. Tell users to check the original document before paying or signing.</li>
        </ul>
      </section>
    </div>
  );
}
