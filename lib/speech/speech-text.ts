import type { Lang } from "@/lib/prefs";

const RUPEES: Record<Lang, string> = { en: "rupees", hi: "रुपये", kn: "ರೂಪಾಯಿ", ta: "ரூபாய்" };
const LINK: Record<Lang, string> = { en: "a web link", hi: "एक वेब लिंक", kn: "ಒಂದು ವೆಬ್ ಲಿಂಕ್", ta: "ஒரு இணைய இணைப்பு" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Make text sound right when spoken: rupees, dates, links, no markdown, clear pauses. */
export function toSpeechFriendly(text: string, lang: Lang): string {
  let t = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, LINK[lang])
    .replace(/(?:₹|\bRs\.?|\bINR)\s*(\d[\d,]*(?:\.\d+)?)(?:\s*\/-)?/gi, `$1 ${RUPEES[lang]}`);

  if (lang === "en") {
    t = t.replace(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, (m, d, mo, y) => {
      const day = Number(d), month = Number(mo);
      return day >= 1 && day <= 31 && month >= 1 && month <= 12 ? `${day} ${MONTHS[month - 1]} ${y}` : m;
    });
  }

  const end = lang === "hi" ? "।" : ".";
  return t
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+•]\s+)/, "") // headings, quotes, bullets
        .replace(/(\*\*|__|\*|_|`|~~)(.+?)\1/g, "$2") // bold/italic/code/strike
        .replace(/[*_`#]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .map((line) => (/[.!?।:;,…]$/.test(line) ? line : line + end))
    .join(" ");
}
