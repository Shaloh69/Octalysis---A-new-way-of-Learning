import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, RETURN_REASON, useFixture } from "./_submissions-fixture";

/**
 * `/submissions` — labs, the project and participation: 40% of the grade.
 *
 * Rebuilt 27 Sep 2026 against shadcn-admin's Inbox (the queue beside a reading
 * pane) with its Tasks page for density; see
 * `design/templates/console/submissions/SPEC.md`. `PAGE-SPECS.md` has no row
 * for this route: its requirements are `apps/console/CLAUDE.md` ("a graded
 * submission's content freezes; regrade is an explicit, audited unlock"),
 * `TEMPLATE-LINKS.md` ("`is_late` must be a visible column") and
 * `DESIGN-REVIEW-01` D-4 (the queue was 3,436px for 21 rows). All three are
 * tests here.
 *
 * FIXTURE DATA ONLY, and every write intercepted (`_submissions-fixture.ts`).
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
const wide = (name: string) => name === "desktop-1440";

/** One submission in the queue, a table row at 1440 or a list item at 380. */
const entry = (page: Page, f: { name: string; slug: string }) =>
  page.locator("[data-submission]").filter({ hasText: f.name }).filter({ hasText: f.slug }).first();

const pane = (page: Page) => page.locator("[data-pane]");

async function openPage(page: Page, opts: Parameters<typeof useFixture>[1] & { query?: string } = {}) {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/submissions${opts.query ?? ""}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
  if (!opts.listStatus) await page.locator("[data-submission]").first().waitFor({ timeout: 15_000 });
  return fx;
}

/** Status filter by its word: To mark, Returned, Graded, Drafts, All. */
async function show(page: Page, word: "To mark" | "Returned" | "Graded" | "Drafts" | "All") {
  await page.getByRole("button", { name: new RegExp(`^${word}\\b`) }).click();
  await page.locator("[data-submission]").first().waitFor();
}

/** Open one submission in the pane, by its student's name. */
async function open(page: Page, f: { name: string; slug: string }): Promise<Locator> {
  await entry(page, f).getByRole("button", { name: f.name }).click();
  const p = pane(page);
  await expect(p.getByRole("heading", { level: 2 })).toHaveText(f.name);
  return p;
}

async function openReturn(page: Page) {
  await pane(page).getByRole("button", { name: /return for revision/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

function overlaps(a: { x: number; y: number; width: number; height: number } | null,
  b: { x: number; y: number; width: number; height: number } | null): boolean {
  return !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2
 * ==================================================================== */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: the queue, a pane to mark, a graded pane, the return dialog", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    expect(await clippedElements(page), "the queue").toEqual([]);
    await open(page, FIX.late);
    expect(await clippedElements(page), "a lab to mark").toEqual([]);
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor();
    await show(page, "Graded");
    await open(page, FIX.banded);
    expect(await clippedElements(page), "a graded lab").toEqual([]);
    await openReturn(page);
    expect(await clippedElements(page), "the return dialog").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    expect(await horizontalOverflow(page), "the queue").toBeLessThanOrEqual(0);
    await open(page, FIX.files);
    expect(await horizontalOverflow(page), "the pane").toBeLessThanOrEqual(0);
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor();
    await show(page, "Graded");
    await open(page, FIX.banded);
    await openReturn(page);
    expect(await horizontalOverflow(page), "the return dialog").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone, and focus comes home", async ({ page }, info) => {
    test.setTimeout(240_000);
    await openPage(page);
    expect(await unreachableByKeyboard(page, "main"), "the queue").toEqual([]);

    // Open a submission without the mouse: focus lands on the pane's heading.
    const name = entry(page, FIX.late).getByRole("button", { name: FIX.late.name });
    await name.focus();
    await page.keyboard.press("Enter");
    await expect(pane(page).getByRole("heading", { level: 2 })).toBeFocused();
    expect(await unreachableByKeyboard(page, "main"), "the pane to mark").toEqual([]);

    if (!wide(info.project.name)) {
      // 380: Back to the queue, and focus returns to the row it left.
      await pane(page).getByRole("button", { name: /back to the queue/i }).click();
      await expect(entry(page, FIX.late).getByRole("button", { name: FIX.late.name })).toBeFocused();
    }

    // The return dialog, opened and closed without the mouse.
    await show(page, "Graded");
    const banded = entry(page, FIX.banded).getByRole("button", { name: FIX.banded.name });
    await banded.focus();
    await page.keyboard.press("Enter");
    const ret = pane(page).getByRole("button", { name: /return for revision/i });
    await ret.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Reason (required)").fill("Re-mark part 2");
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "the return dialog").toEqual([]);
    await closeDialog(page);
    await expect(ret, "focus came home to Return for revision").toBeFocused();
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openPage(page);
    await show(page, "All");
    const failures: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} queue: ${f}`));
    }
    await open(page, FIX.late);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} to mark: ${f}`));
    }
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor();
    await show(page, "Graded");
    await open(page, FIX.banded);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} graded: ${f}`));
    }
    await openReturn(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} return: ${f}`));
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    expect(await offTokenStyles(page), "the queue").toEqual([]);
    await open(page, FIX.files);
    expect(await offTokenStyles(page), "the pane").toEqual([]);
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor();
    await show(page, "Graded");
    await open(page, FIX.banded);
    await openReturn(page);
    expect(await offTokenStyles(page), "the return dialog").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST: with motion allowed, the return dialog must ease
     * in. Without this the test passes on a page with no motion at all.
     */
    await recordMotion(page);
    await openPage(page);
    await show(page, "Graded");
    await open(page, FIX.banded);
    await openReturn(page);
    const moving = await motionStarted(page, "dialog");
    expect(moving.length, "with motion allowed, the return dialog should ease in").toBeGreaterThan(0);
    await closeDialog(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    // Not reload(): the address still says ?open=, and at 380 that is the pane alone.
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await open(page, FIX.late);
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-submission]").first().waitFor();
    await show(page, "Graded");
    await open(page, FIX.banded);
    await openReturn(page);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * THE ROUTE'S OWN CLAIMS
 * ==================================================================== */

test.describe("the queue: who, what, when, and whether it was late", () => {
  test("is_late is a visible column at 1440, and a line on every item at 380", async ({ page }, info) => {
    await openPage(page);
    await show(page, "All");
    const words = /^(on time|no due date|not handed in|late|\d+ (minute|hour|day)s? late)$/;
    const cells = await page.locator("[data-submission] [data-late]").allInnerTexts();
    expect(cells.length).toBe(await page.locator("[data-submission]").count());
    for (const c of cells) expect(c.trim()).toMatch(words);
    await expect(entry(page, FIX.late).locator("[data-late]")).toHaveText("1 day late");
    if (wide(info.project.name)) {
      const heads = (await page.locator("main thead th").allInnerTexts()).map((t) => t.trim().toLowerCase());
      expect(heads).toEqual(["student", "deliverable", "handed in", "late", "mark"]);
    }
  });

  test("dense enough to mark from: DESIGN-REVIEW-01 D-4", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "the density bound is the table's; 380 is a list");
    await openPage(page);
    const rows = page.locator("main tbody tr[data-submission]");
    const n = await rows.count();
    expect(n).toBe(21);
    const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    const avg = heights.reduce((a, b) => a + b, 0) / heights.length;
    // The card list was ~155px a row, D-4's fix 41px. Two lines (name, then ID).
    expect(avg, "average row height").toBeLessThanOrEqual(56);
  });

  test("no student's name is cut: the old 380 lost every final-project name", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    const cut = await page.locator("[data-submission] [data-student-name]").evaluateAll((els) =>
      els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().width < 40)
        .map((e) => e.textContent),
    );
    expect(cut).toEqual([]);
    await expect(entry(page, FIX.project).locator("[data-student-name]")).toHaveText(FIX.project.name);
  });

  test("counts in the header and on the filters agree with the queue", async ({ page }) => {
    await openPage(page);
    const counts = page.locator("[data-counts]");
    await expect(counts).toContainText("61 submissions");
    await expect(counts).toContainText("21 to mark");
    await expect(counts).toContainText("1 returned");
    await expect(counts).toContainText("10 drafts");
    await expect(page.getByRole("button", { name: /^To mark\b/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-submission]")).toHaveCount(21);
    await show(page, "Drafts");
    await expect(page.locator("[data-submission]")).toHaveCount(10);
  });

  test("filters by deliverable, by kind and by name or student ID", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    await page.getByRole("button", { name: /^Deliverable/ }).click();
    await page.getByRole("menuitem", { name: /lab-07/ }).click();
    const slugs = await page.locator("[data-submission] [data-slug]").allInnerTexts();
    expect(new Set(slugs.map((s) => s.trim()))).toEqual(new Set(["lab-07"]));

    await page.getByRole("button", { name: /^Deliverable/ }).click();
    await page.getByRole("menuitem", { name: /^Participation/ }).click();
    await expect(page.locator("[data-submission]")).toHaveCount(1);
    await expect(entry(page, FIX.participation)).toBeVisible();

    await page.getByRole("button", { name: /^Deliverable/ }).click();
    await page.getByRole("menuitem", { name: /every deliverable/i }).click();
    await page.getByLabel("Search by name or student ID").fill("232129011");
    const names = await page.locator("[data-submission] [data-student-name]").allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toBe("Josue Alcantara");
  });

  test("a state word never breaks inside its badge, and the pane never splits a slug", async ({ page }) => {
    // Seen on 27 Sep, under a green gate: "returne / d" in a 5.5rem Mark
    // column at 1440, and "lab- / 03" in the pane's subtitle at 380.
    await openPage(page);
    await show(page, "All");
    const heights = await page.locator("main [data-state-word]").evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(20);
    const one = Math.min(...heights);
    expect(heights.filter((h) => h > one + 1), "badges taller than one line").toEqual([]);
    // The row it was seen on: its title puts "lab-03" across the edge at 380.
    await show(page, "Drafts");
    await open(page, FIX.draft);
    const lines = await page.locator("[data-pane-slug]").evaluate((e) => e.getClientRects().length);
    expect(lines, "the slug in the pane's subtitle is on one line").toBe(1);
  });

  test("numbers, counts and dates are mono, and no slug is in a native option", async ({ page }) => {
    await openPage(page);
    await show(page, "All");
    const fonts = await page.locator("main .num").evaluateAll((els) =>
      els.slice(0, 60).map((e) => getComputedStyle(e).fontFamily),
    );
    expect(fonts.length).toBeGreaterThan(20);
    for (const f of fonts) expect(f).toMatch(/JetBrains Mono/);
    const dates = await page.locator("main [data-date]").evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily));
    expect(dates.length).toBeGreaterThan(20);
    for (const f of dates) expect(f).toMatch(/JetBrains Mono/);
    expect(await page.locator("main select").count()).toBe(0);
  });
});

test.describe("marking: the lab bands, a stated score, save and advance", () => {
  test("a lab is marked by one of the manual's five bands, pressed buttons", async ({ page }) => {
    await openPage(page);
    const p = await open(page, FIX.late);
    const group = p.getByRole("group", { name: /rubric band, out of 4/i });
    const bands = group.getByRole("button");
    await expect(bands).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(bands.nth(i)).toHaveAttribute("aria-pressed", "false");
    await expect(group).toContainText("Correct, complete, and the reasoning is stated");
    await expect(p.getByRole("button", { name: "Save grade" })).toBeDisabled();
    await expect(p.getByLabel("Score")).toHaveCount(0);
  });

  test("the pane says when it was due and that it was late, in words", async ({ page }) => {
    await openPage(page);
    const p = await open(page, FIX.late);
    const facts = p.locator("[data-facts]");
    await expect(facts).toContainText("Due");
    await expect(facts).toContainText("1 day late");
    await expect(facts).toContainText(/not penalised/i);
  });

  test("saving a band posts once, toasts what happened to whom, and advances to the next", async ({ page }) => {
    const fx = await openPage(page);
    const p = await open(page, FIX.late);
    await p.getByRole("button", { name: /^3\b/ }).click();
    await expect(p.getByRole("button", { name: /^3\b/ })).toHaveAttribute("aria-pressed", "true");
    await p.getByLabel("Feedback").fill("Say why the third instruction stalls.");
    await p.getByRole("button", { name: "Save grade" }).click();

    await expect(page.getByRole("status").filter({ hasText: /Graded 3\/4/ })).toContainText(FIX.late.name);
    expect(fx.writes.grade).toHaveLength(1);
    expect(fx.writes.grade[0]!.body).toMatchObject({
      score: 3, maxScore: 4, rubric: { band: 3 }, feedbackMd: "Say why the third instruction stalls.",
    });
    expect(fx.writes.ret).toHaveLength(0);

    // Advanced: another student, still to mark, and focus on its heading.
    const h = pane(page).getByRole("heading", { level: 2 });
    await expect(h).not.toHaveText(FIX.late.name);
    await expect(h).toBeFocused();
    await expect(pane(page).getByRole("button", { name: "Save grade" })).toBeVisible();
    await expect(entry(page, FIX.late)).toHaveCount(0); // it left the To mark view
  });

  test("a project takes a score out of a maximum the grader states, checked before it is sent", async ({ page }) => {
    const fx = await openPage(page);
    const p = await open(page, FIX.project);
    await expect(p.getByRole("group", { name: /rubric band/i })).toHaveCount(0);
    await p.getByLabel("Score").fill("21");
    await p.getByLabel("Out of").fill("20");
    await expect(p.locator("[data-score-problem]")).toContainText("above the maximum of 20");
    await expect(p.getByRole("button", { name: "Save grade" })).toBeDisabled();
    await p.getByLabel("Score").fill("18");
    await p.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Graded 18\/20/ })).toBeVisible();
    expect(fx.writes.grade).toHaveLength(1);
    expect(fx.writes.grade[0]!.body.score).toBe(18);
    expect(fx.writes.grade[0]!.body.maxScore).toBe(20);
    expect(fx.writes.grade[0]!.body.rubric ?? {}).not.toHaveProperty("band");
  });

  test("a refused mark keeps the form, says why, and its toast stays clear of Save", async ({ page }) => {
    const fx = await openPage(page, { fail: "grade" });
    const p = await open(page, FIX.late);
    await p.getByRole("button", { name: /^2\b/ }).click();
    const save = p.getByRole("button", { name: "Save grade" });
    await save.click();
    await expect(p.getByRole("alert")).toContainText(/return it first/i);
    const t = page.locator("[data-toaster]").getByText(/was not saved/i);
    await expect(t).toBeVisible();
    expect(overlaps(await t.boundingBox(), await save.boundingBox()), "the error toast covers Save grade").toBe(false);
    await expect(p.getByRole("heading", { level: 2 })).toHaveText(FIX.late.name);
    await expect(p.getByRole("button", { name: /^2\b/ })).toHaveAttribute("aria-pressed", "true");
    expect(fx.writes.grade).toHaveLength(0);
  });

  test("attachments and recorded values are shown, values in mono", async ({ page }) => {
    await openPage(page);
    const p = await open(page, FIX.files);
    await expect(p).toContainText("trace-table.png");
    const v = p.locator("[data-payload] .num").first();
    await expect(v).toHaveText("14");
    expect(await v.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/);
  });

  test("the address carries the open submission, so a reload keeps it", async ({ page }) => {
    await openPage(page);
    await open(page, FIX.late);
    expect(new URL(page.url()).searchParams.get("open")).toBeTruthy();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(pane(page).getByRole("heading", { level: 2 })).toHaveText(FIX.late.name, { timeout: 15_000 });
  });

  test("at 1440 nothing open says how many wait and opens the oldest", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "at 380 the queue is the page until one is opened");
    await openPage(page);
    const empty = page.locator("[data-pane-empty]");
    await expect(empty).toContainText("21");
    // A returned one waits on the student, so All still says 21, not 22.
    await show(page, "All");
    await expect(empty).toContainText(/^21 waiting/);
    await show(page, "To mark");
    await empty.getByRole("button", { name: /open the oldest waiting/i }).click();
    await expect(pane(page).getByRole("button", { name: "Save grade" })).toBeVisible();
  });
});

test.describe("frozen after grading; a regrade is an explicit, audited unlock", () => {
  test("a graded lab shows its record and offers no way to change the mark in place", async ({ page }) => {
    await openPage(page);
    await show(page, "Graded");
    const p = await open(page, FIX.banded);
    await expect(p.locator("[data-record]")).toContainText("3/4");
    await expect(p.locator("[data-record]")).toContainText("reasoning thin or missing");
    await expect(p.locator("[data-record]")).toContainText("Say why the fetch stalls");
    await expect(p.locator("[data-facts]")).toContainText("Prof. Amalia R. Bontuyan");
    await expect(p).toContainText(/frozen/i);
    await expect(p.getByRole("button", { name: "Save grade" })).toHaveCount(0);
    await expect(p.getByRole("group", { name: /rubric band/i })).toHaveCount(0);
    await expect(p.getByLabel("Score")).toHaveCount(0);
    await expect(p.getByLabel("Feedback")).toHaveCount(0);
  });

  test("returning needs a reason, says what the student sees, posts once, and toasts", async ({ page }) => {
    const fx = await openPage(page);
    await show(page, "Graded");
    await open(page, FIX.banded);
    const dialog = await openReturn(page);
    await expect(dialog).toContainText(/the student sees/i);
    await expect(dialog).toContainText(/audit log/i);
    const confirm = dialog.getByRole("button", { name: `Return to ${FIX.banded.name}` });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Reason (required)").fill("Band applied to the wrong part.");
    await confirm.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /Returned to/ })).toContainText(FIX.banded.name);
    expect(fx.writes.ret).toEqual([{ id: expect.any(String), body: { reason: "Band applied to the wrong part." } }]);
    expect(fx.writes.grade).toHaveLength(0);
  });

  test("a refused return keeps the dialog and its reason, and its toast stays clear of the button", async ({ page }) => {
    await openPage(page, { fail: "return" });
    await show(page, "Graded");
    await open(page, FIX.banded);
    const dialog = await openReturn(page);
    await dialog.getByLabel("Reason (required)").fill("Band applied to the wrong part.");
    const confirm = dialog.getByRole("button", { name: `Return to ${FIX.banded.name}` });
    await confirm.click();
    await expect(dialog.getByRole("alert")).toContainText(/only a graded submission/i);
    await expect(dialog.getByLabel("Reason (required)")).toHaveValue("Band applied to the wrong part.");
    const t = page.locator("[data-toaster]").getByText(/was not returned/i);
    await expect(t).toBeVisible();
    expect(overlaps(await t.boundingBox(), await confirm.boundingBox()), "the error toast covers Return").toBe(false);
  });

  test("a returned submission says why it came back and can be marked again", async ({ page }) => {
    await openPage(page);
    await show(page, "Returned");
    const p = await open(page, FIX.returned);
    await expect(p.locator("[data-returned-reason]")).toContainText(RETURN_REASON);
    await expect(p.getByRole("group", { name: /rubric band, out of 4/i })).toBeVisible();
    await expect(p.getByRole("button", { name: "Save grade" })).toBeVisible();
  });

  test("a draft is listed, never read, and cannot be marked", async ({ page }) => {
    await openPage(page);
    await show(page, "Drafts");
    await expect(entry(page, FIX.draft).locator("[data-late]")).toHaveText("not handed in");
    const p = await open(page, FIX.draft);
    await expect(p).toContainText(/not been handed in/i);
    await expect(p.locator("[data-body]")).toHaveCount(0);
    await expect(p.getByRole("button", { name: "Save grade" })).toHaveCount(0);
    await expect(p.getByRole("button", { name: /return for revision/i })).toHaveCount(0);
  });
});

test.describe("loading and failure — design.md", () => {
  test("a slow queue shows a skeleton shaped like it, never a blank", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await useFixture(page, { delayMs: 2500 });
    await page.goto(`${CONSOLE_URL}/submissions`, { waitUntil: "domcontentloaded" });
    const skel = page.locator("[data-skeleton]");
    await expect(skel).toBeVisible({ timeout: 5_000 });
    expect(await skel.locator(".subs-skel-row").count()).toBeGreaterThanOrEqual(8);
    await page.locator("[data-submission]").first().waitFor({ timeout: 15_000 });
    await expect(skel).toHaveCount(0);
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    await openPage(page, { listStatus: 500 });
    const alert = page.getByRole("alert").filter({ hasText: /could not be loaded/i });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
