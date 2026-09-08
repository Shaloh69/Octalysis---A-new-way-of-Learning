import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

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
