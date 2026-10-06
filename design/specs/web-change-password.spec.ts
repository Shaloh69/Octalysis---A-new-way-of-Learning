import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import { clippedElements, contrastFailures, horizontalOverflow, offTokenStyles, unreachableByKeyboard } from "./_gate";

/**
 * Choose a new password (6 Oct 2026): after the instructor gives a temporary
 * one from the console, the account carries `must_change_password`, and the
 * student app shows this screen INSTEAD of the app until it is done
 * (App.tsx RequireSession; pages/AuthPages.tsx ChangePasswordPage).
 *
 * Locally the API answers 409 (no Supabase project); the success path is
 * patched with the API's own response. The route is pinned by
 * services/api/test/passwords.spec.ts.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const ROUTE = "main";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

function token(flag: boolean): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "232129006@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129006", ...(flag ? { must_change_password: true } : {}) },
  });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

async function arrive(page: Page, patch = true): Promise<string[]> {
  const bodies: string[] = [];
  if (patch) {
    await page.route("**/api/v1/account/password", async (r) => {
      bodies.push(r.request().postData() ?? "");
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reauthRequired: true }) });
    });
  }
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem("octa:test-signed")) {
      localStorage.setItem("octa:dev-token", t as string);
      sessionStorage.setItem("octa:test-signed", "1");
    }
  }, token(true));
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page.locator("[data-change-password]").waitFor({ timeout: 15_000 });
  return bodies;
}

test.describe("the gate", () => {
  test("1-3, 5 · nothing clipped, no sideways scroll, keyboard reachable, tokens", async ({ page }) => {
    await arrive(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, ROUTE)).toEqual([]);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("4 · AA computed, with a fault showing", async ({ page }) => {
    await arrive(page);
    await page.getByRole("button", { name: "Save and sign in again" }).click();
    await expect(page.locator(".title-fault")).toBeVisible();
    expect(await contrastFailures(page, ROUTE)).toEqual([]);
  });
});

test.describe("what it owes", () => {
  test("a flagged account sees this instead of the app: no map, no tabs", async ({ page }) => {
    await arrive(page);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(page.locator("nav[aria-label=Main]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("too short, or not the same twice: it says which, and sends nothing", async ({ page }) => {
    const bodies = await arrive(page);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Save and sign in again" }).click();
    await expect(page.locator(".title-fault")).toContainText("at least 10 characters");
    await page.getByLabel("New password", { exact: true }).fill("a-long-enough-one");
    await page.getByLabel("Type it again").fill("a-long-enough-two");
    await page.getByRole("button", { name: "Save and sign in again" }).click();
    await expect(page.locator(".title-fault")).toContainText("not the same");
    expect(bodies).toEqual([]);
  });

  test("saved: sends only the password, signs out, and says to sign in again", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const bodies = await arrive(page);
    await page.getByLabel("New password", { exact: true }).fill("a-long-enough-one");
    await page.getByLabel("Type it again").fill("a-long-enough-one");
    await page.getByRole("button", { name: "Save and sign in again" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(bodies.map((b) => JSON.parse(b))).toEqual([{ password: "a-long-enough-one" }]);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Password changed");
    expect(await page.evaluate(() => localStorage.getItem("octa:dev-token"))).toBeNull();
  });

  test("with no Supabase project the server says so, and the student stays here", async ({ page }) => {
    await arrive(page, false);
    await page.getByLabel("New password", { exact: true }).fill("a-long-enough-one");
    await page.getByLabel("Type it again").fill("a-long-enough-one");
    await page.getByRole("button", { name: "Save and sign in again" }).click();
    await expect(page.locator(".title-fault")).toContainText("Supabase project");
    await expect(page.locator("[data-change-password]")).toBeVisible();
  });

  test("an account without the flag goes straight to the app", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), token(false));
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page.locator("nav[aria-label=Main]")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-change-password]")).toHaveCount(0);
  });

  test("capture: current, then opened", async ({ page }, info) => {
    await arrive(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `design/templates/web/title/current-change-password${wide(info) ? "" : "-380"}.png`, fullPage: !wide(info) });
  });
});
