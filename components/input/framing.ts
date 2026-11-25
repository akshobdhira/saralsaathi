/** Camera framing hints. Pure functions so they can be tested without a camera. */
import type { Lang } from "@/lib/prefs";

export type HintId = "dark" | "blurry" | "back" | "closer" | "good";

export const HINTS: Record<HintId, Record<Lang, string>> = {
  dark: {
    en: "Too dark. Turn on a light.",
    hi: "बहुत अँधेरा है। लाइट जलाएँ।",
    kn: "ತುಂಬಾ ಕತ್ತಲಾಗಿದೆ. ಲೈಟ್ ಹಾಕಿ.",
    ta: "மிகவும் இருட்டாக உள்ளது. விளக்கை போடுங்கள்.",
  },
  blurry: {
    en: "Hold still. The picture is blurry.",
    hi: "स्थिर रखें। तस्वीर धुंधली है।",
    kn: "ಅಲುಗಾಡದೆ ಹಿಡಿಯಿರಿ. ಚಿತ್ರ ಮಸುಕಾಗಿದೆ.",
    ta: "அசையாமல் பிடியுங்கள். படம் மங்கலாக உள்ளது.",
  },
  back: {
    en: "Move back so the whole page fits.",
    hi: "थोड़ा पीछे हटें ताकि पूरा पन्ना दिखे।",
    kn: "ಪೂರ್ತಿ ಪುಟ ಕಾಣುವಂತೆ ಸ್ವಲ್ಪ ಹಿಂದೆ ಸರಿಯಿರಿ.",
    ta: "முழு பக்கமும் தெரிய சற்று பின்னால் நகருங்கள்.",
  },
  closer: {
    en: "Move closer.",
    hi: "थोड़ा पास लाएँ।",
    kn: "ಸ್ವಲ್ಪ ಹತ್ತಿರ ತನ್ನಿ.",
    ta: "சற்று அருகில் கொண்டு வாருங்கள்.",
  },
  good: {
    en: "Good. Hold still and press Capture.",
    hi: "ठीक है। स्थिर रखें और कैप्चर दबाएँ।",
    kn: "ಸರಿ. ಅಲುಗಾಡದೆ ಹಿಡಿದು ಕ್ಯಾಪ್ಚರ್ ಒತ್ತಿ.",
    ta: "சரி. அசையாமல் பிடித்து கேப்சர் அழுத்துங்கள்.",
  },
};

/**
 * Calibration knobs (0–255 luma scale). Tune on real phones.
 * ponytail: naive heuristics on a 80x60 frame; swap for a document-edge detector if hints prove wrong often.
 */
export const FRAMING = {
  darkBelow: 55,
  blurEdgeVarBelow: 60,
  /** Border edge density above this fraction of centre density → page runs off the edges. */
  borderOverCentre: 0.85,
  /** Centre edge density below this → page too small / far away. */
  closerBelow: 6,
};

/** Analyse a grayscale frame (one byte per pixel, row-major). */
export function analyseFrame(gray: ArrayLike<number>, w: number, h: number): HintId {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  if (sum / gray.length < FRAMING.darkBelow) return "dark";

  const bw = Math.max(1, Math.round(w * 0.12));
  const bh = Math.max(1, Math.round(h * 0.12));
  let eSum = 0, eSq = 0, n = 0;
  let border = 0, borderN = 0, centre = 0, centreN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const e = Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + w] - gray[i - w]);
      eSum += e; eSq += e * e; n++;
      if (x < bw || x >= w - bw || y < bh || y >= h - bh) { border += e; borderN++; }
      else { centre += e; centreN++; }
    }
  }
  const mean = eSum / n;
  if (eSq / n - mean * mean < FRAMING.blurEdgeVarBelow) return "blurry";
  const c = centre / Math.max(1, centreN);
  const b = border / Math.max(1, borderN);
  if (c < FRAMING.closerBelow) return "closer";
  if (b > c * FRAMING.borderOverCentre) return "back";
  return "good";
}

/** RGBA → luma. */
export function toGray(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    out[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return out;
}
