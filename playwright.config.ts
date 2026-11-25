import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 180_000,
    // Empty Gemini key → deterministic demo mode. No Supabase → DEMO_API_KEYS is used.
    env: {
      GEMINI_API_KEY: "",
      DEMO_API_KEYS: "demo-institution-key",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
