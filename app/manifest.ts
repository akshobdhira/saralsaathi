import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaralSaathi",
    short_name: "SaralSaathi",
    description: "Explain any notice in simple words, speech, or text.",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2b4fb3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
