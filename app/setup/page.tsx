import type { Metadata } from "next";
import SetupFlow from "@/components/onboarding/setup-flow";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return <SetupFlow />;
}
