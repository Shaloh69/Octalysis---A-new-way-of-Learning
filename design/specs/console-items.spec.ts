import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/items` — the question bank, dense, with the psychometric warnings intact.
 *
 * `CONSOLE-DATA-AND-TEMPLATES.md` §2 names this page and the submissions queue
 * as "the same shape", to be "solved together against the same reference rather
 * than separately by taste". D-4 fixed the queue; this page was still a card
 * list at **122px per item** — about 4,000px for 33 items, and the bank targets
 * roughly 40 live items per gradeable chapter, so ~700 items and ~85,000px at
 * full size.
 *
 * The density is asserted here as a number, because a screenshot cannot hold
 * one and taste drifts.
 *
 * THE POINT OF THE PAGE MUST SURVIVE THE DENSITY PASS. A negative
 * point-biserial means the students who did best on the paper did worst on this
 * item — almost always a wrong key. That sentence is why a teacher opens this
 * page, and compressing it into a colour would have been the density pass
 * eating the thing it was meant to surface.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function staffToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STAFF = staffToken();

/**
 * Skip, with the reason, when the item bank is empty.
 *
 * **F-41: nothing in this repository seeds `items`.** `db/demo-seed.sql` has no
 * insert for them, `sync-content.mjs` does not touch them, and the content files
 * carry none — so a clean `pnpm db:reset` leaves the bank at ZERO. The rows this
 * spec was written against were live-database artefacts that a reset destroys.
 *
 * The page is not broken when the bank is empty; it is correctly empty. Failing
 * here would send the next person hunting a regression in code that is fine, so
 * these skip and name the finding instead.
 */
async function bankIsEmpty(page: Page): Promise<boolean> {
  const rows = await page.locator("table tbody tr").count();
  return rows === 0;
}

test.describe("the item bank is scannable", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("is a table, and a dense one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "density is a desktop question");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    const perRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      if (rows.length === 0) return Infinity;
      return rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0) / rows.length;
    });

    /*
     * 72px measured at 1440, against 122px for the card list it replaced.
     *
     * The first bound here was calibrated at 67px -- measured while the
     * database was missing its objectives, so that whole column was empty. With
     * real data the rows were 98px, which against 122px is a rounding error
     * rather than a density pass. The objective sentence is now clamped to two
     * lines (full text on hover) and the stem given room, which is what bought
     * the actual improvement.
     *
     * MEASURE ON REAL DATA. A bound calibrated against an empty column is a
     * bound that passes and means nothing.
     */
    expect(perRow, `${Math.round(perRow)}px per item; the card list was 122px`).toBeLessThan(95);
  });

  test("states the 30-exposure rule once, not on every row", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    /*
     * The first version printed "not enough exposures… around 30" in EVERY row,
     * which on a fresh bank is every row — 22 copies of one sentence, and the
     * single biggest contributor to row height. Repeating an explanation per
     * row is how a density pass quietly gives back what it won.
     */
    const copies = await page.evaluate(
      () => (document.body.innerText.match(/do not mean anything yet/g) ?? []).length,
    );
    expect(copies, "the rule belongs above the table, once").toBe(1);
  });

  test("a bad item still says what is wrong with it, in words", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    /*
     * `db/demo-seed.sql` seeds exactly one item with real psychometrics, for
     * this: before it, every item had zero exposures, so the branch a teacher
     * opens this page FOR could not be seen, screenshotted or reviewed at all.
     */
    const row = page.locator("table tbody tr", { hasText: "flagged" }).first();
    await expect(row).toBeVisible();

    // Colour is never the only signal -- the sentence is the signal.
    await expect(row).toContainText("the key is probably wrong");
    await expect(row).toContainText("at guessing");

    // And the numbers behind it are in mono, per the type roles.
    await expect(row.locator(".num").first()).toBeVisible();
  });

  test("every column the cards carried is still there", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    // A density pass that drops a field is not a density pass, it is a deletion.
    // Compared case-insensitively: `allInnerTexts` returns RENDERED text, and
    // these headers are uppercased in CSS, so a literal "Item" never matches.
    const headers = (await page.locator("table thead th").allInnerTexts()).join(" | ").toLowerCase();
    for (const col of ["item", "stem", "objective", "exposures", "discrimination"]) {
      expect(headers, `${col} must survive`).toContain(col);
    }

    const first = await page.locator("table tbody tr").first().innerText();
    expect(first, "slug, version, stage, type and bloom all still shown").toMatch(
      /v\d+.*stage \d{2}/s,
    );
  });
});
