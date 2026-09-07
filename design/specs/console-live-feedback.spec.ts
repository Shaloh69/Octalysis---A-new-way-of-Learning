import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/live` and `/feedback` — the last two console routes R3.3 covers.
 *
 * ## `/live` makes two claims, and both are testable
 *
 * The page prints them itself:
 *
 *   "No name, student ID, or user ID is ever loaded for this view — not
 *    filtered out here, never fetched. A field that is not loaded cannot leak."
 *
 *   "…the server withholds the numbers rather than this page hiding them."
 *
 * Those are architecture claims, not copy. The first is the same shape as hard
 * rule 1: the guarantee lives in what the payload does not contain, so it is
 * checked against the payload and not against the rendering. The second says the
 * k-anonymity threshold is enforced server-side, which means a student count
 * below the threshold must arrive with no breakdown attached — a page that
 * merely declined to draw one would leak to anyone opening devtools.
 *
 * ## Why `/live` cannot be captured with `networkidle`
 *
 * It holds an open request for as long as it is on screen (`PROGRESS.md`
 * records this), so `waitUntil: "networkidle"` never resolves. Every wait here
 * is `domcontentloaded` plus an explicit locator. That is the reason this route
 * was skipped by earlier passes.
 *
 * FIXTURE DATA ONLY. Teacher `dddddddd-0000-4000-8000-000000000001`.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const API_URL = process.env.OCTA_API_URL ?? "http://localhost:8090";

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
  // NOT networkidle -- see the header. /live never goes idle.
  await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
}

test.describe("/live — anonymity is a property of the payload", () => {
  test("no identifier is ever fetched for this view", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "not a viewport concern");

    /*
     * Asserted against the API rather than the page, because the page's own
     * claim is that the fields are NEVER LOADED. Checking the rendering would
     * only prove they are not displayed, which is a different and much weaker
     * statement — the DOM can hide what the network already delivered.
     */
    const res = await request.get(`${API_URL}/api/v1/console/live`, {
      headers: { Authorization: `Bearer ${TEACHER}` },
    });
    expect(res.ok(), "the live endpoint did not answer a teacher").toBe(true);

    const body = await res.text();
    for (const field of [
      /"student_?id"/i,
      /"user_?id"/i,
      /"full_?name"/i,
      /"email"/i,
      /"reporter_?name"/i,
    ]) {
      expect(
        body,
        `the live payload carries ${field} — "a field that is not loaded cannot leak" is no longer true`,
      ).not.toMatch(field);
    }
  });

  test("suppression is the SERVER withholding, not the page declining to draw", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "not a viewport concern");

    /*
     * The fixture has fewer than five students working, so the threshold is
     * active. What must be true is that the breakdown is ABSENT from the
     * response — not present-and-unrendered. A page that merely declined to
     * draw it would leak to anyone who opened the network tab.
     */
    const res = await request.get(`${API_URL}/api/v1/console/live`, {
      headers: { Authorization: `Bearer ${TEACHER}` },
    });
    const json = (await res.json()) as Record<string, unknown>;

    const suppressed =
      json.suppressed === true ||
      JSON.stringify(json).toLowerCase().includes("suppress");

    if (!suppressed) {
      test.skip(true, "five or more students are working; the threshold is not active");
      return;
    }

    /*
     * IDENTIFYING KEYS, not the substring "student".
     *
     * The first draft searched the serialised row for /student|user|name|email/
     * and failed on `{ stageId: "01", students: 21, avgMastery: 64 }` — which is
     * an AGGREGATE COUNT and precisely what this page exists to show. The test
     * was wrong, not the payload.
     *
     * What must be absent is a field that identifies a person. A count of
     * people is the opposite of that: it is the anonymisation.
     */
    const IDENTIFYING = /^(student_?id|user_?id|profile_?id|full_?name|name|email|callsign)$/i;

    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        expect(
          IDENTIFYING.test(k),
          `${path}.${k} identifies a person, and suppression is on`,
        ).toBe(false);
        walk(v, `${path}.${k}`);
      }
    };
    walk(json, "live");
  });

  test("the page explains the suppression rather than just showing a blank", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * An empty dashboard reads as broken. This one names the rule, the reason
     * and who enforces it, which is the difference between a teacher trusting
     * the tool and filing a bug.
     */
    await open(page, "/live");

    const main = page.locator("main");
    await expect(main).toContainText(/fewer than \d+ people/i);
    await expect(main, "the page should say the SERVER withholds it").toContainText(
      /server withholds/i,
    );
    await expect(main).toContainText(/not loaded cannot leak/i);
  });
});

test.describe("/feedback — the triage queue", () => {
  test("is a table, and dense enough to scan", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await open(page, "/feedback");
    expect(await page.locator("table").count(), "still a card list").toBeGreaterThan(0);

    /*
     * ~54px per report, against ~172px as cards; the page went 2,240px to
     * 991px. The bound is 90 so a second line in a cell is a decision rather
     * than a failure, while anything near the old 172 is a regression.
     */
    const px = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      if (rows.length === 0) return Infinity;
      return rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0) / rows.length;
    });
    expect(px, `${Math.round(px)}px per report; the card list was ~172px`).toBeLessThan(90);
  });

  test("a report expands in place to the exact instance the student saw", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * THE REASON THIS EXPANDS RATHER THAN LINKING AWAY. Every student gets
     * different numbers, so "question 7 is wrong" is unactionable; the report
     * only becomes work when the teacher can see the instance that student was
     * looking at. One click from the queue, not a page away.
     *
     * The variant panel itself may be empty on the fixtures — INV-25 warns that
     * five seeded content_report rows have no `item_id` or `resolved_variant` —
     * so what is asserted is that the row OPENS and offers triage, not that a
     * variant is rendered.
     */
    await open(page, "/feedback");

    const before = await page.locator("tbody tr").count();
    const triage = page.getByRole("button", { name: /^triage$/i }).first();
    await triage.waitFor({ timeout: 10_000 });
    await triage.click();

    await expect(page.locator("tbody tr")).toHaveCount(before + 1);
    await expect(page.locator("tbody")).toContainText(/move to/i);

    // One at a time: opening a second closes the first.
    const second = page.getByRole("button", { name: /^triage$/i }).first();
    if ((await second.count()) > 0) {
      await second.click();
      await expect(
        page.locator("tbody tr"),
        "two reports were open at once; a triage queue is worked down, not compared",
      ).toHaveCount(before + 1);
    }
  });

  test("the SUS panel says why it is empty rather than showing a zero", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * A SUS score of 0 would be a lie — 68 is the published average and 0 would
     * read as catastrophic rather than as absent. The panel says the survey has
     * not been shown yet, and names the rule that governs when it will be.
     */
    await open(page, "/feedback");
    const sus = page.locator("text=/usability \\(sus\\)/i").locator("xpath=ancestor::*[3]");
    const text = await sus.first().innerText().catch(() => "");
    const body = text || (await page.locator("main").innerText());

    expect(body, "an empty SUS panel should explain itself").toMatch(
      /no responses yet|not enough|appears only after/i,
    );
    expect(body, "it should not render a bare zero as a score").not.toMatch(/\bSUS\s*[:=]?\s*0\b/);
  });
});
