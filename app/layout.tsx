import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { LiveRegionProvider } from "@/components/live-region";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SaralSaathi — explain any notice simply", template: "%s · SaralSaathi" },
  description:
    "SaralSaathi turns notices, bills, PDFs, photos, audio and video into simple text, speech, transcripts and key dates — built for screen readers, keyboards, Deaf users and easy reading.",
  manifest: "/manifest.webmanifest",
  applicationName: "SaralSaathi",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

// Applies saved theme/text size before paint so there is no flash (runs before React).
const prefsBootScript = `try{var p=JSON.parse(localStorage.getItem("saralsaathi.prefs.v1")||"{}");var h=document.documentElement;var t=p.theme||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t!=="light")h.classList.add(t);if(p.textSize)h.dataset.text=p.textSize;if(p.language)h.lang=p.language;}catch(e){}`;

const nav = [
  { href: "/app", label: "Explain a document" },
  { href: "/settings", label: "Settings" },
  { href: "/institutions", label: "For institutions" },
  { href: "/docs", label: "API docs" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={atkinson.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <LiveRegionProvider>
          <header lang="en" className="border-b-2 border-border">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="text-2xl font-bold no-underline hover:underline">
                SaralSaathi
              </Link>
              <nav aria-label="Main">
                <ul className="flex flex-wrap gap-1">
                  {nav.map((n) => (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold underline-offset-4 hover:underline"
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-none">
            {children}
          </main>
          <footer lang="en" className="border-t-2 border-border">
            <p className="mx-auto max-w-5xl px-4 py-4 text-sm">
              SaralSaathi can make mistakes. Always check the original document before paying or signing. We
              never store your documents.
            </p>
          </footer>
        </LiveRegionProvider>
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
