import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, WHO, patch, type Matrix } from "./_locks-fixture";

/**
 * `/locks` — the lock matrix, students × stages.
 *
 * `design/templates/console/locks/SPEC.md` owns the decisions; this file holds
 * the six-assertion gate (`CONSOLE-REVAMP.md` §2) and the route's own claims.
 *
 * TWO RULES SHAPE THIS FILE.
 *
 * 1. **Hard rule 4: the page renders `is_stage_unlocked()`'s answer and never
 *    computes a lock.** The fixture below contains a cell a person OPENED that
 *    the database still says is CLOSED (a window that has not started). The
 *    page must show closed. A page that derived the state from the override
 *    would show open, and that is the test.
 *
 * 2. **Every lock write is intercepted, never sent.** `console-audit.spec.ts`
 *    once wrote GLOBAL locks to shared state and nine solar-system specs failed
 *    underneath it, correctly: the map had changed. A spec that toggles real
 *    locks to prove a layout is changing what a student can open.
 *
 * The matrix itself is the REAL local response, patched: three cells given the
 * three override shapes, and one course-wide and one scheduled section
 * override added. Seeded fixture names only; nothing here names a real person.
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
interface Writes { single: Array<Record<string, unknown>>; bulk: Array<Record<string, unknown>> }

/**
 * Open `/locks` on the patched matrix, with every write captured and answered
 * without reaching the API. Returns the captured writes and the matrix served.
 */
async function openLocks(
  page: Page,
  opts: { failWrites?: boolean } = {},
): Promise<{ writes: Writes; matrix: Matrix }> {
  const writes: Writes = { single: [], bulk: [] };
  let matrix: Matrix | null = null;
  await page.route("**/api/v1/console/locks**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "GET") {
      // A test that ends mid-reload aborts this fetch; that is not a failure.
      try {
        const res = await route.fetch();
        matrix = patch((await res.json()) as Matrix);
        await route.fulfill({ response: res, json: matrix });
      } catch {
        /* the page or the test went away while the matrix was in flight */
      }
      return;
    }
    const body = req.postDataJSON() as Record<string, unknown>;
    (req.url().endsWith("/bulk") ? writes.bulk : writes.single).push(body);
    await route.fulfill(
      opts.failWrites
        ? {
            status: 500, contentType: "application/json",
            body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }),
          }
        : {
            status: 200, contentType: "application/json",
            body: JSON.stringify({ ok: true, count: Array.isArray(body.cells) ? body.cells.length : 1 }),
          },
    );
  });
  await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "domcontentloaded" });
  // WAIT FOR THE PAGE TO DECIDE (NEXT-SESSION §0a.2): cells, not <main>.
  await page.locator("button[data-lock]").first().waitFor({ timeout: 20_000 });
  return { writes, matrix: matrix! };
}

const cellOf = (page: Page, m: Matrix, student: number, stage: string) =>
  page.locator(`button[data-lock][data-user="${m.students[student]!.userId}"][data-stage="${stage}"]`);

/** At 380 one stage shows at a time. Pick it the way a teacher would. */
async function showStage(page: Page, stage: string): Promise<void> {
  const picker = page.getByLabel("Stage", { exact: true });
  if (await picker.isVisible().catch(() => false)) await picker.selectOption(stage);
}

async function openCellDialog(page: Page, m: Matrix, student: number, stage: string): Promise<void> {
  await showStage(page, stage);
  await cellOf(page, m, student, stage).click();
  await page.getByRole("dialog").waitFor();
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
});

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2, at 1440 and 380
 * ==================================================================== */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped — matrix, reason dialog, sections tab", async ({ page }) => {
    const { matrix } = await openLocks(page);
    expect(await clippedElements(page), "on the matrix").toEqual([]);
    await openCellDialog(page, matrix, FIX.closed.student, FIX.closed.stage);
    expect(await clippedElements(page), "in the reason dialog").toEqual([]);
    await closeDialog(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    expect(await clippedElements(page), "on the sections tab").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    const { matrix } = await openLocks(page);
    expect(await horizontalOverflow(page), "the matrix").toBeLessThanOrEqual(0);
    await openCellDialog(page, matrix, FIX.opened.student, FIX.opened.stage);
    expect(await horizontalOverflow(page), "with the dialog open").toBeLessThanOrEqual(0);
    await closeDialog(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    expect(await horizontalOverflow(page), "the sections tab").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    test.setTimeout(240_000);
    const { matrix } = await openLocks(page);
    expect(await unreachableByKeyboard(page, "main"), "on the matrix").toEqual([]);

    // Open a cell WITHOUT the mouse, walk the dialog, leave it: focus must
    // come home to the cell, or a teacher loses their place in 400 of them.
    await showStage(page, FIX.closed.stage);
    const cell = cellOf(page, matrix, FIX.closed.student, FIX.closed.stage);
    await cell.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the reason dialog").toEqual([]);
    await closeDialog(page);
    await expect(cell).toBeFocused();

    const tab = page.getByRole("tab", { name: /sections & schedules/i });
    await tab.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("tabpanel").getByRole("button", { name: /save override/i }).waitFor();
    expect(await unreachableByKeyboard(page, "main"), "on the sections tab").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(180_000);
    const { matrix } = await openLocks(page);
    const failures: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} matrix: ${f}`));
      await openCellDialog(page, matrix, FIX.opened.student, FIX.opened.stage);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} dialog: ${f}`));
      await closeDialog(page);
    }
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} sections: ${f}`));
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    const { matrix } = await openLocks(page);
    expect(await offTokenStyles(page), "on the matrix").toEqual([]);
    await openCellDialog(page, matrix, FIX.closed.student, FIX.closed.stage);
    expect(await offTokenStyles(page), "in the reason dialog").toEqual([]);
    await closeDialog(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    expect(await offTokenStyles(page), "on the sections tab").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST: with motion allowed, the reason dialog must ease
     * in. Without this the test passes on a page with no motion at all.
     */
    await recordMotion(page);
    const { matrix } = await openLocks(page);
    await openCellDialog(page, matrix, FIX.opened.student, FIX.opened.stage);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("dialog") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the reason dialog should ease in").toBeGreaterThan(0);
    await closeDialog(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const again = await openLocks(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openCellDialog(page, again.matrix, FIX.opened.student, FIX.opened.stage);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * HARD RULE 4 — the page renders is_stage_unlocked()'s answer
 * ==================================================================== */

test.describe("the page never computes a lock — hard rule 4", () => {
  test("a person's override that the database overrules shows the database's answer", async ({ page }) => {
    const { matrix } = await openLocks(page);
    await showStage(page, FIX.disagree.stage);
    const cell = cellOf(page, matrix, FIX.disagree.student, FIX.disagree.stage);
    await expect(cell, "the fill is what the student sees").toHaveAttribute("data-resolved", "closed");
    await expect(cell, "and it still says a person opened it").toHaveAttribute("data-lock", "person-open");
    await expect(cell).toHaveAccessibleName(/closed/i);
    await expect(cell).toHaveAccessibleName(new RegExp(`opened by ${WHO}`, "i"));
  });

  test("every cell's open or closed is the API's boolean, for every student and stage", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "the whole matrix is on screen at 1440");
    const { matrix } = await openLocks(page);
    const rendered = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button[data-lock]")].map((b) => ({
        u: b.dataset.user!, s: b.dataset.stage!, open: b.dataset.resolved === "open",
      })),
    );
    expect(rendered.length).toBe(matrix.cells.length);
    const wrong = rendered.filter((r) => {
      const c = matrix.cells.find((x) => x.userId === r.u && x.stageId === r.s)!;
      return c.unlocked !== r.open;
    });
    expect(wrong, "cells whose state the page decided for itself").toEqual([]);
  });
});

/* ======================================================================
 * THE ROUTE'S OWN CLAIMS — PAGE-SPECS.md §/console/locks
 * ==================================================================== */

test.describe("three states, told apart without colour", () => {
  test("automatic, opened by a person and closed by a person each carry their own mark", async ({ page }) => {
    const { matrix } = await openLocks(page);
    await showStage(page, FIX.opened.stage);
    await expect(cellOf(page, matrix, FIX.opened.student, FIX.opened.stage)).toHaveAttribute("data-lock", "person-open");
    await showStage(page, FIX.closed.stage);
    const closed = cellOf(page, matrix, FIX.closed.student, FIX.closed.stage);
    await expect(closed).toHaveAttribute("data-lock", "person-closed");
    const auto = cellOf(page, matrix, 5, FIX.closed.stage);
    await expect(auto).toHaveAttribute("data-lock", /^auto-(open|closed)$/);

    // The marks differ in SHAPE, not only in colour: compare what is drawn.
    const drawn = async (l: ReturnType<typeof cellOf>) =>
      l.evaluate((b) => `${b.textContent?.trim()}|${b.querySelector("svg")?.getAttribute("class") ?? ""}`);
    const marks = new Set([
      await drawn(cellOf(page, matrix, FIX.closed.student, FIX.closed.stage)),
      await drawn(auto),
    ]);
    await showStage(page, FIX.opened.stage);
    marks.add(await drawn(cellOf(page, matrix, FIX.opened.student, FIX.opened.stage)));
    expect(marks.size, "three states drawn three different ways").toBe(3);
  });
});

test.describe("who, when and why — never hover-only", () => {
  test("focusing a cell shows who overrode it, when, and why", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "the readout strip is the 1440 carrier");
    const { matrix } = await openLocks(page);
    await cellOf(page, matrix, FIX.closed.student, FIX.closed.stage).focus();
    const readout = page.locator("[data-readout]");
    await expect(readout).toContainText(matrix.students[FIX.closed.student]!.fullName);
    await expect(readout).toContainText(`Closed by ${WHO}`);
    await expect(readout).toContainText(FIX.closed.reason);
    await expect(readout).toContainText(/24 Sep 2026/);
  });

  test("the reason dialog says who, when and why before anything is changed", async ({ page }) => {
    const { matrix } = await openLocks(page);
    await openCellDialog(page, matrix, FIX.closed.student, FIX.closed.stage);
    const d = page.getByRole("dialog");
    await expect(d).toContainText(`Closed by ${WHO}`);
    await expect(d).toContainText(FIX.closed.reason);
    await expect(d).toContainText(/24 Sep 2026/);
  });

  test("at 380 every row says its state in words, with no hover at all", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-380", "the 380 layout");
    const { matrix } = await openLocks(page);
    await showStage(page, FIX.closed.stage);
    const row = page.locator("[data-stage-view] li", { hasText: matrix.students[FIX.closed.student]!.fullName });
    await expect(row).toContainText(`Closed by ${WHO}`);
    await expect(row).toContainText(FIX.closed.reason);
  });
});

test.describe("every change asks why, and confirms itself", () => {
  test("a single change sends the reason, and says what happened to whom", async ({ page }) => {
    const { matrix, writes } = await openLocks(page);
    await openCellDialog(page, matrix, FIX.closed.student, FIX.closed.stage);
    const save = page.getByRole("button", { name: /save change/i });
    await expect(save, "no reason, no save — INV-22").toBeDisabled();
    await page.getByRole("radio", { name: /open early/i }).check();
    await page.getByRole("textbox").first().fill("Briefing done on 20 September");
    await save.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.single).toHaveLength(1);
    expect(writes.single[0]).toMatchObject({
      scope: "user", userId: matrix.students[FIX.closed.student]!.userId,
      stageId: FIX.closed.stage, state: "unlocked", reason: "Briefing done on 20 September",
    });
    const name = matrix.students[FIX.closed.student]!.fullName;
    await expect(page.locator("[data-toaster] [role=status]")).toContainText(
      `Stage ${FIX.closed.stage} opened early for ${name}`,
    );
  });

  test("a failed save keeps the dialog and says so until dismissed", async ({ page }) => {
    test.setTimeout(60_000);
    const { matrix } = await openLocks(page, { failWrites: true });
    await openCellDialog(page, matrix, FIX.opened.student, FIX.opened.stage);
    await page.getByRole("textbox").first().fill("Trying to close it again");
    await page.getByRole("button", { name: /save change/i }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("did not answer");
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toContainText(/not changed/i);
    await page.waitForTimeout(5_000);
    await expect(alert, "a failure never vanishes on a timer").toBeVisible();
  });
});

test.describe("shift-click for bulk — PAGE-SPECS.md", () => {
  test("shift-click selects a rectangle, and one reason covers every cell", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "shift-click is the pointer path; 380 has checkboxes");
    const { matrix, writes } = await openLocks(page);
    await cellOf(page, matrix, 3, "07").click({ modifiers: ["Shift"] });
    await cellOf(page, matrix, 5, "09").click({ modifiers: ["Shift"] });
    const bar = page.getByRole("region", { name: "Bulk change" });
    await expect(bar).toContainText("9 cells selected");
    await expect(bar).toContainText("3 students × 3 stages");
    await expect(page.getByRole("dialog"), "shift-click selects; it does not open the dialog").toHaveCount(0);

    await bar.getByRole("button", { name: "Close" }).click();
    await page.getByRole("textbox").first().fill("Quiz on chapters 7 to 9 tomorrow");
    await page.getByRole("button", { name: /save change/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.single, "bulk is one request, not nine").toHaveLength(0);
    expect(writes.bulk).toHaveLength(1);
    expect(writes.bulk[0]!.state).toBe("locked");
    expect((writes.bulk[0]!.cells as unknown[]).length).toBe(9);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("9 cells closed");
    await expect(bar).toHaveCount(0);
  });

  test("Shift+Enter does the same from the keyboard, and Escape clears it", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "the keyboard path on the full matrix");
    const { matrix } = await openLocks(page);
    await cellOf(page, matrix, 0, "10").focus();
    await page.keyboard.press("Shift+Enter");
    await cellOf(page, matrix, 1, "10").focus();
    await page.keyboard.press("Shift+Enter");
    await expect(page.getByRole("region", { name: "Bulk change" })).toContainText("2 cells selected");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Bulk change" })).toHaveCount(0);
  });

  test("a column head selects that stage for every student", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "column heads are the 1440 path");
    const { matrix } = await openLocks(page);
    await page.getByRole("button", { name: /select stage 08 for every student/i }).click();
    await expect(page.getByRole("region", { name: "Bulk change" })).toContainText(
      `${matrix.students.length} cells selected`,
    );
  });

  test("at 380 a checkbox per student carries the bulk path", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-380", "the 380 layout");
    const { matrix, writes } = await openLocks(page);
    await showStage(page, "08");
    await page.getByRole("checkbox", { name: new RegExp(`select ${matrix.students[0]!.fullName}`, "i") }).check();
    await page.getByRole("checkbox", { name: new RegExp(`select ${matrix.students[1]!.fullName}`, "i") }).check();
    const bar = page.getByRole("region", { name: "Bulk change" });
    await expect(bar).toContainText("2 cells selected");
    await bar.getByRole("button", { name: "Return to automatic" }).click();
    await page.getByRole("textbox").first().fill("Back to the curriculum");
    await page.getByRole("button", { name: /save change/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.bulk[0]).toMatchObject({ state: "auto" });
  });
});

test.describe("at 380 — one stage at a time", () => {
  test("the matrix pivots to a stage picker and a list of students", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-380", "the 380 layout");
    const { matrix } = await openLocks(page);
    await expect(page.locator("table.lock-matrix"), "19 columns do not fit in 348px").toHaveCount(0);
    await expect(page.getByLabel("Stage", { exact: true })).toBeVisible();
    await expect(page.locator("[data-stage-view] li")).toHaveCount(matrix.students.length);
  });
});

test.describe("course-wide and section overrides — their own tab", () => {
  test("the matrix marks a stage that a course-wide override closed", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "column heads are the 1440 path");
    await openLocks(page);
    const head = page.getByRole("button", { name: /select stage 04 for every student/i });
    await expect(head).toHaveAttribute("data-scope-lock", "global");
    await expect(head).toHaveAccessibleDescription(/every student: closed by/i);
  });

  test("lists each override with its window, who and when, and why", async ({ page }) => {
    const { matrix } = await openLocks(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText(FIX.global.reason);
    await expect(panel).toContainText(/every student/i);
    await expect(panel).toContainText(FIX.section.reason);
    await expect(panel).toContainText(matrix.sections[0]!.code);
    await expect(panel).toContainText(/1 Oct 2026/);
    await expect(panel).toContainText(/8 Oct 2026/);
    await expect(panel).toContainText(WHO);
  });

  test("adds a scheduled section override, and refuses a window that closes first", async ({ page }) => {
    const { matrix, writes } = await openLocks(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Applies to").selectOption({ label: matrix.sections[0]!.code });
    await panel.getByLabel("Stage", { exact: true }).selectOption("11");
    await panel.getByRole("button", { name: /^open$/i }).click();
    await expect(panel.getByRole("button", { name: /^open$/i })).toHaveAttribute("aria-pressed", "true");
    await panel.getByLabel("Opens at").fill("2026-10-10T08:00");
    await panel.getByLabel("Closes at").fill("2026-10-09T08:00");
    await panel.getByLabel(/reason/i).fill("Lab week for chapter 11");
    const save = panel.getByRole("button", { name: /save override/i });
    await expect(panel.getByText(/has to close after it opens/i)).toBeVisible();
    await expect(save).toBeDisabled();

    await panel.getByLabel("Closes at").fill("2026-10-17T08:00");
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(() => writes.single.length).toBe(1);
    expect(writes.single[0]).toMatchObject({
      scope: "section", sectionId: matrix.sections[0]!.id, stageId: "11", state: "unlocked",
      reason: "Lab week for chapter 11",
    });
    expect(typeof writes.single[0]!.unlockAt).toBe("string");
    expect(Date.parse(String(writes.single[0]!.lockAt))).toBeGreaterThan(
      Date.parse(String(writes.single[0]!.unlockAt)),
    );
    await expect(page.locator("[data-toaster] [role=status]")).toContainText(/stage 11/i);
  });

  test("a course-wide override says it changes every student before it is saved", async ({ page }) => {
    await openLocks(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Applies to").selectOption({ label: "Every student" });
    await expect(panel).toContainText(/changes this stage for every student/i);
  });

  test("an override returns to automatic through the same reason prompt", async ({ page }) => {
    const { writes } = await openLocks(page);
    await page.getByRole("tab", { name: /sections & schedules/i }).click();
    await page.getByRole("button", { name: /return stage 04 to automatic for every student/i }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Prelim week is over");
    await page.getByRole("button", { name: /save change/i }).click();
    await expect.poll(() => writes.single.length).toBe(1);
    expect(writes.single[0]).toMatchObject({ scope: "global", stageId: "04", state: "auto" });
  });
});

test.describe("loading and failure — design.md", () => {
  test("a slow matrix shows a skeleton shaped like the matrix, never a blank", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-1440", "the skeleton's shape is a desktop claim");
    await page.route("**/api/v1/console/locks", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "domcontentloaded" });
    const skeleton = page.locator("[data-skeleton]");
    await expect(skeleton).toBeVisible({ timeout: 1_400 });
    expect(Number(await skeleton.getAttribute("data-cols")), "a column per stage").toBe(19);
    await page.locator("button[data-lock]").first().waitFor();
    await expect(skeleton).toHaveCount(0);
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/console/locks", async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500, contentType: "application/json",
          body: JSON.stringify({ error: { code: "internal", message: "The matrix could not be read." } }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main [role=alert]")).toContainText("could not be read");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.locator("button[data-lock]").first().waitFor();
  });
});

test.describe("the shared dialog's scrim — NEXT-SESSION.md §0a.1", () => {
  test("dims the page behind the reason prompt", async ({ page }) => {
    const { matrix } = await openLocks(page);
    await openCellDialog(page, matrix, FIX.opened.student, FIX.opened.stage);
    const alpha = await page.evaluate(() => {
      const o = document.querySelector<HTMLElement>("[data-dialog-scrim]");
      if (!o) return 0;
      const c = document.createElement("canvas").getContext("2d")!;
      c.fillStyle = getComputedStyle(o).backgroundColor;
      c.fillRect(0, 0, 1, 1);
      return c.getImageData(0, 0, 1, 1).data[3]! / 255;
    });
    expect(alpha, "the scrim painted nothing; bg-surface-0/80 emits no CSS").toBeGreaterThan(0.5);
  });
});
