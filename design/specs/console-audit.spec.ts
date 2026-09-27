import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, useFixture, type FixtureOpts } from "./_audit-fixture";

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

/* ======================================================================
 * Rebuilt 28 Sep 2026 against `design/templates/console/audit/SPEC.md`:
 * the instructor's rulings of that day (filters on the server over the whole
 * log, 100 a page with Load older, a CSV of every match) and the page's own
 * claim, now true in the database (append-only; `rls.spec.ts`).
 *
 * Reads are the real seeded log (`db/demo-audit.sql`) plus four entries the
 * seed must not claim, patched into the unfiltered first page only
 * (`_audit-fixture.ts`). Every filtered read, Load older and the export are
 * the API's own answers.
 * ==================================================================== */

const wide = (name: string) => name === "desktop-1440";

/** `ISOLATED_STUDENT`, as `db/demo-seed.sql` names them. */
const ISOLATED_NAME = "Jose Mari Paglinawan-Reyes";

async function openAudit(page: Page, opts: FixtureOpts = {}, query = "") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/audit${query}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs) await page.locator("[data-entry]").first().waitFor({ timeout: 15_000 });
  return fx;
}

const entry = (page: Page, id: string) => page.locator(`[data-entry="${id}"]`);

async function openDetails(page: Page, id: string) {
  const button = entry(page, id).getByRole("button", { name: /^Details/ });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`[data-details="${id}"]`)).toBeVisible();
}

async function showTimeline(page: Page) {
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.getByRole("button", { name: "Timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
}

/** Wait for the page to have read the log with this parameter, and settle. */
async function readWith(page: Page, reads: URL[], key: string, value?: string) {
  await expect
    .poll(() => reads.some((u) => u.searchParams.has(key) && (value === undefined || u.searchParams.get(key) === value)))
    .toBe(true);
  await expect(page.locator("[data-loading]")).toHaveCount(0);
}

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: the log, an entry's details, the timeline, an empty filter", async ({ page }) => {
    await openAudit(page);
    expect(await clippedElements(page), "the log").toEqual([]);
    await openDetails(page, "990000002");
    expect(await clippedElements(page), "details").toEqual([]);
    await showTimeline(page);
    expect(await clippedElements(page), "timeline").toEqual([]);
    await page.getByLabel("About whom or what", { exact: true }).fill("zz-nobody-by-this-name");
    await page.getByLabel("About whom or what", { exact: true }).press("Enter");
    await expect(page.locator("[data-empty]")).toBeVisible();
    expect(await clippedElements(page), "empty filter").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openAudit(page);
    expect(await horizontalOverflow(page), "the log").toBeLessThanOrEqual(0);
    await openDetails(page, "990000002");
    expect(await horizontalOverflow(page), "details").toBeLessThanOrEqual(0);
    await showTimeline(page);
    expect(await horizontalOverflow(page), "timeline").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone, and Details keeps focus", async ({ page }) => {
    await openAudit(page);
    expect(await unreachableByKeyboard(page, "main"), "the log").toEqual([]);
    const button = entry(page, "990000002").getByRole("button", { name: /^Details/ });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toBeFocused();
    expect(await unreachableByKeyboard(page, "main"), "details open").toEqual([]);
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await showTimeline(page);
    expect(await unreachableByKeyboard(page, "main"), "timeline").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openAudit(page);
    await openDetails(page, "990000002");
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: the log`).toEqual([]);
    }
    await showTimeline(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: timeline`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openAudit(page);
    await openDetails(page, "990000002");
    expect(await offTokenStyles(page), "the log").toEqual([]);
    await showTimeline(page);
    expect(await offTokenStyles(page), "timeline").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, Details eases open.
    await recordMotion(page);
    await openAudit(page);
    await openDetails(page, "990000002");
    const moving = await motionStarted(page, "main");
    expect(moving.length, "with motion allowed, Details should ease open").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-entry]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openDetails(page, "990000002");
    await showTimeline(page);
    await page.getByRole("button", { name: "Table", exact: true }).click();
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

test.describe("the evidence: every entry in words", () => {
  test("a content edit names its stage, block and versions, and never shows a UUID in the row", async ({ page }) => {
    await openAudit(page);
    const row = entry(page, "990000004");
    await expect(row).toContainText("Edited block 3 of stage 01 (version 1 to 2)");
    await expect(row).toContainText(FIX.editReason);
    await expect(row.locator("[data-fact=what]")).not.toContainText("0b10c000");
  });

  test("an approval shows the exact text approved, in full", async ({ page }) => {
    await openAudit(page);
    await expect(entry(page, "990000002")).toContainText("Approved the summary for stage 01");
    await openDetails(page, "990000002");
    await expect(page.locator('[data-details="990000002"]')).toContainText(FIX.approvedText);
  });

  test("a send-back says it took the summary off students' screens, and why", async ({ page }) => {
    await openAudit(page);
    const row = entry(page, "990000003");
    await expect(row).toContainText("taking it off students' screens");
    await expect(row).toContainText(FIX.sendBackReason);
  });

  test("an entry no person made says so: System (scheduled)", async ({ page }) => {
    await openAudit(page);
    await expect(entry(page, "990000001").locator("[data-fact=who]")).toHaveText("System (scheduled)");
  });

  test("dates carry the time, in mono", async ({ page }) => {
    await openAudit(page);
    const time = entry(page, "990000004").locator("time").first();
    await expect(time).toHaveText(/\d{1,2}:\d{2}/);
    expect(await time.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono/i);
  });

  test("no control edits, removes or clears an entry", async ({ page }) => {
    await openAudit(page);
    await openDetails(page, "990000002");
    const names = await page
      .locator("main")
      .getByRole("button")
      .evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()));
    // A Details button only discloses; its label carries the entry's own sentence ("Details: Edited block 3 ..").
    const tampering = names
      .filter((n) => !n.startsWith("Details:"))
      .filter((n) => /delete|remove|edit|erase|clear(?! filters)/i.test(n));
    expect(tampering, "a log a teacher can tidy proves nothing").toEqual([]);
  });
});

test.describe("filters run on the server, over the whole log", () => {
  test("action: the request carries it, the address keeps it, a reload restores it", async ({ page }) => {
    const { reads } = await openAudit(page);
    await page.getByLabel("Action", { exact: true }).selectOption("locks");
    await readWith(page, reads, "family", "locks");
    await expect(page).toHaveURL(/[?&]family=locks/);
    const families = await page.locator("[data-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-family")));
    expect(families.length).toBeGreaterThan(0);
    expect(new Set(families)).toEqual(new Set(["locks"]));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-entry]").first().waitFor({ timeout: 15_000 });
    await expect(page.getByLabel("Action", { exact: true })).toHaveValue("locks");
  });

  test("who: System (scheduled) is a choice, and an empty result says what was asked", async ({ page }) => {
    const { reads } = await openAudit(page);
    await page.getByLabel("Who", { exact: true }).selectOption({ label: "System (scheduled)" });
    await readWith(page, reads, "actor", "system");
    // The seed has no scheduled windows (demo-audit.sql says why), so the API answers none.
    await expect(page.locator("[data-empty]")).toContainText("System (scheduled)");
    // The empty state carries its own way out, beside the toolbar's.
    await page.locator("[data-empty]").getByRole("button", { name: "Clear filters" }).click();
    await page.locator("[data-entry]").first().waitFor();
    await expect(page).not.toHaveURL(/actor=/);
  });

  test("search finds a student by name, including a lock that names them only in its payload", async ({ page }) => {
    await ensureEntries(page.request);
    const { reads } = await openAudit(page);
    await page.getByLabel("About whom or what", { exact: true }).fill(ISOLATED_NAME);
    await page.getByLabel("About whom or what", { exact: true }).press("Enter");
    await readWith(page, reads, "q", ISOLATED_NAME);
    const rows = page.locator("[data-entry]");
    expect(await rows.count()).toBeGreaterThan(0);
    for (const text of await rows.allInnerTexts()) expect(text).toContain(ISOLATED_NAME);
  });

  test("from and to bound the dates, inclusive, in the teacher's time zone", async ({ page }) => {
    await ensureEntries(page.request);
    const { reads } = await openAudit(page);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    await page.getByLabel("From", { exact: true }).fill(today);
    await page.getByLabel("To", { exact: true }).fill(today);
    await readWith(page, reads, "to");
    const sent = reads.filter((u) => u.searchParams.has("to")).at(-1)!;
    const [from, to] = [sent.searchParams.get("from")!, sent.searchParams.get("to")!];
    expect(Date.parse(to) - Date.parse(from), "one local day, midnight to midnight").toBe(86_400_000);
    const days = await page.locator("[data-entry] time").evaluateAll((els) =>
      els.map((e) => new Date(e.getAttribute("datetime")!).toDateString()),
    );
    expect(days.length).toBeGreaterThan(0);
    expect(new Set(days)).toEqual(new Set([new Date(Date.parse(from) + 1).toDateString()]));
  });

  test("Load older extends the log backwards, repeats nothing, and says when it has reached the start", async ({ page }) => {
    test.setTimeout(90_000);
    const { reads } = await openAudit(page);
    const before = await page.locator("[data-entry]").count();
    expect(before, "the seeded log is more than one page").toBeGreaterThanOrEqual(100);
    await page.getByRole("button", { name: /^Load older/ }).click();
    await readWith(page, reads, "before");
    await expect.poll(() => page.locator("[data-entry]").count()).toBeGreaterThan(before);
    const ids = await page.locator("[data-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-entry")));
    expect(new Set(ids).size, "no entry twice").toBe(ids.length);
    // Keep going to the start of the log.
    for (let i = 0; i < 20 && (await page.getByRole("button", { name: /^Load older/ }).count()) > 0; i++) {
      await page.getByRole("button", { name: /^Load older/ }).click();
      await expect(page.locator("[data-loading]")).toHaveCount(0);
    }
    await expect(page.locator("[data-end]")).toBeVisible();
    const shown = await page.locator("[data-entry]").count();
    await expect(page.locator("[data-result]")).toContainText(`${shown}`);
  });

  test("export: the current filter, every match, a file named for the day, and a toast", async ({ page }) => {
    const { reads, exports } = await openAudit(page);
    await page.getByLabel("Action", { exact: true }).selectOption("locks");
    await readWith(page, reads, "family", "locks");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Export CSV/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^octa-audit-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exports.at(-1)!.searchParams.get("family")).toBe("locks");
    const body = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
    expect(body.split("\n")[0]).toBe(
      "at,action,what,who,who_id,about,about_student_id,target_type,target_id,target,reason,payload",
    );
    await expect(page.locator("[data-toaster]")).toContainText(/Audit log exported/);
  });

  test("a refused export says why, and stays until dismissed", async ({ page }) => {
    await openAudit(page, { exportStatus: 400 });
    await page.getByRole("button", { name: /^Export CSV/ }).click();
    const toast = page.locator("[data-toaster] [role=alert]");
    await expect(toast).toContainText("Narrow the dates");
    await page.waitForTimeout(4_500);
    await expect(toast, "a failure never vanishes on a timer").toBeVisible();
  });
});

test.describe("loading and failure — design.md", () => {
  test("nothing under 400ms, then a skeleton shaped like the log, never a blank", async ({ page }) => {
    await openAudit(page, { delayMs: 2_500 });
    await page.waitForTimeout(150);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await page.locator("[data-entry]").first().waitFor({ timeout: 15_000 });
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  });

  test("past three seconds it says so in words", async ({ page }) => {
    await openAudit(page, { delayMs: 5_000 });
    await expect(page.locator("[data-skeleton]")).toContainText(/still loading/i, { timeout: 4_500 });
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    await openAudit(page, { status: 500 });
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText(/could not be loaded/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("the narrow page", () => {
  test("at 380 every entry is a card: what, who, when and the reason inside the viewport", async ({ page }, testInfo) => {
    test.skip(wide(testInfo.project.name), "380 only");
    await openAudit(page);
    expect(await page.locator("table").count(), "no table at 380").toBe(0);
    const vw = page.viewportSize()!.width;
    for (const id of ["990000004", "990000003", "990000001"]) {
      for (const fact of ["what", "who", "when"]) {
        const el = entry(page, id).locator(`[data-fact="${fact}"]`);
        await expect(el, `${id} ${fact}`).toBeVisible();
        const box = (await el.boundingBox())!;
        expect(box.x + box.width, `${id} ${fact} is off-screen`).toBeLessThanOrEqual(vw);
      }
    }
    await expect(entry(page, "990000003")).toContainText(FIX.sendBackReason);
  });
});
