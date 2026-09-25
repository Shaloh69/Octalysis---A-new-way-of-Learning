import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/audit` — dense first, and the density is asserted, not admired.
 *
 * `DESIGN-REVIEW-01` D-4 taught this on the submissions queue: a sparse layout
 * is not a style choice on a page whose whole purpose is being scanned. This
 * page repeated it. Measured with 24 real entries, the card list cost **109px
 * each**, and the page asks the API for 300 — about 32,600px, roughly 33
 * screens, to find one lock change.
 *
 * `CONSOLE-DATA-AND-TEMPLATES.md` §2 says it outright: "most admins will want
 * the table by default and the timeline as an alternate view, not the reverse
 * — dense-first, same lesson as the submissions-queue fix."
 *
 * A screenshot cannot hold that. A number can, so this file keeps one.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
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
 * A real student that no other spec looks at.
 *
 * THIS SPEC WRITES TO SHARED STATE, and the first version wrote GLOBAL locks —
 * which changed `is_stage_unlocked()` for every student while the solar-system
 * specs were reading the map in parallel. Nine of them failed, and they were
 * right to: the map really had changed underneath them.
 *
 * A user-scope lock produces the same audit rows without touching anyone else's
 * curriculum. `232129021` is seeded by `db/demo-seed.sql` (a deterministic
 * id) and appears in no other spec, so the blast radius is one row of a table
 * nothing asserts on.
 *
 * It used to be `7091eff0-…`, a student from an older seed. Every "open" write
 * to it failed on a foreign key, and every "auto" write deleted nothing and
 * STILL wrote an audit row about a student who did not exist. Those junk rows
 * were what this spec found. The `/locks` session (25 Sep 2026) made the API
 * refuse a lock for anyone not on the roster, which took the junk away and
 * showed the spec had been standing on it. `ensureEntries` now asserts every
 * write, so a missing student fails loudly instead of quietly writing nothing.
 */
const ISOLATED_STUDENT = "dddddddd-1111-4000-8000-000000000021";

/**
 * The audit log is empty in `db/demo-seed.sql`, so this makes its own entries
 * the only honest way — through the real endpoint, which is what writes them.
 * Same fixture gap as attempts; see `PROGRESS.md` F-25.
 */
async function ensureEntries(request: import("@playwright/test").APIRequestContext): Promise<void> {
  for (const stageId of ["01", "02", "03", "04", "05", "06"]) {
    for (const state of ["unlocked", "auto"] as const) {
      const res = await request.post(`${API}/api/v1/console/locks`, {
        headers: { Authorization: `Bearer ${STAFF}`, "Content-Type": "application/json" },
        data: {
          scope: "user",
          userId: ISOLATED_STUDENT,
          stageId,
          state,
          reason:
            state === "unlocked"
              ? "Opened early for the review session before the midterm examination"
              : "Review session finished, returning this chapter to the normal prerequisite chain",
        },
      });
      if (!res.ok()) {
        throw new Error(
          `fixture lock write ${state} ${stageId} got ${res.status()}: ${await res.text()} ` +
            "(is ISOLATED_STUDENT still in the demo seed?)",
        );
      }
    }
  }
}

test.describe("the audit log is scannable", () => {
  test.beforeEach(async ({ page }) => {
    await ensureEntries(page.request);
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("opens as a dense table, not a card list", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "density is a desktop question");

    await page.goto(`${CONSOLE_URL}/audit`, { waitUntil: "domcontentloaded" });
    await page.locator("table tbody tr").first().waitFor();

    // The DEFAULT matters more than the availability. Landing on the sparse
    // view is the bug D-4 named.
    await expect(page.getByRole("button", { name: "table" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const perRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      if (rows.length === 0) return Infinity;
      return rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0) / rows.length;
    });

    /*
     * 41px measured. The bound is 60 so that ordinary padding changes are not a
     * test failure, while the 109px card list -- or anything drifting back
     * toward it -- is.
     */
    expect(perRow, `${Math.round(perRow)}px per entry; the card list was 109px`).toBeLessThan(60);
  });

  test("the reason is never truncated, in either view", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/audit`, { waitUntil: "domcontentloaded" });
    await page.locator("table tbody tr").first().waitFor();

    /*
     * Density is not allowed to cost the reason. It is the field a grade
     * dispute turns on, and making the page scannable was meant to make it
     * FINDABLE -- clipping it would trade away the thing being looked for.
     */
    const full = "returning this chapter to the normal prerequisite chain";
    await expect(page.locator("table")).toContainText(full);

    await page.getByRole("button", { name: "timeline" }).click();
    await expect(page.getByRole("button", { name: "timeline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.locator("table tbody tr").count(), "the table gives way").toBe(0);
    await expect(page.locator("ol")).toContainText(full);
  });

  test("the two views are one log, not two places", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/audit`, { waitUntil: "domcontentloaded" });
    await page.locator("table tbody tr").first().waitFor();
    const rows = await page.locator("table tbody tr").count();

    await page.getByRole("button", { name: "timeline" }).click();
    expect(await page.locator("ol > li").count(), "same entries, drawn differently").toBe(rows);

    // Reversible by the same control, which is the mandate's third test.
    await page.getByRole("button", { name: "table" }).click();
    expect(await page.locator("table tbody tr").count()).toBe(rows);
  });
});
