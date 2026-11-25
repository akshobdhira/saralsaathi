import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/setup", "/app", "/settings", "/institutions", "/docs"];
const BASE_PREFS = {
  canSee: "yes",
  canHear: "yes",
  reading: "easy",
  readAloud: false,
  language: "en",
  textSize: "normal",
  speechRate: 1,
};

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const bad = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `axe violations on ${path}`,
  ).toEqual([]);
}

for (const theme of ["light", "dark", "contrast"] as const) {
  test.describe(`axe — ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      const prefs = { ...BASE_PREFS, theme };
      await page.addInitScript((p) => {
        localStorage.setItem("saralsaathi.prefs.v1", JSON.stringify(p));
      }, prefs);
    });
    for (const path of PAGES) {
      test(`${path} has no serious a11y violations`, async ({ page }) => {
        await scan(page, path);
      });
    }
  });
}
