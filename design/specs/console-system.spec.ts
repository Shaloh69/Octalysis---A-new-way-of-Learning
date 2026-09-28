import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FAILING, useFixture, type FixtureOpts } from "./_system-fixture";

/**
 * `/system`: every rule a database constraint cannot express, checked now,
 * each one named, with what it found.
 *
 * `TEMPLATE-LINKS.md` row 77 is the plan: "a list of named checks, each
 * pass/fail, with a timestamp and a way to see the detail of a failure ...
 * never an aggregate 'all good' badge that hides one failing invariant."
 * Before the rebuild (28 Sep 2026) the page led with "The database is in a
 * legal state.", hid the 21 passing checks in a closed <details> as function
 * names, printed a failure's rows as raw JSON, and filed "the Prelim has 0 of
 * 40 live items" under notices "expected while the bank is being authored".
 *
 * Instructor rulings of that day: a notice only on an empty table (the API's
 * call, `services/api/src/audit/invariants.ts`); every check says what it
 * protects and what to do; the nightly runs read back, read-only; API health
 * stays on /settings. `design/templates/console/system/SPEC.md`.
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
const wide = (project: string) => project === "desktop-1440";

/** Every patched state at once: a failing check, a notice, fourteen nights. */
const ALL: FixtureOpts = { failing: true, notice: true, runs: true };

async function openSystem(page: Page, opts: FixtureOpts = ALL) {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/system`, { waitUntil: "domcontentloaded" });
  if (!opts.status && !opts.delayMs) await page.locator("[data-check]").first().waitFor({ timeout: 15_000 });
  return fx;
}

const check = (page: Page, id: string) => page.locator(`[data-check="${id}"]`);
const detailsButton = (page: Page, id: string) => check(page, id).getByRole("button", { name: /^Details/ });

async function openDetails(page: Page, id: string) {
  const b = detailsButton(page, id);
  if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
  await expect(b).toHaveAttribute("aria-expanded", "true");
}

/* ================================================================ the gate */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: every check, a failure's rows, a notice, the nightly runs", async ({ page }) => {
    await openSystem(page);
    expect(await clippedElements(page), "the checks").toEqual([]);
    await openDetails(page, "INV-29");
    await openDetails(page, "INV-28");
    expect(await clippedElements(page), "details open").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openSystem(page);
    expect(await horizontalOverflow(page), "the checks").toBeLessThanOrEqual(0);
    await openDetails(page, "INV-29");
    await openDetails(page, "INV-18");
    expect(await horizontalOverflow(page), "details open").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone, and Details keeps focus", async ({ page }) => {
    await openSystem(page);
    expect(await unreachableByKeyboard(page, "main"), "the checks").toEqual([]);
    const button = detailsButton(page, "INV-25");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toBeFocused();
    expect(await unreachableByKeyboard(page, "main"), "details open").toEqual([]);
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openSystem(page);
    await openDetails(page, "INV-29");
    await openDetails(page, "INV-28");
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), theme).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openSystem(page);
    await openDetails(page, "INV-29");
    await openDetails(page, "INV-28");
    expect(await offTokenStyles(page)).toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, Details eases open.
    await recordMotion(page);
    await openSystem(page);
    await openDetails(page, "INV-25");
    const moving = await motionStarted(page, "main");
    expect(moving.length, "with motion allowed, Details should ease open").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-check]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openDetails(page, "INV-25");
    await page.locator("[data-attention] a").first().click();
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================= row 77, the plan */

test.describe("a list of named checks, each pass or fail — never a verdict", () => {
  test("every check the API ran is on the page and visible, none behind a disclosure", async ({ page }) => {
    const res = await page.request.get(
      `${process.env.OCTA_API_URL ?? "http://localhost:8090"}/api/v1/console/audit/system`,
      { headers: { Authorization: `Bearer ${STAFF}` } },
    );
    const ran = ((await res.json()) as { results: Array<{ id: string }> }).results.map((r) => r.id);
    expect(ran.length).toBeGreaterThanOrEqual(28);
    await openSystem(page);
    const shown = await page.locator("[data-check]").evaluateAll((els) => els.map((e) => e.getAttribute("data-check")));
    expect(shown.sort()).toEqual([...ran].sort());
    for (const id of ran) await expect(check(page, id), id).toBeVisible();
  });

  test("no aggregate verdict: counts per state, every state named, zero included", async ({ page }) => {
    await openSystem(page, {});
    const main = page.locator("main");
    // A verdict's words. Not "score": INV-24 protects the usability score, legitimately.
    await expect(main).not.toContainText(/legal state|all good|all systems|healthy|operational|health score|uptime/i);
    const counts = page.locator("[data-counts]");
    // The raw demo has no failing check and no notice: both still say so.
    await expect(counts).toContainText(/\b0 failing\b/);
    await expect(counts).toContainText(/\b0 notices\b/);
    await expect(counts).toContainText(/\b4 warnings\b/);
    await expect(counts).toContainText(/\b24 passing\b/);
    const fonts = await counts.locator(".num").evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily));
    expect(fonts.length).toBe(4);
    for (const f of fonts) expect(f).toMatch(/JetBrains Mono/);
  });

  test("each check is a title and what it protects, never a function name", async ({ page }) => {
    await openSystem(page);
    const rows = await page.locator("[data-check]").evaluateAll((els) =>
      els.map((e) => ({
        id: e.getAttribute("data-check"),
        title: e.querySelector("[data-title]")?.textContent?.trim() ?? "",
        protects: e.querySelector("[data-protects]")?.textContent?.trim() ?? "",
        state: e.querySelector("[data-state]")?.textContent?.trim() ?? "",
      })),
    );
    for (const r of rows) {
      expect(r.title, `${r.id} title`).not.toMatch(/^inv_\d/);
      expect(r.title.length, `${r.id} title`).toBeGreaterThan(5);
      expect(r.protects.length, `${r.id} protects`).toBeGreaterThan(20);
      expect(r.state, `${r.id} state is a word`).toMatch(/^(Failing|Warning|Notice|Passing)$/);
    }
  });

  test("the checks sit under the areas of the schema, in its order", async ({ page }) => {
    await openSystem(page);
    const heads = await page.locator("[data-area] h2").allTextContents();
    expect(heads.map((h) => h.trim())).toEqual([
      "Security", "Accounts", "Papers and grading", "Item bank", "Curriculum and map", "Content and locks", "Feedback",
    ]);
    await expect(page.locator('[data-area="bank"] [data-check="INV-18"]')).toHaveCount(1);
    await expect(page.locator('[data-area="papers"] [data-check="INV-31"]')).toHaveCount(1);
  });

  test("a check with offenders says how many, in mono; a passing one says none", async ({ page }) => {
    await openSystem(page);
    await expect(check(page, "INV-29").locator("[data-found]")).toHaveText(/^12 rows$/);
    await expect(check(page, "INV-01").locator("[data-found]")).toHaveText(/^none$/);
    const font = await check(page, "INV-29").locator("[data-found] .num").evaluate((e) => getComputedStyle(e).fontFamily);
    expect(font).toMatch(/JetBrains Mono/);
  });

  test("the run carries its date and time to the second, and how long it took", async ({ page }) => {
    await openSystem(page);
    const line = page.locator("[data-runline]");
    await expect(line).toContainText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}:\d{2}/);
    await expect(line).toContainText(/\d+ ms/);
    await expect(line).not.toContainText(/ago/);
  });
});

test.describe("the detail of a failure", () => {
  test("a failing check is open on arrival, and its rows are shown column by column, in mono", async ({ page }, testInfo) => {
    await openSystem(page);
    await expect(check(page, FAILING.id).locator("[data-state]")).toHaveText("Failing");
    await expect(detailsButton(page, FAILING.id)).toHaveAttribute("aria-expanded", "true");
    const sample = check(page, FAILING.id).locator("[data-sample]");
    // A sideways scroller counts as clipping (_gate.ts), so at 1440 the rows are
    // a table that fits, and at 380 each row is its own list of columns.
    const values = wide(testInfo.project.name) ? sample.locator("table td") : sample.locator("[data-sample-row] dd");
    if (wide(testInfo.project.name)) {
      await expect(sample.locator("table th")).toHaveText(["item_id", "slug"]);
      await expect(sample.locator("table tbody tr")).toHaveCount(2);
      await expect(sample.locator("[data-sample-row]").first()).toBeHidden();
    } else {
      await expect(sample.locator("table")).toBeHidden();
      await expect(sample.locator("[data-sample-row]")).toHaveCount(2);
      await expect(sample.locator("[data-sample-row]").first().locator("dt")).toHaveText(["item_id", "slug"]);
    }
    await expect(values.nth(1)).toHaveText(FAILING.rows[0]!.slug);
    const font = await values.first().evaluate((e) => getComputedStyle(e).fontFamily);
    expect(font).toMatch(/JetBrains Mono/);
    // A warning is not opened for the teacher.
    await expect(detailsButton(page, "INV-25")).toHaveAttribute("aria-expanded", "false");
  });

  test("details say what the check does, what to do, and the database's own terms", async ({ page }) => {
    await openSystem(page);
    await openDetails(page, "INV-18");
    const d = check(page, "INV-18").locator("[data-details]");
    await expect(d.locator('[data-field="checks"]')).toContainText(/three times as many live items/);
    await expect(d.locator('[data-field="action"]')).toContainText(/Items/);
    await expect(d).toContainText("inv_18_bank_starvation()");
    await expect(d).toContainText(/run_invariants\(\) severity\s*warn/);
    // Every column the function returns. In jsonb's key order, not the function's:
    // the sample passes through jsonb_agg, which stores keys by length.
    const cols = await d.locator("[data-sample-row]").first().locator("dt").allTextContents();
    expect([...cols].sort()).toEqual(["assessment_id", "available", "bucket", "dimension", "needed"]);
  });

  test("a cut sample says so: 5 of 12", async ({ page }) => {
    await openSystem(page);
    await openDetails(page, "INV-29");
    await expect(check(page, "INV-29").locator("[data-sample]")).toContainText(/Showing the first 5 of 12 rows/);
  });

  test("a notice says why it is a notice, in the API's words", async ({ page }) => {
    await openSystem(page);
    await expect(check(page, "INV-28").locator("[data-state]")).toHaveText("Notice");
    await openDetails(page, "INV-28");
    await expect(check(page, "INV-28").locator('[data-field="notice"]')).toContainText(/No objectives exist yet/);
  });

  test("INV-18 on the real demo is a warning, not a notice: the bank has items", async ({ page }) => {
    await openSystem(page, {});
    await expect(check(page, "INV-18").locator("[data-state]")).toHaveText("Warning");
    await expect(check(page, "INV-18").locator("[data-found]")).toHaveText(/^2 rows$/);
  });
});

test.describe("needs attention, first", () => {
  test("names every check that is not passing, and nothing else", async ({ page }) => {
    await openSystem(page);
    const ids = await page.locator("[data-attention] a").evaluateAll((els) => els.map((e) => e.getAttribute("data-to")));
    // Failing first, then warnings, then notices; by id within each.
    expect(ids).toEqual(["INV-15", "INV-18", "INV-25", "INV-27", "INV-29", "INV-28"]);
    await expect(page.locator("[data-attention] a").first()).toContainText(/INV-15.*Failing.*2 rows/);
  });

  test("a link opens that check's detail and puts focus on it", async ({ page }) => {
    await openSystem(page);
    await page.locator('[data-attention] a[data-to="INV-27"]').click();
    await expect(detailsButton(page, "INV-27")).toHaveAttribute("aria-expanded", "true");
    await expect(detailsButton(page, "INV-27")).toBeFocused();
    await expect(check(page, "INV-27")).toBeInViewport();
  });

  test("absent when every check passes", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
    await page.route(/\/api\/v1\/console\/audit\/system/, async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.results = body.results.map((r: { offendingCount: number; sample: unknown[] }) => ({ ...r, offendingCount: 0, sample: [] }));
      body.failing = 0;
      await route.fulfill({ response: res, json: body });
    });
    await page.goto(`${CONSOLE_URL}/system`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-check]").first().waitFor();
    await expect(page.locator("[data-attention]")).toHaveCount(0);
    await expect(page.locator("[data-counts]")).toContainText(/\b0 failing\b/);
    await expect(page.locator("main")).not.toContainText(/legal state|all good/i);
  });
});

test.describe("run again: live, and read-only", () => {
  test("keeps the results while it runs, then shows the new time and toasts it", async ({ page }) => {
    const fx = await openSystem(page, { ...ALL, rerunDelayMs: 1_200 });
    const before = await page.locator("[data-runline]").textContent();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect(page.getByRole("button", { name: /Running/ })).toBeDisabled();
    await expect(page.locator("[data-check]").first()).toBeVisible();
    await expect(page.locator("[data-toaster]")).toContainText(/Checked again at \d{2}:\d{2}:\d{2}: 1 failing, 4 warnings/, { timeout: 8_000 });
    expect(fx.reads.length).toBe(2);
    await expect(page.getByRole("button", { name: "Run again" })).toBeEnabled();
    expect(await page.locator("[data-runline]").textContent()).not.toBe(before);
  });

  test("a failed re-run keeps the earlier results and says they are the earlier run's", async ({ page }) => {
    await openSystem(page, { ...ALL, rerunStatus: 500 });
    await page.getByRole("button", { name: "Run again" }).click();
    await expect(page.locator("[data-toaster]")).toContainText(/could not be run again/i, { timeout: 8_000 });
    await expect(page.locator("[data-stale]")).toContainText(/earlier run/i);
    await expect(page.locator("[data-check]")).toHaveCount(28);
  });

  test("the page offers nothing that changes data", async ({ page }) => {
    await openSystem(page);
    await openDetails(page, "INV-25");
    const names = await page.locator("main button, main a").evaluateAll((els) =>
      els.map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()),
    );
    for (const n of names) expect(n, n).toMatch(/^(Run again|Details|INV-\d+)/);
  });
});

test.describe("the nightly runs", () => {
  test("listed newest first, each saying in words what it found", async ({ page }) => {
    await openSystem(page);
    const runs = page.locator("[data-run]");
    await expect(runs).toHaveCount(14);
    await expect(runs.first()).toContainText(/1 failing: INV-15/);
    await expect(runs.first()).toContainText(/4 warnings: INV-18, INV-25, INV-27, INV-29/);
    await expect(runs.first()).toContainText(/nightly/i);
    await expect(runs.nth(5)).toContainText(/nothing failing/i);
    const times = await runs.locator("time").evaluateAll((els) => els.map((e) => Date.parse(e.getAttribute("datetime")!)));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  test("none recorded: says so, and why", async ({ page }) => {
    await openSystem(page, {});
    await expect(page.locator("[data-runs-empty]")).toContainText(/No nightly run is recorded/);
    await expect(page.locator("[data-runs-empty]")).toContainText(/pg_cron/);
  });
});

/* ============================================== loading and failure */

test.describe("loading and failure — design.md", () => {
  test("nothing under 400ms, then a skeleton shaped like the list, never a blank", async ({ page }) => {
    await openSystem(page, { ...ALL, delayMs: 2_500 });
    await page.waitForTimeout(150);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await page.locator("[data-check]").first().waitFor({ timeout: 15_000 });
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  });

  test("past three seconds it says so in words, at the top of the skeleton", async ({ page }) => {
    await openSystem(page, { ...ALL, delayMs: 5_000 });
    const note = page.locator("[data-skeleton] > :first-child");
    await expect(note).toContainText(/still running/i, { timeout: 4_500 });
    await expect(note).toBeInViewport();
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    await openSystem(page, { status: 500 });
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText(/could not be run/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

/* ===================================================== the narrow page */

test.describe("the narrow page", () => {
  test("at 380 each check stacks: state, id, title and what it found inside the viewport", async ({ page }, testInfo) => {
    test.skip(wide(testInfo.project.name), "380 only");
    await openSystem(page);
    const vw = page.viewportSize()!.width;
    for (const id of ["INV-15", "INV-18", "INV-33"]) {
      for (const sel of ["[data-state]", "[data-id]", "[data-title]", "[data-found]"]) {
        const el = check(page, id).locator(sel);
        await expect(el, `${id} ${sel}`).toBeVisible();
        const box = (await el.boundingBox())!;
        expect(box.x + box.width, `${id} ${sel} is off-screen`).toBeLessThanOrEqual(vw);
      }
    }
  });

  test("at 1440 a check is one row: state, name and what it found side by side", async ({ page }, testInfo) => {
    test.skip(!wide(testInfo.project.name), "1440 only");
    await openSystem(page);
    const row = check(page, "INV-01");
    const [s, t, f] = await Promise.all(
      ["[data-state]", "[data-title]", "[data-found]"].map(async (sel) => (await row.locator(sel).boundingBox())!),
    );
    expect(Math.abs(s!.y - t!.y), "state and title on one line").toBeLessThan(12);
    expect(f!.x, "found sits to the right of the title").toBeGreaterThan(t!.x + t!.width);
    const h = (await row.boundingBox())!.height;
    expect(h, "a passing check is dense: under 72px").toBeLessThan(72);
  });
});
