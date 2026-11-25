import type { Metadata } from "next";
import ExplainScreen from "@/components/result/explain-screen";

export const metadata: Metadata = { title: "Explain a document" };

export default function AppPage() {
  return <ExplainScreen />;
}
