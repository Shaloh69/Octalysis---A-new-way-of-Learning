import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/assessments`, `/content`, `/gradebook` — the three teaching pages.
 *
 * ## What was actually wrong
 *
 * Two of the three already cleared the gate. `/content` carries stat tiles, an
 * explanatory callout and a dense chapter table; `/gradebook` carries a class
 * average chart, a CSV export and 41px rows. Neither needed rework, and saying
 * so is part of the job — a template pass that changes a good page to look busy
 * is not a pass.
 *
 * `/assessments` was **the fourth card list**. `/audit` went 109px → 41px per
 * entry, `/items` 122px → 72px, `/submissions` 3,436px → 1,219px
 * (`DESIGN-REVIEW-01` D-4). This page had the same shape for the same reason:
 * two fixture rows look fine as cards, and the real page is one assessment per
 * gradeable chapter plus finals.
 *
 * ## Why these assert content and not layout
 *
 * A density number alone is easy to win by deleting columns, which is why the
 * `/items` bound was once calibrated at 67px against a column that happened to
 * be empty. So each page is checked for the FIELDS it must still carry, and the
 * density bound sits alongside that rather than instead of it.
 *
 * FIXTURE DATA ONLY. Teacher `dddddddd-0000-4000-8000-000000000001`.
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

async function open(page: Page, route: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "networkidle" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
}

/** Mean rendered height of a table row, or Infinity when there is no table. */
async function perRow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    if (rows.length === 0) return Infinity;
    return rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0) / rows.length;
  });
}

test.describe("/assessments — the fourth card list, converted", () => {
  test("is a table, and a dense one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await open(page, "/assessments");
    expect(await page.locator("table").count(), "still a card list").toBeGreaterThan(0);

    /*
     * 41px measured at 1440, against ~98px for the cards it replaced — the same
     * figure `/audit` landed on. The bound is 60 rather than 42 so that adding
     * a second line to a cell is a decision and not a test failure; anything
     * near the old 98 is a regression.
     */
    const px = await perRow(page);
    expect(px, `${Math.round(px)}px per assessment; the card list was ~98px`).toBeLessThan(60);
  });

  test("every field the cards carried is still there", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * The density pass must not be paid for in columns. Each of these was on
     * the card: state, scope, item count, attempts allowed, section, window,
     * and how many have been submitted.
     */
    await open(page, "/assessments");
    const heads = (await page.locator("thead th").allInnerTexts()).join(" ").toLowerCase();
    for (const col of ["status", "assessment", "scope", "items", "attempts", "section", "window", "submitted"]) {
      expect(heads, `the ${col} column was dropped in the density pass`).toContain(col);
    }

    const body = (await page.locator("tbody").innerText()).toLowerCase();
    expect(body, "the open/closed state stopped rendering").toMatch(/open|closed|not open yet/);
    expect(body, "scope stopped rendering").toMatch(/stage \d+|final/);
  });

  test("the empty state explains what a student sees without one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * Reachable only when the fixture has no assessments, so this SKIPS on the
     * seeded database rather than forcing the state. Recorded because the copy
     * is unusually good and worth protecting if it ever becomes reachable:
     * "until one exists, a student has nothing to sit".
     */
    await open(page, "/assessments");
    const empty = page.locator("text=/no assessments yet/i");
    if ((await empty.count()) === 0) {
      test.skip(true, "the fixture has assessments; the empty view is not reachable");
      return;
    }
    await expect(page.locator("body")).toContainText(/nothing to sit/i);
  });
});

test.describe("/content — where each chapter stands", () => {
  test("tells the truth about how much is written", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * Hard rule 5 is "never invent course content", and this page is its
     * dashboard: 8 of 19 chapters authored, the rest carrying objectives and an
     * outline only. A console that rounded that up to "19 chapters" would make
     * the gap invisible to the one person who can close it.
     */
    await open(page, "/content");

    const text = await page.locator("main").innerText();
    expect(text, "the authored-vs-total count is missing").toMatch(/\d+\s*\/\s*19/);
    expect(text.toLowerCase()).toContain("planned");

    // And the per-chapter table, with a status for each of the 19.
    const rows = await page.locator("table tbody tr").count();
    expect(rows, "every chapter should have a row").toBeGreaterThanOrEqual(19);
  });

  test("is dense enough to scan 19 chapters", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");
    await open(page, "/content");
    const px = await perRow(page);
    expect(px, `${Math.round(px)}px per chapter`).toBeLessThan(60);
  });
});

test.describe("/gradebook — mastery per stage", () => {
  test("exports, and names every gradeable chapter", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * `CONSOLE-DATA-AND-TEMPLATES.md` calls this "a genuinely standard
     * data-export table", so the export is the feature and not a nicety — a
     * gradebook a teacher cannot get out of the browser is a gradebook they
     * will retype.
     */
    await open(page, "/gradebook");

    await expect(page.getByRole("button", { name: /download|export|csv/i })).toBeVisible();

    // One column per gradeable chapter, 01-18. Stage 00 is not gradeable.
    const heads = (await page.locator("thead th").allInnerTexts()).join(" ");
    for (const stage of ["01", "09", "18"]) {
      expect(heads, `stage ${stage} has no column`).toContain(stage);
    }
  });

  test("says what a low column MEANS, rather than only drawing it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * The chart carries a sentence: "A stage where the whole class sits low is a
     * signal about the teaching, not about the students."
     *
     * That line is the difference between a chart and a judgement about a
     * teacher, and it is the kind of copy that gets deleted as decoration by
     * someone who did not know it was load-bearing.
     */
    await open(page, "/gradebook");
    await expect(page.locator("main")).toContainText(/about the teaching, not about the students/i);
  });
});
