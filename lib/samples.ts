import type { Lang } from "@/lib/prefs";

/** Fictional demo notices served from /public/samples. */
export type Sample = { id: string; title: string; file: string; language: Lang };

export const SAMPLES: Sample[] = [
  {
    id: "electricity",
    title: "Electricity disconnection notice (English)",
    file: "/samples/electricity-disconnection.txt",
    language: "en",
  },
  {
    id: "pension",
    title: "Pension life certificate notice (Hindi)",
    file: "/samples/pension-life-certificate.txt",
    language: "hi",
  },
  {
    id: "kyc-scam",
    title: "Bank KYC message (English, suspicious)",
    file: "/samples/kyc-scam-sms.txt",
    language: "en",
  },
];
