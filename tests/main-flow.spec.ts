import { test, expect, type Page } from "@playwright/test";

const NOTICE =
  "Electricity bill notice. Your bill of ₹2,450 is overdue. Please pay by 15/12/2026 or your supply will be disconnected. Call the official helpline 1912.";

async function tabUntilFocused(page: Page, name: RegExp, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    // Read activeElement directly: a `:focus` locator waits forever when focus is on <body>.
    const text = await page.evaluate(() => {
      const el = document.activeElement;
      // Only real controls: <body>/containers contain every word on the page.
      if (!el || !el.matches("a, button, input, select, textarea, [role=tab]")) return "";
      return `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`;
    });
    if (name.test(text)) return;
  }
  throw new Error(`Could not reach ${name} by Tab`);
}

async function expectReady(page: Page) {
  await expect(page.getByTestId("live-polite")).toContainText(/ready/i, { timeout: 30_000 });
}

test("keyboard-only: start → setup → paste text → result → simpler", async ({ page }) => {
  await page.goto("/");
  await tabUntilFocused(page, /start/i);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/setup/);

  // Pick a preset by keyboard.
  await tabUntilFocused(page, /screen reader|see a little|can.t hear|very simple/i);
  await page.keyboard.press("Enter");
  // router.push is async: give it time before assuming a confirm step is needed.
  await page.waitForURL(/\/app/, { timeout: 5_000 }).catch(() => {});
  if (!/\/app/.test(page.url())) {
    await tabUntilFocused(page, /continue|next|done|save|start|go to/i).catch(() => {});
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  const pasteTab = page.getByRole("tab", { name: /paste text/i });
  await pasteTab.focus();
  await page.keyboard.press("Enter");
  await expect(pasteTab).toHaveAttribute("aria-selected", "true");

  const box = page.getByRole("textbox", { name: /paste|type|notice|text/i }).first();
  await box.focus();
  await page.keyboard.insertText(NOTICE);
  await page.getByRole("button", { name: /explain this/i }).first().focus();
  await page.keyboard.press("Enter");

  await expectReady(page);
  const focusedHeading = page.locator("h1:focus, h2:focus, h3:focus, [role=heading]:focus");
  await expect(focusedHeading).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /scam/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /dates/i }).first()).toBeVisible();

  // Re-format. (Don't write to the live region's DOM: React owns that text node.)
  const announcements: string[] = [];
  await page.exposeFunction("__announce", (t: string) => announcements.push(t));
  await page.getByTestId("live-polite").evaluate((el) => {
    new MutationObserver(() => (window as unknown as { __announce: (t: string) => void }).__announce(el.textContent ?? "")).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.getByRole("button", { name: /simpler/i }).first().focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => announcements.join(" | "), { timeout: 30_000 }).toMatch(/ready/i); // "Processing" may be superseded within 50ms in demo mode
  await expect(page.getByRole("heading", { name: /scam/i }).first()).toBeVisible();
});

test("sample KYC scam message is flagged", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /kyc/i }).click();
  await expectReady(page);
  const scamHeading = page.getByRole("heading", { name: /scam/i }).first();
  await expect(scamHeading).toBeVisible();
  // The scam section is the heading's closest section/region.
  const section = page.locator("section, [role=region], article").filter({ has: scamHeading }).last();
  await expect(section).toContainText(/high|medium/i);
});

test.describe("API", () => {
  test("v1 rejects missing key", async ({ request }) => {
    const res = await request.post("/api/v1/explain", { data: { text: "Pay ₹100 by 01/01/2027." } });
    expect(res.status()).toBe(401);
    expect((await res.json()).ok).toBe(false);
  });

  test("v1 explains with demo key", async ({ request }) => {
    const res = await request.post("/api/v1/explain", {
      headers: { "x-api-key": "demo-institution-key" },
      data: {
        text: "Your electricity bill of ₹2,450 is due on 15/12/2026.",
        language: "en",
        can_see: "no",
        can_hear: "no",
        mode: "simpler",
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.result.what_it_is).toBe("string");
  });

  for (const url of ["http://127.0.0.1", "http://169.254.169.254"]) {
    test(`web route blocks private link ${url}`, async ({ request }) => {
      const res = await request.post("/api/explain", { multipart: { kind: "link", url } });
      expect(res.status()).toBe(400);
      expect((await res.json()).ok).toBe(false);
    });
  }
});

test("institution widget opens dialog, explains notice, and restores focus on Esc", async ({ page }) => {
  await page.goto("/institutions");
  const trigger = page.getByRole("button", { name: /explain this notice/i });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/4,500/);
  await expect(dialog).toContainText(/check the original document/i);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("settings persist theme, text size, and Hindi UI across reload", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel(/language/i).selectOption("hi");
  await page.getByRole("radio", { name: /गहरा|dark/i }).check();
  await page.getByRole("radio", { name: /बड़ा|large/i }).first().check();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("सेटिंग");
});
