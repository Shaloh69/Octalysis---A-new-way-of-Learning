import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * The blocking change-your-credentials screen.
 *
 * `bootstrap-admin.mjs` creates the first staff account on a real Supabase
 * project with a password PRINTED TO A TERMINAL. That password has been seen —
 * scrolled back to, copied, possibly screenshotted — so it is not a secret, and
 * the account can read every answer key in the bank.
 *
 * `app_metadata.must_change_credentials` marks the account until the credentials
 * are replaced, and the console blocks on this screen rather than showing a
 * dismissible banner. A banner on the busiest screen in the app is a banner
 * nobody reads, and the window between "deployed" and "credentials changed" is
 * exactly when a known password matters most.
 *
 * The flag is minted into the token here because the local stack has no Supabase
 * Auth at all — `pnpm dev:token staff --must-change` does the same thing for a
 * human.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function staffToken(mustChange: boolean): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "teacher@octa.local",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: {
      role: "teacher",
      ...(mustChange ? { must_change_credentials: true } : {}),
    },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function openAs(page: import("@playwright/test").Page, mustChange: boolean): Promise<void> {
  await page.addInitScript(
    (t) => localStorage.setItem("octa:dev-token", t as string),
    staffToken(mustChange),
  );
  await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
}

test.describe("the bootstrap credentials prompt", () => {
  test("blocks the whole console, not just one page", async ({ page }) => {
    await openAs(page, true);

    await expect(
      page.getByRole("heading", { name: /Change your email and password/i }),
    ).toBeVisible();

    /*
     * The point of the test. `/items` was requested and the item bank must NOT
     * be reachable — a prompt you can navigate around is not a prompt. The nav
     * is absent entirely, so there is nothing to click past.
     */
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Items" })).toHaveCount(0);
  });

  test("warns that there is no password reset, before a password is chosen", async ({ page }) => {
    await openAs(page, true);
    // Said BEFORE they pick one, not after they lose it.
    await expect(page.getByText(/Do not lose these/i)).toBeVisible();
    await expect(page.getByText(/no self-service password reset/i)).toBeVisible();
  });

  test("will not submit until both fields are valid and matching", async ({ page }) => {
    await openAs(page, true);
    const submit = page.getByRole("button", { name: "Change and continue" });

    await expect(submit).toBeDisabled();

    await page.getByLabel("New password", { exact: true }).fill("tooshort");
    await expect(submit, "a short password must not be accepted").toBeDisabled();

    await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
    await expect(submit, "the confirmation is still empty").toBeDisabled();

    await page.getByLabel("Confirm new password").fill("a-different-password-1");
    await expect(submit, "a mismatch must not be accepted").toBeDisabled();
    await expect(page.getByText(/do not match/i)).toBeVisible();

    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    await expect(submit).toBeEnabled();
  });

  test("offers a way OUT, but not a way PAST", async ({ page }) => {
    await openAs(page, true);
    // Signing out is the only other action: an admin on the wrong account needs
    // a way back, not a way to dismiss this.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("button", { name: /later|skip|dismiss/i })).toHaveCount(0);
  });

  test("does not appear for an account without the flag", async ({ page }) => {
    await openAs(page, false);
    await expect(
      page.getByRole("heading", { name: /Change your email and password/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("navigation").first()).toBeVisible();
  });
});

/* ======================================================================
 * THE SIX-ASSERTION GATE — `CONSOLE-REVAMP.md` §2, at 1440 AND 380, on the
 * screen that sits behind `/signin` and blocks the whole console.
 *
 * Measured in two states: with the form half-filled and BOTH of its hints
 * showing (too short, does not match) -- the state a person is actually in
 * while using it -- and after a successful change, "Credentials changed".
 *
 * The change itself is INTERCEPTED, never sent. The local stack has no
 * Supabase Auth, and a spec that really rewrote an account's credentials
 * would be changing a password to prove a layout.
 * ==================================================================== */

async function withHints(page: Page): Promise<void> {
  await page.getByLabel("New password", { exact: true }).fill("tooshort");
  await page.getByLabel("Confirm new password").fill("different");
  await page.getByText(/do not match/i).waitFor();
}

async function changed(page: Page): Promise<void> {
  await page.route("**/api/v1/console/account/credentials", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"reauthRequired":true}' }),
  );
  await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
  await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
  await page.getByRole("button", { name: "Change and continue" }).click();
  await page.getByRole("heading", { name: /Credentials changed/i }).waitFor({ timeout: 10_000 });
}

test.describe("the gate — CONSOLE-REVAMP.md §2, credential change", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await openAs(page, true);
    await withHints(page);
    expect(await clippedElements(page), "the form, hints showing").toEqual([]);
    await changed(page);
    expect(await clippedElements(page), "credentials changed").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openAs(page, true);
    await withHints(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openAs(page, true);
    await page.getByLabel("New password", { exact: true }).fill("a-much-longer-password-1");
    await page.getByLabel("Confirm new password").fill("a-much-longer-password-1");
    expect(await unreachableByKeyboard(page, "main"), "the form, submittable").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(90_000);
    await openAs(page, true);
    await withHints(page);
    const failures: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme}: ${f}`));
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    await openAs(page, true);
    await withHints(page);
    expect(await offTokenStyles(page), "the form").toEqual([]);
    await changed(page);
    expect(await offTokenStyles(page), "credentials changed").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // Positive control: the same POST readout counts up on this screen too.
    await recordMotion(page);
    await openAs(page, true);
    await page.waitForTimeout(1_200);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the readout should count up").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    await withHints(page);
    await page.waitForTimeout(600);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});
