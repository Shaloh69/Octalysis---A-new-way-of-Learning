import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * `/claim` (console) — a teacher claims their employee ID (T1, 7 Oct 2026).
 * `design/templates/console/claim/SPEC.md` owns the decisions.
 *
 * ## What a local stack can and cannot show
 *
 * The claim route is mounted only with a Supabase project, which a local stack
 * does not have, so every submit here ends in "not available on this server":
 * a real failure through the real code path. The SUCCESS path (account made,
 * signed in, on /locks) is not reachable locally; the API's half is proved by
 * `services/api/test/teachers-api.spec.ts` with a fake Supabase admin, and the
 * page's half must be seen on the deployment before anyone calls it verified.
 */

const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const wide = (info: TestInfo) => info.project.name.includes("1440");

async function openClaim(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.removeItem("octa:dev-token"));
  await page.goto(`${CONSOLE_URL}/claim`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
}

async function fill(page: Page, confirm = "a-much-longer-password-1"): Promise<void> {
  await page.getByLabel("Employee ID").fill("EMP-0042");
  await page.getByLabel("Full name, as on the roster").fill("Maria Santos");
  await page.getByLabel("Email").fill("maria@example.com");
  await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
  await page.getByLabel("Confirm new password").fill(confirm);
}

async function failClaim(page: Page): Promise<void> {
  await fill(page);
  await page.getByRole("button", { name: /claim account/i }).click();
  await page.getByRole("alert").filter({ hasText: /\S/ }).first().waitFor({ timeout: 15_000 });
}

test.describe("/claim — SPEC.md", () => {
  test("reached from /signin and back again, from the keyboard", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("octa:dev-token"));
    await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /claim your teacher account/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/claim$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/claim your teacher account/i);
    await page.getByRole("link", { name: /^sign in$/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin$/);
  });

  test("the button waits for every field and a confirmed 12-character password", async ({ page }) => {
    await openClaim(page);
    const submit = page.getByRole("button", { name: /claim account/i });
    await expect(submit).toBeDisabled();
    await fill(page, "a-different-password-1");
    await expect(page.getByText(/do not match/i)).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    await expect(submit).toBeEnabled();
  });

  test("a claim that could not be made says so, in words, and it stays", async ({ page }) => {
    await openClaim(page);
    await failClaim(page);
    const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
    await expect(alert).toContainText(/not available|could not be used|too many|did not answer/i);
    await page.waitForTimeout(3_000);
    await expect(alert, "the failure vanished on a timer").toBeVisible();
    await expect(page.getByLabel("Employee ID")).toHaveValue("EMP-0042");
  });

  test("no role is offered: the roster decides it", async ({ page }) => {
    await openClaim(page);
    await expect(page.locator("main select, main [role=combobox], main [role=radio]")).toHaveCount(0);
    await expect(page.locator("main")).toContainText(/role comes from the roster/i);
  });

  test("capture: current and current-380, then opened", async ({ page }, info) => {
    const s = wide(info) ? "" : "-380";
    await openClaim(page);
    await fill(page, "a-different-password-1");
    await page.screenshot({ path: `design/templates/console/claim/current${s}.png`, fullPage: true });
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    await page.getByRole("button", { name: /claim account/i }).click();
    await page.getByRole("alert").filter({ hasText: /\S/ }).first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `design/templates/console/claim/current-fault${s}.png`, fullPage: true });
  });
});

type Screen = [string, (page: Page) => Promise<void>];
const SCREENS: Screen[] = [
  ["claim", openClaim],
  ["claim, hints", async (p) => { await openClaim(p); await fill(p, "x"); }],
  ["claim, failed", async (p) => { await openClaim(p); await failClaim(p); }],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, /claim", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await clippedElements(page), name).toEqual([]);
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await horizontalOverflow(page), name).toBeLessThanOrEqual(0);
    }
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openClaim(page);
    await fill(page);
    expect(await unreachableByKeyboard(page, "main"), "claim, filled").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(120_000);
    const failures: string[] = [];
    for (const [name, open] of SCREENS) {
      await open(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${name}: ${f}`));
      }
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await offTokenStyles(page), name).toEqual([]);
    }
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    await recordMotion(page);
    await openClaim(page);
    await page.waitForTimeout(1_200);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the readout should count up").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openClaim(page);
    await failClaim(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "claim").toEqual([]);
  });
});
