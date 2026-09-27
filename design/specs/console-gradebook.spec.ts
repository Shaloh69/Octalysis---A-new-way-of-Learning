import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, useFixture, type FixtureOpts } from "./_gradebook-fixture";

/**
 * `/gradebook` — every student's score so far, weighted by the syllabus.
 *
 * Rebuilt 28 Sep 2026 against shadcn-admin's Dashboard (the frame), shadcn.io's
 * heatmap table (the grid) and shadcn-admin's Tasks (the toolbar); see
 * `design/templates/console/gradebook/SPEC.md`. `PAGE-SPECS.md` asks for
 * "per-stage mastery + final score. Weighting configuration. CSV / XLSX export
 * shaped for the university's format." Four instructor decisions of 28 Sep
 * 2026 shape what was built (fixed syllabus weights, a final SO FAR with its
 * coverage stated, CSV only, "not sat" never 0); each is a test here.
 *
 * `console-teaching.spec.ts` keeps its two older gradebook tests.
 *
 * FIXTURE DATA ONLY (`_gradebook-fixture.ts`). The page makes no writes.
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

async function openPage(page: Page, opts: FixtureOpts = {}) {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/gradebook`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs && !opts.empty) {
    await page.locator("[data-student]").first().waitFor({ timeout: 15_000 });
  }
  return fx;
}

async function view(page: Page, name: "Final grade" | "Stage checks") {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
}

const student = (page: Page, id: string) => page.locator(`[data-student="${id}"]`);

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2
 * ==================================================================== */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped, in either view", async ({ page }) => {
    await openPage(page);
    expect(await clippedElements(page), "final grade").toEqual([]);
    await view(page, "Stage checks");
    expect(await clippedElements(page), "stage checks").toEqual([]);
  });

  test("2 · no horizontal page scroll, in either view", async ({ page }) => {
    await openPage(page);
    expect(await horizontalOverflow(page), "final grade").toBeLessThanOrEqual(0);
    await view(page, "Stage checks");
    expect(await horizontalOverflow(page), "stage checks").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openPage(page);
    expect(await unreachableByKeyboard(page, "main"), "final grade").toEqual([]);

    // Switch the view without the mouse.
    const stages = page.getByRole("button", { name: "Stage checks", exact: true });
    await stages.focus();
    await page.keyboard.press("Enter");
    await expect(stages).toHaveAttribute("aria-pressed", "true");
    expect(await unreachableByKeyboard(page, "main"), "stage checks").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes, in both views", async ({ page }) => {
    test.setTimeout(180_000);
    await openPage(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      await view(page, "Final grade");
      expect(await contrastFailures(page), `${theme}: final grade`).toEqual([]);
      await view(page, "Stage checks");
      expect(await contrastFailures(page), `${theme}: stage checks`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens, in both views", async ({ page }) => {
    await openPage(page);
    expect(await offTokenStyles(page), "final grade").toEqual([]);
    await view(page, "Stage checks");
    expect(await offTokenStyles(page), "stage checks").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST: with motion allowed, the chart's bars must grow
     * in when the page lands. Without this the test passes on a page with no
     * motion at all. Read through motionStarted(), never a one-shot read.
     */
    await recordMotion(page);
    await openPage(page);
    const moving = await motionStarted(page, "main");
    expect(moving.length, "with motion allowed, the bars should grow in").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-student]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await view(page, "Stage checks");
    await view(page, "Final grade");
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * THE ROUTE'S OWN CLAIMS
 * ==================================================================== */

test.describe("the grade: the syllabus's weights, and a final that says what it covers", () => {
  test("the five weights are the syllabus's, in its order, and sum to 100", async ({ page }) => {
    await openPage(page);
    const rows = page.locator("[data-weights] [data-weight]");
    await expect(rows).toHaveCount(5);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-weight")))).toEqual([
      "project", "quizzes", "exams", "labs", "participation",
    ]);
    const weights = await rows.evaluateAll((els) => els.map((e) => Number(e.querySelector("[data-pct]")?.textContent)));
    expect(weights).toEqual([20, 30, 30, 10, 10]);
  });

  test("the final is 'so far', and the page says how much of the grade it covers", async ({ page }) => {
    const fx = await openPage(page);
    const covered = fx.book()!.coverage;
    expect(covered, "the seed covers quizzes and labs").toBe(40);
    await expect(page.locator("[data-kpi=covered]")).toContainText("40");
    await expect(page.locator("[data-kpi=covered]")).toContainText(/of 100/);
    await expect(page.locator("main")).toContainText(/so far/i);
  });

  test("a component nobody has marks in says so, and scores no one", async ({ page }) => {
    await openPage(page);
    await expect(page.locator("[data-weight=project]")).toContainText(/no marks yet/i);
    await expect(page.locator("[data-weight=quizzes]")).toContainText(/7 stage checks/);
    await expect(page.locator("[data-weight=labs]")).toContainText(/3 labs/);
    const cell = student(page, FIX.first.studentId).locator("[data-component=project]");
    await expect(cell).toHaveText("–");
  });

  test("the student's final agrees with the book, and reads in mono", async ({ page }) => {
    const fx = await openPage(page);
    const s = fx.book()!.students.find((x) => x.studentId === FIX.first.studentId)!;
    const final = student(page, FIX.first.studentId).locator("[data-final]");
    await expect(final).toHaveText(s.final!.toFixed(1));
    expect(await final.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/mono/i);
  });

  test("a course with nothing marked shows no final, and says so rather than 0", async ({ page }) => {
    await openPage(page, { nothingMarked: true });
    await expect(page.locator("[data-kpi=covered]")).toContainText(/nothing marked yet/i);
    await expect(student(page, FIX.first.studentId).locator("[data-final]")).toHaveText("–");
  });
});

test.describe("stage checks: not sat is never 0", () => {
  test("a stage not sat reads 'not sat', and a real 0% reads 0", async ({ page }) => {
    await openPage(page);
    await view(page, "Stage checks");
    await expect(student(page, FIX.notSat.studentId).locator(`[data-check="${FIX.notSat.stage}"]`)).toHaveText(/not sat/i);
    await expect(student(page, FIX.zero.studentId).locator(`[data-check="${FIX.zero.stage}"]`)).toHaveText("0");
    // Stage 18: nobody has sat it.
    await expect(student(page, FIX.first.studentId).locator('[data-check="18"]')).toHaveText(/not sat/i);
  });

  test("names every gradeable chapter, 01 to 18, and never stage 00", async ({ page }) => {
    await openPage(page);
    await view(page, "Stage checks");
    const ids = await student(page, FIX.first.studentId).locator("[data-check]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-check")));
    expect(ids).toEqual(Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  test("the class average closes the grid, in both views", async ({ page }) => {
    await openPage(page);
    await expect(page.locator("[data-average]")).toContainText(/class average/i);
    await expect(page.locator("[data-average] [data-final]")).toHaveText(/^\d+\.\d$/);
    await view(page, "Stage checks");
    await expect(page.locator('[data-average] [data-check="01"]')).toHaveText(/^\d+$/);
    await expect(page.locator('[data-average] [data-check="18"]')).toHaveText(/not sat/i);
  });
});

test.describe("the chart: every value is text", () => {
  test("each stage prints its class average at the bar, and a stage nobody sat says so", async ({ page }) => {
    const fx = await openPage(page);
    const bars = page.locator("[data-chart] [data-bar]");
    await expect(bars).toHaveCount(18);
    const avg01 = fx.book()!.classAverage.checks["01"]!;
    await expect(page.locator('[data-chart] [data-bar="01"] [data-value]')).toHaveText(String(Math.round(avg01)));
    expect(await page.locator('[data-chart] [data-bar="01"] [data-value]').evaluate((e) => getComputedStyle(e).fontFamily))
      .toMatch(/mono/i);
    await expect(page.locator('[data-chart] [data-bar="18"]')).toContainText(/not sat yet/i);
  });

  test("the chart keeps the sentence about what a low column means", async ({ page }) => {
    await openPage(page);
    await expect(page.locator("[data-chart]")).toContainText(/about the teaching, not about the students/i);
  });
});

test.describe("finding a student", () => {
  test("the filter narrows the rows, and says when nobody matches", async ({ page }) => {
    await openPage(page);
    const field = page.getByRole("textbox", { name: /filter by name or student id/i });
    await field.fill("Dela Cruz");
    await expect(page.locator("[data-student]")).toHaveCount(1);
    await field.fill("232129020");
    await expect(page.locator("[data-student]")).toHaveCount(1);
    await field.fill("nobody-by-this-name");
    await expect(page.locator("[data-student]")).toHaveCount(0);
    await expect(page.locator("main")).toContainText(/no student matches/i);
  });

  test("a name opens that student's record", async ({ page }) => {
    const fx = await openPage(page);
    const s = fx.book()!.students.find((x) => x.studentId === FIX.first.studentId)!;
    const link = student(page, FIX.first.studentId).getByRole("link", { name: FIX.first.name });
    await expect(link).toHaveAttribute("href", `/students/${s.userId}`);
  });

  test("no name, student ID or number is broken across lines", async ({ page }, info) => {
    await openPage(page);
    // A student ID and every value are one line each: a wrap is "23212 / 9001".
    const broken = await page.locator("[data-student] .num, [data-average] .num").evaluateAll((els) =>
      els.filter((e) => {
        // Distinct line tops, not rect count: "{weight}%" is two text nodes, two rects, one line.
        const tops = new Set([...(e as HTMLElement).getClientRects()].map((r) => Math.round(r.top / 4)));
        return tops.size > 1;
      }).map((e) => e.textContent),
    );
    expect(broken).toEqual([]);
    if (wide(info.project.name)) {
      // The long name with a comma keeps its row readable: at most two lines.
      const name = student(page, FIX.long.studentId).getByRole("link");
      const lines = await name.evaluate((e) => {
        const lh = parseFloat(getComputedStyle(e).lineHeight);
        return Math.round(e.getBoundingClientRect().height / lh);
      });
      expect(lines).toBeLessThanOrEqual(2);
    }
  });

  test("the grid is dense enough to scan: a row at 1440 stays under 60px", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "the density bound is the table's; 380 is a list");
    await openPage(page);
    const heights = await page.locator("tr[data-student]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(10);
    expect(Math.max(...heights)).toBeLessThan(60);
  });

  test("a table at 1440, a list at 380", async ({ page }, info) => {
    await openPage(page);
    if (wide(info.project.name)) {
      await expect(page.locator("table[data-grid]")).toBeVisible();
    } else {
      await expect(page.locator("table[data-grid]")).toHaveCount(0);
      await expect(page.locator("ul[data-grid] > li[data-student]").first()).toBeVisible();
    }
  });
});

test.describe("the export", () => {
  test("Download CSV raises one toast saying what was in it, clear of the button", async ({ page }) => {
    await openPage(page);
    const button = page.getByRole("button", { name: /download csv/i });
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toMatch(/^octa-gradebook-\d{4}-\d{2}-\d{2}\.csv$/);
    const toast = page.locator("[data-toaster] [role=status]");
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText(/21 students/);
    await expect(toast).toContainText(/40% of the grade/);
    const a = await button.boundingBox();
    const b = await toast.boundingBox();
    const overlap = !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap, "the toast covers Download CSV").toBe(false);
  });

  test("a failed export says so, and the message stays", async ({ page }) => {
    await openPage(page, { csvFail: true });
    await page.getByRole("button", { name: /download csv/i }).click();
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toContainText(/could not/i);
    await page.waitForTimeout(5_000);
    await expect(alert).toBeVisible();
  });
});

test.describe("states", () => {
  test("a failed load says so, with a way to try again", async ({ page }) => {
    await openPage(page, { status: 500 });
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText(/gradebook could not be loaded/i);
    await expect(alert.getByRole("button", { name: /try again/i })).toBeVisible();
  });

  test("a slow load shows a skeleton the shape of the page, then the page", async ({ page }) => {
    await openPage(page, { delayMs: 1_500 });
    await expect(page.locator("[data-skeleton]")).toBeVisible();
    await expect(page.locator("[aria-busy=true]").first()).toBeVisible();
    await page.locator("[data-student]").first().waitFor({ timeout: 15_000 });
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  });

  test("an empty roster says where students come from", async ({ page }) => {
    await openPage(page, { empty: true });
    await expect(page.locator("main")).toContainText(/no students/i);
    await expect(page.getByRole("link", { name: /students/i }).last()).toBeVisible();
  });
});

test.describe("the bundle", () => {
  test("Recharts is in no module the console loads, and the gradebook is not in the first load", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "one width is enough; at 380 the nav is behind a menu");
    const urls: string[] = [];
    page.on("request", (r) => { if (r.resourceType() === "script") urls.push(r.url()); });
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await useFixture(page);
    await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "networkidle" });
    expect(urls.filter((u) => /GradebookPage/.test(u)), "the gradebook rode in on the first load").toEqual([]);
    await page.getByRole("link", { name: "Gradebook" }).first().click();
    await page.locator("[data-student]").first().waitFor({ timeout: 15_000 });
    expect(urls.some((u) => /GradebookPage/.test(u)), "the gradebook chunk was never fetched").toBe(true);
    expect(urls.filter((u) => /recharts/i.test(u))).toEqual([]);
  });
});
