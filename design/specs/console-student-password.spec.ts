import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * Reset a student's password from their record (instructor ruling, 6 Oct
 * 2026: "both, the console tool first"). `/students/:userId` → Actions →
 * Reset password…; services/api/src/routes/passwords.ts.
 *
 * Locally there is no Supabase project, so the API answers 409 and says so
 * (asserted below, unpatched). The success path is patched with the API's own
 * response shape; the real call is pinned by services/api/test/passwords.spec.ts.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const STUDENT = "dddddddd-1111-4000-8000-000000000006";
const wide = (name: string) => name === "desktop-1440";

function staff(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub: "dddddddd-0000-4000-8000-000000000001", email: "demo@example.com", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role: "teacher" } });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

async function record(page: Page, ok = true): Promise<string[]> {
  const bodies: string[] = [];
  if (ok) {
    await page.route("**/api/v1/console/students/*/password", async (r) => {
      bodies.push(r.request().postData() ?? "");
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ temporaryPassword: "KQ7M-2PZ9-RTAX", studentId: "232129006", fullName: "Kristine Joy Montebon" }) });
    });
  }
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), staff());
  await page.goto(`${CONSOLE_URL}/students/${STUDENT}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-record-facts]").waitFor({ timeout: 15_000 });
  return bodies;
}

async function openReset(page: Page) {
  await page.getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Reset password…" }).click();
  const d = page.getByRole("dialog");
  await expect(d).toBeVisible();
  return d;
}

test.describe("the gate on the dialog", () => {
  test("1-3, 5 · nothing clipped, no sideways scroll, keyboard reachable, tokens: asking, then the password", async ({ page }) => {
    await record(page);
    const d = await openReset(page);
    expect(await clippedElements(page), "asking").toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "[role=dialog]")).toEqual([]);
    expect(await offTokenStyles(page), "asking").toEqual([]);
    await d.getByLabel(/Why/).fill("locked out before the check");
    await d.getByRole("button", { name: "Reset password" }).click();
    await expect(d.locator("[data-temp-password]")).toHaveText("KQ7M-2PZ9-RTAX");
    expect(await clippedElements(page), "the password").toEqual([]);
    expect(await offTokenStyles(page), "the password").toEqual([]);
  });

  test("4 · AA on all three themes, both steps", async ({ page }) => {
    await record(page);
    const d = await openReset(page);
    for (const t of THEMES) {
      await setTheme(page, t);
      expect(await contrastFailures(page), `asking · ${t}`).toEqual([]);
    }
    await d.getByLabel(/Why/).fill("locked out");
    await d.getByRole("button", { name: "Reset password" }).click();
    await expect(d.locator("[data-temp-password]")).toBeVisible();
    for (const t of THEMES) {
      await setTheme(page, t);
      expect(await contrastFailures(page), `password · ${t}`).toEqual([]);
    }
  });
});

test.describe("what the reset owes", () => {
  test("needs a reason; then the password once, in mono, with Copy; Done confirms", async ({ page }, info) => {
    const bodies = await record(page);
    const d = await openReset(page);
    await expect(d).toContainText("must choose their own the next time they sign in");
    const go = d.getByRole("button", { name: "Reset password" });
    await expect(go).toBeDisabled();
    await d.getByLabel(/Why/).fill("locked out before the check");
    await go.click();
    expect(JSON.parse(bodies[0]!)).toEqual({ reason: "locked out before the check" });
    const temp = d.locator("[data-temp-password]");
    await expect(temp).toHaveText("KQ7M-2PZ9-RTAX");
    expect(await temp.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
    await expect(d.locator(".pw-result[role=status]")).toContainText("Temporary password for Kristine Joy Montebon");
    await expect(d).toContainText("not shown again");
    if (wide(info.project.name)) {
      await d.getByRole("button", { name: "Done" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[role=status]", { hasText: "Temporary password set for" })).toBeVisible();
    }
  });

  test("on a server with no Supabase project it says so, and nothing is shown as reset", async ({ page }) => {
    await record(page, false);
    const d = await openReset(page);
    await d.getByLabel(/Why/).fill("locked out");
    await d.getByRole("button", { name: "Reset password" }).click();
    await expect(d.getByRole("alert").filter({ hasText: "Supabase project" })).toBeVisible();
    await expect(d.locator("[data-temp-password]")).toHaveCount(0);
  });

  test("capture: asking and the password, then opened", async ({ page }, info) => {
    await record(page);
    const s = wide(info.project.name) ? "" : "-380";
    const d = await openReset(page);
    await d.getByLabel(/Why/).fill("locked out before the check");
    await page.screenshot({ path: `design/templates/console/students-detail/current-reset-asking${s}.png` });
    await d.getByRole("button", { name: "Reset password" }).click();
    await expect(d.locator("[data-temp-password]")).toBeVisible();
    await page.screenshot({ path: `design/templates/console/students-detail/current-reset-password${s}.png` });
  });
});
