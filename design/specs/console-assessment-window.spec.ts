import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/assessments` — setting the exam window.
 *
 * The instructor's ruling was that opening and closing dates are decided in the
 * console. That was not possible: `routes/assessments.ts` offered only GET and
 * POST, so an assessment seeded without dates was open forever and one created
 * with them could never be extended — while the file's own closing comment
 * claimed "closing it is a `closes_at` in the past; that is the supported way to
 * end one".
 *
 * The route exists now and is denial-tested in `assessments.spec.ts`. This spec
 * covers the half that lives in the browser, because a guarded endpoint with no
 * caller is not a feature a teacher has.
 *
 * FIXTURE DATA. Prelim and Midterm come from `scripts/sync-assessments.mjs`, and
 * the spec restores whatever window it found so a run leaves no trace.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "teacher@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const TEACHER = teacherToken();

test.describe("the exam window, from the console", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await page.goto(`${CONSOLE_URL}/assessments`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ timeout: 15_000 });
  });

  test("a seeded exam says plainly that it is open with no window", async ({ page }) => {
    const row = page.getByRole("row").filter({ hasText: "Prelim Examination" }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    // Five attempts, every section, no window — the instructor's ruling, on screen.
    await expect(row).toContainText("every section");
    await expect(row).toContainText("no window");

    await row.getByRole("button", { name: "Set window" }).click();
    const dialog = page.getByRole("dialog");
    /*
     * The warning is the point. A NULL bound is no bound and engine-repo.ts
     * enforces exactly that, so "no dates" means "open to everyone right now" —
     * which is a thing a teacher should be told rather than left to infer.
     */
    await expect(dialog).toContainText(/open now/i);
    await dialog.screenshot({ path: "design/item-review/assessment-window.png" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("the reason is required before the window can be saved", async ({ page }) => {
    const row = page.getByRole("row").filter({ hasText: "Prelim Examination" }).first();
    await row.getByRole("button", { name: "Set window" }).click();

    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Save window" });
    await expect(save).toBeDisabled();

    await dialog.getByLabel("Reason").fill("Prelim week");
    await expect(save).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("setting a window persists it, and clearing it restores no window", async ({ page }) => {
    const row = () => page.getByRole("row").filter({ hasText: "Prelim Examination" }).first();

    await row().getByRole("button", { name: "Set window" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("2026-10-01T08:00");
    await dialog.getByLabel("Closes").fill("2026-10-08T17:00");
    await dialog.getByLabel("Reason").fill("Prelim week, department calendar");
    await dialog.getByRole("button", { name: "Save window" }).click();

    // The row must reflect it without a manual refresh.
    await expect(row()).toContainText(/opens/i, { timeout: 15_000 });
    await expect(row()).not.toContainText("no window");

    // Put it back, which also exercises the null-clears-a-bound path.
    await row().getByRole("button", { name: "Set window" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("");
    await dialog.getByLabel("Closes").fill("");
    await dialog.getByLabel("Reason").fill("restoring the fixture");
    await dialog.getByRole("button", { name: "Save window" }).click();

    await expect(row()).toContainText("no window", { timeout: 15_000 });
  });

  test("a window that closes before it opens is refused, and says so", async ({ page }) => {
    const row = page.getByRole("row").filter({ hasText: "Midterm Examination" }).first();
    await row.getByRole("button", { name: "Set window" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("2026-11-01T08:00");
    await dialog.getByLabel("Closes").fill("2026-10-01T08:00");
    await dialog.getByLabel("Reason").fill("deliberately backwards");
    await dialog.getByRole("button", { name: "Save window" }).click();

    // The server refuses, and the dialog stays open carrying the reason why.
    await expect(dialog.getByRole("alert")).toContainText(/close before it opens/i, {
      timeout: 15_000,
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
