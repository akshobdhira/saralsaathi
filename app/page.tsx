import type { Metadata } from "next";
import Landing from "@/components/onboarding/landing";

export const metadata: Metadata = {
  title: { absolute: "SaralSaathi — explain any notice simply" },
};

export default function Home() {
  return <Landing />;
}
