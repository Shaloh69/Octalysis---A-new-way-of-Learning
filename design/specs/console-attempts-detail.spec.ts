import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import {
  ATTEMPT, papersFrom, realItems, realStudent, STUDENT_ID, STUDENT_SUB, type Paper,
} from "./_student-detail-fixture";

/**
 * `/attempts/:attemptId` — one paper on its own page, and the one console
 * route where an answer key is the point (hard rule 1).
 *
 * `design/templates/console/attempts-detail/SPEC.md` owns the decisions:
 * render-side withholding on an in-progress or abandoned paper (the record's
 * `showsKey()`, instructor 27 and 29 Sep 2026), and a GET that says whose
 * paper it is.
 *
 * THE PAPERS ARE PATCHED, THE ITEMS ARE REAL. No paper can be filled locally
 * (0 live items, NEXT-SESSION §0e.1), so this uses the student record's own
 * fixture (`_student-detail-fixture.ts`): real bank items resolved by the real
 * engine, the real seeded student, and only the attempt around them invented.
 * The DENIAL is not patched: it goes to the real API.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function mint(sub: string, role: "student" | "teacher", studentId?: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub, email: "demo@example.com", aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = mint(STUDENT_SUB, "student", STUDENT_ID);
const STAFF = mint("dddddddd-0000-4000-8000-000000000001", "teacher");

async function papers(page: Page): Promise<Record<string, Paper>> {
  const items = await realItems(page.request, API, STAFF);
  return papersFrom(items, await realStudent(page.request, API, STAFF));
}

/** Open one fixture paper on its own page and wait for the PAPER, never the <h1> (§0m.5). */
async function openPaper(
  page: Page,
  id: string,
  opts: { delayMs?: number; failFirst?: boolean } = {},
): Promise<Paper> {
  const all = await papers(page);
  let calls = 0;
  await page.route("**/api/v1/console/attempts/*", async (route: Route) => {
    const want = route.request().url().split("/").pop()!;
    calls += 1;
    if (opts.failFirst && calls === 1) {
      await route.fulfill({
        status: 500, contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }),
      });
      return;
    }
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const paper = all[want];
    try {
      if (paper) await route.fulfill({ json: paper });
      else await route.continue();
    } catch {
      /* the page went away while the paper was in flight */
    }
  });
  await page.goto(`${CONSOLE_URL}/attempts/${id}`, { waitUntil: "domcontentloaded" });
  if (!opts.delayMs && !opts.failFirst) await page.locator("[data-question]").first().waitFor({ timeout: 20_000 });
  return all[id];
}

const question = (page: Page, n: number) => page.locator(`[data-question="${n}"]`);

test.describe("/attempts/:attemptId", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  /* --------------------------------------------------------------------
   * THE GATE: CONSOLE-REVAMP.md §2, at 1440 and 380
   * ------------------------------------------------------------------ */

  test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
    test("1 · nothing is clipped: a handed-in paper, and one in progress", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted);
      expect(await clippedElements(page), "submitted").toEqual([]);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await openPaper(page, ATTEMPT.inProgress);
      expect(await clippedElements(page), "in progress").toEqual([]);
    });

    test("2 · no horizontal page scroll", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted);
      expect(await horizontalOverflow(page), "submitted").toBeLessThanOrEqual(0);
      // The paper scrolls in <main> at 1440; nothing inside it may scroll sideways either.
      const sideways = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main *")]
          // A 1px sr-only box is clipped on purpose (_gate.ts exempts it too).
          .filter((el) => el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
          .map((el) => el.className || el.tagName),
      );
      expect(sideways, "no sideways scroller inside the paper").toEqual([]);
    });

    test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
      test.setTimeout(180_000);
      await openPaper(page, ATTEMPT.submitted);
      expect(await unreachableByKeyboard(page, "main")).toEqual([]);
      // A question link, from the keyboard, lands on its question.
      const link = page.locator("[data-index] a").nth(2);
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#q-3$/);
      await expect(question(page, 3)).toBeInViewport();
    });

    test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
      test.setTimeout(180_000);
      const failures: string[] = [];
      await openPaper(page, ATTEMPT.submitted);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} submitted: ${f}`));
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await openPaper(page, ATTEMPT.inProgress);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} in progress: ${f}`));
      }
      expect(failures).toEqual([]);
    });

    test("5 · the token system is what actually rendered", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted);
      expect(await offTokenStyles(page)).toEqual([]);
    });

    test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
      // POSITIVE CONTROL FIRST: with motion allowed, the paper eases in when it lands.
      await recordMotion(page);
      await openPaper(page, ATTEMPT.submitted);
      const moving = await motionStarted(page, "main");
      expect(moving.length, "with motion allowed, the paper should ease in").toBeGreaterThan(0);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await openPaper(page, ATTEMPT.submitted);
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      await page.locator("[data-index] a").first().hover();
      const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
      expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
    });
  });

  /* --------------------------------------------------------------------
   * HARD RULE 1: the key is staff-only, and withheld on a paper not handed in
   * ------------------------------------------------------------------ */

  test.describe("the key — hard rule 1", () => {
    test("a student token is refused the paper by the REAL API, before it is looked up", async ({ request }) => {
      // An id that exists nowhere: 403, not 404, so a student cannot even learn which ids exist.
      for (const id of [ATTEMPT.submitted, "a77e0000-0000-4000-8000-00000000ffff"]) {
        const res = await request.get(`${API}/api/v1/console/attempts/${id}`, {
          headers: { Authorization: `Bearer ${STUDENT}` },
        });
        expect(res.status(), `student on ${id}`).toBe(403);
        expect(await res.text(), "no key in the refusal").not.toContain("correctValue");
      }
    });

    test("an in-progress paper shows their answers so far and no key, verdict or rationale (29 Sep)", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.inProgress);
      await expect(page.locator("[data-status-note]")).toContainText(/in progress/i);
      await expect(page.locator("[data-status-note]")).toContainText(/handed in/i);
      await expect(page.locator("[data-answered]").first()).toBeVisible();
      for (const sel of ["[data-key]", "[data-verdict]", "[data-rationale]", "[data-key-sequence]"]) {
        await expect(page.locator(sel), sel).toHaveCount(0);
      }
      // Not in the DOM at all, not merely hidden: a rationale's words are nowhere on the page.
      const html = await page.locator("main").innerHTML();
      for (const i of paper.items) if (i.rationale) expect(html).not.toContain(i.rationale.slice(0, 40));
      // The score is not a fact yet either.
      await expect(page.locator("[data-facts]")).toContainText(/not handed in/i);
    });

    test("an abandoned paper is withheld the same way", async ({ page }) => {
      await openPaper(page, ATTEMPT.abandoned);
      await expect(page.locator("[data-status-note]")).toContainText(/abandoned/i);
      for (const sel of ["[data-key]", "[data-verdict]", "[data-rationale]", "[data-key-sequence]"]) {
        await expect(page.locator(sel), sel).toHaveCount(0);
      }
    });

    test("a voided paper shows everything, and says it no longer counts", async ({ page }) => {
      await openPaper(page, ATTEMPT.voided);
      await expect(page.locator("[data-status-note]")).toContainText(/no longer counts/i);
      await expect(page.locator("[data-verdict]").first()).toBeVisible();
      await expect(page.locator("[data-key], [data-key-sequence]").first()).toBeVisible();
    });

    test("the question links carry the result in words only when the key is shown", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted);
      const names = await page.locator("[data-index] a").evaluateAll((as) => as.map((a) => a.getAttribute("aria-label") ?? a.textContent ?? ""));
      expect(names.some((n) => /not correct/i.test(n))).toBe(true);
      expect(names.some((n) => /, correct/i.test(n))).toBe(true);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await openPaper(page, ATTEMPT.inProgress);
      const withheld = await page.locator("[data-index] a").evaluateAll((as) => as.map((a) => a.getAttribute("aria-label") ?? ""));
      expect(withheld.some((n) => /correct/i.test(n)), withheld.join(" / ")).toBe(false);
      expect(withheld.some((n) => /not answered/i.test(n))).toBe(true);
    });
  });

  /* --------------------------------------------------------------------
   * THE ROUTE'S OWN CLAIMS: PAGE-SPECS.md, MASTER-PLAN.md §6.3
   * ------------------------------------------------------------------ */

  test.describe("the paper as they sat it", () => {
    test("says whose paper it is, which assessment and which attempt, and links back to their record", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.submitted);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(paper.assessmentTitle);
      const back = page.getByRole("link", { name: new RegExp(`${paper.student.fullName}.*record`) });
      await expect(back).toHaveAttribute("href", `/students/${STUDENT_SUB}`);
      const head = page.locator("[data-paper-facts]");
      await expect(head).toContainText(STUDENT_ID);
      await expect(head).toContainText(`attempt ${paper.attemptNo}`);
      await expect(head.locator(".num", { hasText: STUDENT_ID })).toHaveCount(1);
      await expect(page.getByRole("link", { name: "This student in the audit log", exact: true })).toHaveAttribute("href", `/audit?q=${STUDENT_ID}`);
    });

    test("the facts: score, answered, when, how long, and the engine, numbers in mono", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.submitted);
      const facts = page.locator("[data-facts]");
      await expect(facts).toContainText(`${paper.score} of ${paper.maxScore}`);
      const answered = paper.items.filter((i) => i.studentAnswer !== null).length;
      await expect(facts).toContainText(`${answered} of ${paper.items.length}`);
      await expect(facts).toContainText("14 min 32 s"); // 08:00:00 to 08:14:32
      await expect(facts).toContainText(paper.engineVersion);
      const notMono = await facts.locator("dd").evaluateAll((dds) =>
        dds.filter((dd) => /\d/.test(dd.textContent ?? "") && !getComputedStyle(dd.querySelector(".num") ?? dd).fontFamily.includes("JetBrains"))
          .map((dd) => dd.textContent),
      );
      expect(notMono, "every number in the facts is mono").toEqual([]);
    });

    test("every question in order: options as they saw them, their answer and the key in words, the rationale, the time", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.submitted);
      await expect(page.locator("[data-question]")).toHaveCount(paper.items.length);
      for (const item of paper.items) {
        const q = question(page, item.ordinal);
        await expect(q.getByRole("heading", { level: 2 })).toHaveText(`Question ${item.ordinal}`);
        if (item.type !== "G") {
          await expect(q.locator("[data-option]")).toHaveText(item.options.map((o) => new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
          await expect(q.locator("[data-key]")).toHaveCount(1);
          await expect(q.locator("[data-option]", { has: page.locator("[data-key]") })).toContainText(item.correctValue);
        }
        if (item.studentAnswer !== null && item.type !== "G" && item.options.includes(item.studentAnswer)) {
          await expect(q.locator("[data-picked]")).toContainText(item.studentAnswer);
          await expect(q.locator("[data-picked]")).toContainText("Their answer");
        }
        if (item.rationale) await expect(q.locator("[data-rationale]")).toContainText(item.rationale.slice(0, 40));
        if (item.timeMs !== null) await expect(q.locator("[data-time]")).toHaveCSS("font-family", /JetBrains/);
        await expect(q.locator("[data-verdict]")).toHaveText(
          item.studentAnswer === null ? "Not answered" : item.isCorrect ? "Correct" : "Not correct",
        );
      }
    });

    test("an ordering item shows their order and the keyed order, numbered", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.submitted);
      const g = paper.items.find((i) => i.type === "G");
      test.skip(!g, "the bank resolved no ordering item");
      const q = question(page, g!.ordinal);
      await expect(q.locator("[data-key-sequence] li")).toHaveText(g!.correctValue.split(" | "));
      await expect(q.locator("[data-their-sequence] li")).toHaveText(g!.studentAnswer!.split(" | "));
      await expect(q.locator("[data-key-sequence] > li").first()).toHaveCSS("list-style-type", "decimal");
    });

    test("options are lettered, and a computed item's values and parameters are mono", async ({ page }) => {
      const paper = await openPaper(page, ATTEMPT.submitted);
      const s = paper.items.find((i) => i.type === "S")!;
      await expect(question(page, s.ordinal).locator("[data-option]").first()).toHaveCSS("list-style-type", "upper-alpha");
      const p = paper.items.find((i) => i.type === "P" && i.resolvedParams && Object.keys(i.resolvedParams).length > 0);
      test.skip(!p, "the bank resolved no computed item with parameters");
      const q = question(page, p!.ordinal);
      await expect(q.locator("[data-option] .paper-option-text").first()).toHaveCSS("font-family", /JetBrains/);
      await expect(q.locator("[data-params]")).toHaveCSS("font-family", /JetBrains/);
      for (const k of Object.keys(p!.resolvedParams!)) await expect(q.locator("[data-params]")).toContainText(k);
    });

    test("a wrong answer is a neutral word, never the danger colour", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted);
      const wrong = page.locator("[data-verdict]", { hasText: "Not correct" }).first();
      await expect(wrong).toBeVisible();
      const [color, border, danger] = await wrong.evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement("span");
        probe.style.color = "var(--danger)";
        document.body.append(probe);
        const d = getComputedStyle(probe).color;
        probe.remove();
        return [cs.color, cs.borderTopColor, d];
      });
      expect(color).not.toBe(danger);
      expect(border).not.toBe(danger);
    });
  });

  /* --------------------------------------------------------------------
   * LOADING AND FAILURE — .claude/rules/design.md
   * ------------------------------------------------------------------ */

  test.describe("loading and failure — design.md", () => {
    test("nothing under 400ms, a skeleton after, words after 3s at its TOP", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted, { delayMs: 4_500 });
      await page.waitForTimeout(200);
      await expect(page.locator("[data-skeleton]"), "no flash of skeleton").toHaveCount(0);
      await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
      await expect(page.locator("[data-slow]")).toHaveCount(0);
      await expect(page.locator("[data-slow]")).toBeVisible({ timeout: 4_000 });
      const first = await page.locator("[data-skeleton]").evaluate((el) => el.firstElementChild?.hasAttribute("data-slow"));
      expect(first, "the sentence sits at the top of the skeleton").toBe(true);
      await page.locator("[data-question]").first().waitFor({ timeout: 10_000 });
    });

    test("a failed read says so and Try again reads it again", async ({ page }) => {
      await openPaper(page, ATTEMPT.submitted, { failFirst: true });
      const alert = page.getByRole("alert");
      await expect(alert).toContainText(/could not be loaded/i);
      await alert.getByRole("button", { name: "Try again" }).click();
      await page.locator("[data-question]").first().waitFor({ timeout: 20_000 });
      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    test("an address that is not a paper says so, from the REAL API, with no Try again", async ({ page }) => {
      await page.goto(`${CONSOLE_URL}/attempts/not-a-uuid`, { waitUntil: "domcontentloaded" });
      const note = page.locator("[data-missing]");
      await expect(note).toContainText("No such attempt.", { timeout: 20_000 });
      await expect(note.getByRole("link", { name: "Students", exact: true })).toHaveAttribute("href", "/students");
      await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    });
  });
});
