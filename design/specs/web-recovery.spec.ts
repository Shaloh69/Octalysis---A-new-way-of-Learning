import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { clippedElements, contrastFailures, horizontalOverflow, offTokenStyles, unreachableByKeyboard } from "./_gate";

/**
 * `/forgot-password` and `/reset-password` in the student app (instructor
 * ruling, 6 Oct 2026). Locally there is no Supabase client, so the pages say
 * resets are not available here; the email itself can only be verified on
 * the deployment, once the instructor has set the redirect URL and auth email
 * (docs/NEXT-SESSION.md). What IS verified here: the three states from the
 * address, the token leaving the address bar, validation, and the gate.
 */

const ROUTE = "main";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function gate(page: Page, what: string): Promise<void> {
  expect(await clippedElements(page, ROUTE), `${what} clipped`).toEqual([]);
  expect(await horizontalOverflow(page), `${what} overflow`).toBeLessThanOrEqual(0);
  expect(await unreachableByKeyboard(page, ROUTE), `${what} keyboard`).toEqual([]);
  expect(await contrastFailures(page, ROUTE), `${what} contrast`).toEqual([]);
  expect(await offTokenStyles(page, ROUTE), `${what} tokens`).toEqual([]);
}

test.describe("/forgot-password", () => {
  test("the gate, empty and with a fault", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("[data-reset-request]").waitFor();
    await gate(page, "empty");
    await page.getByRole("button", { name: "Send the link" }).click();
    await expect(page.locator(".title-fault")).toContainText("Type the email");
    await gate(page, "fault");
  });

  test("sign in offers it, and it offers sign in back", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).last().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("on a server with no Supabase settings it says so, and to ask the instructor", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("232129006@example.com");
    await page.getByRole("button", { name: "Send the link" }).click();
    await expect(page.locator(".title-fault")).toContainText("not available on this server");
    await expect(page.locator(".title-fault")).toContainText("instructor");
  });
});

test.describe("/reset-password", () => {
  test("no link in the address: says so, offers a new one", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("[data-reset-state=none]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No reset link here" })).toBeVisible();
    await gate(page, "none");
  });

  test("an expired link: says so, offers a new one", async ({ page }) => {
    await page.goto("/reset-password#error=access_denied&error_code=otp_expired");
    await expect(page.locator("[data-reset-state=expired]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  });

  test("a recovery link: the form, and the token leaves the address bar", async ({ page }) => {
    await page.goto("/reset-password#access_token=secret-token&type=recovery");
    await expect(page.locator("[data-reset-form]")).toBeVisible();
    await expect.poll(() => page.url()).not.toContain("secret-token");
    await gate(page, "form");
  });

  test("checks length and match before anything is sent", async ({ page }) => {
    await page.goto("/reset-password#type=recovery");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Save the new password" }).click();
    await expect(page.locator(".title-fault")).toContainText("at least 10 characters");
    await page.getByLabel("New password", { exact: true }).fill("a-long-enough-one");
    await page.getByLabel("Type it again").fill("a-long-enough-two");
    await page.getByRole("button", { name: "Save the new password" }).click();
    await expect(page.locator(".title-fault")).toContainText("not the same");
  });

  test("capture: the request and the form, then opened", async ({ page }, info) => {
    const s = wide(info) ? "" : "-380";
    await page.goto("/forgot-password");
    await page.locator("[data-reset-request]").waitFor();
    await page.screenshot({ path: `design/templates/web/title/current-forgot${s}.png`, fullPage: !wide(info) });
    await page.goto("/reset-password#type=recovery");
    await page.locator("[data-reset-form]").waitFor();
    await page.screenshot({ path: `design/templates/web/title/current-reset${s}.png`, fullPage: !wide(info) });
  });
});
