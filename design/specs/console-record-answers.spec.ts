import { test, expect, type Page, type Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import { ATTEMPT, ATTEMPTS, patchDetail, STUDENT_SUB, type StudentDetail } from "./_student-detail-fixture";

/**
 * A real attempt must not blank the console (8 Oct 2026).
 *
 * On the deployment, opening an attempt on a student's record turned the whole
 * console into an empty dark page. The answer route stores what the student app
 * sends, an OBJECT (`{ index }`, `{ value }` or `{ order }`); the drill-down
 * passed it through; the page read a string and gave the object to React as a
 * child ("Objects are not valid as a React child"); and with no error boundary,
 * React unmounted everything. Every earlier test seeded a string, and the one
 * test that used a real attempt skips wherever no question is live (here, always).
 *
 * So this stubs the attempt with the shapes production sent, and proves two
 * things: the page draws them as text, and a page that DOES fail to render says
 * so while the menu stays.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function mintStaff(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  return `${header}.${payload}.${createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}
const STAFF = mintStaff();

const item = (ordinal: number, type: "S" | "G" | "P", options: string[], answer: unknown, key: string) => ({
  ordinal, type, stageId: "01", objectiveId: "01.1", stem: `Question ${ordinal}: the stem.`, options,
  resolvedParams: null, correctValue: key, rationale: "Because.", studentAnswer: answer,
  isCorrect: true, timeMs: 4200,
});

/** The attempt exactly as the API used to send it: the stored answer objects, untouched. */
const OLD_SHAPE = {
  attemptId: ATTEMPT.submitted, status: "submitted", engineVersion: "1.0.0",
  student: { userId: STUDENT_SUB, studentId: "232129006", fullName: "Kristine Joy Montebon" },
  assessmentTitle: "Stage 01 Check", scope: "stage", attemptNo: 2,
  startedAt: "2026-09-24T08:00:00.000Z", submittedAt: "2026-09-24T08:14:32.000Z", score: 2, maxScore: 3,
  events: [],
  items: [
    item(1, "S", ["A compiler", "An assembler", "A linker"], { index: 1 }, "An assembler"),
    item(2, "G", ["load", "decode", "execute"], { order: ["decode", "load", "execute"] }, "load | decode | execute"),
    item(3, "P", ["16", "32", "64"], { value: 32 }, "32"),
  ],
};

async function open(page: Page, attempt: unknown): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  await page.route(`**/api/v1/console/students/${STUDENT_SUB}`, async (route: Route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: patchDetail((await res.json()) as StudentDetail, { attempts: ATTEMPTS }) });
  });
  await page.route("**/api/v1/console/attempts/*", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(attempt) }),
  );
  await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });
  await page.locator(`[data-attempt="${ATTEMPT.submitted}"]`).first().waitFor({ timeout: 25_000 });
}

/** The console's menu: always there at 1440, a sheet behind "Open menu" at 380. */
async function menuLink(page: Page, name: string) {
  const opener = page.getByRole("button", { name: "Open menu" });
  if (await opener.isVisible()) await opener.click();
  return page.getByRole("link", { name });
}

const toggle = (page: Page) =>
  page.locator(`[data-attempt="${ATTEMPT.submitted}"] button[aria-expanded]`).first();

test.describe("opening a real attempt", () => {
  test("an answer stored as an object is drawn as text, and the page stays", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, OLD_SHAPE);
    await toggle(page).click();
    const paper = page.locator(".record-paper");
    await expect(paper).toBeVisible();
    // The picked option, the sequence, the typed value: all text, all on the page.
    await expect(paper.locator('[data-item="1"] [data-picked]')).toContainText("An assembler");
    await expect(paper.locator('[data-item="2"] [data-answered]')).toContainText("decode");
    await expect(paper.locator('[data-item="3"]')).toContainText("32");
    await expect(page.locator("[data-page-error]")).toHaveCount(0);
    // the menu is still there
    await expect(await menuLink(page, "Locks")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the same on the attempt's own page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
    await page.route("**/api/v1/console/attempts/*", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OLD_SHAPE) }),
    );
    await page.goto(`${CONSOLE_URL}/attempts/${ATTEMPT.submitted}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toContainText("Stage 01 Check", { timeout: 25_000 });
    await expect(page.locator("[data-page-error]")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("a page that fails to render says so, and the console stays", () => {
  test("a payload the page cannot draw shows the error panel, with the menu and a way out", async ({ page }) => {
    const seen: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") seen.push(m.text()); });
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
    await page.route(`**/api/v1/console/students/${STUDENT_SUB}`, async (route: Route) => {
      const res = await route.fetch();
      const d = (await res.json()) as StudentDetail;
      // A stage whose moons are null: `s.objectives.map` throws while rendering.
      d.moons = [{ stageId: "01", title: "Introduction", mastered: 0, total: 1, objectives: null as never }];
      await route.fulfill({ response: res, json: d });
    });
    await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-moons]").waitFor({ timeout: 25_000 });
    await page.locator(".record-moons-toggle").first().click();

    const panel = page.locator("[data-page-error]");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("role", "alert");
    await expect(panel).toContainText("This page hit a problem");
    await expect(panel.getByRole("button", { name: "Reload the page" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Go back" })).toBeVisible();
    // Never a stack trace on the page.
    expect(await panel.innerText()).not.toMatch(/TypeError|at \w+ \(|\.tsx?:\d+/);
    // The rest of the console is alive: the menu is there and works.
    const locks = await menuLink(page, "Locks");
    await expect(locks).toBeVisible();
    await locks.click();
    await expect(page).toHaveURL(/\/locks/);
    await expect(page.locator("[data-page-error]")).toHaveCount(0);
    expect(seen.join("\n")).toContain("page failed to render");
  });
});
