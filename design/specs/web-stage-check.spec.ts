import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import type { ResolvedItem } from "../../services/api/src/engine/resolve.ts";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  motionStarted,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  setTheme,
  THEMES,
  unreachableByKeyboard,
} from "./_gate.ts";
import {
  answerFor,
  checkUrl,
  realAssessment,
  realPaper,
  servePaper,
  signIn,
  type PaperOptions,
  type Served,
} from "./_stage-check-fixture.ts";

/**
 * `/app/stage/:id/check`: the attempt runner, the first student route through
 * the gate (`WEB-REVAMP.md` §6). It grades, so a defect here costs marks.
 *
 * `design/templates/web/stage-check/SPEC.md` is what this spec holds the page
 * to: the six gate assertions at 1440 and 380, then the instructor's rulings of
 * 29 Sep 2026 (choose then Record; a resume restores recorded answers; one
 * confirmation before Submit; the Register Bar's PC; toasts; flag for review).
 *
 * Every paper here is the fixture's: real bank items, the real engine, the real
 * grader and the real serializer (`_stage-check-fixture.ts`). The key-leak test
 * against the REAL API is `attempt-runner.spec.ts`; this file never replaces it.
 */

const wide = (t: TestInfo) => t.project.name === "desktop-1440";

/*
 * The route's own surfaces. The console's gate reads `main` because there the
 * shell sits outside it; in apps/web the shell's nav is INSIDE `<main>`
 * (App.tsx), and its translucent background is the shell's to fix
 * (NEXT-SESSION.md §0p). Keyboard reachability still walks all of `main`.
 */
const ROUTE = "[data-runner], [role=alertdialog], [data-toaster]";

let items: ResolvedItem[];
let assessment: { id: string; title: string };

test.beforeAll(async ({ request }) => {
  items = await realPaper(request);
  assessment = await realAssessment(request);
});

const q = (n: number) => items[n - 1]!;

/** Open the paper and wait for DATA: the question, not the heading (§0m.5). */
async function open(page: Page, opts: PaperOptions = {}): Promise<Served> {
  await signIn(page);
  const served = await servePaper(page, items, opts);
  /*
   * The student's seeded look (theme, accent hue) lands from /cosmetics AFTER
   * first paint and eases every colour on the page. Measured before it lands,
   * the gate reads mid-transition oklab values as "not a token".
   */
  const look = page.waitForResponse((r) => r.url().includes("/api/v1/cosmetics"), { timeout: 15_000 }).catch(() => null);
  await page.goto(checkUrl(assessment));
  await look;
  if (!opts.failStart) {
    await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible({ timeout: 15_000 });
  }
  return served;
}

const recordButton = (page: Page) => page.getByRole("button", { name: "Record answer", exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next question", exact: true });

/** The two answers resumed papers start with: one right, one wrong. */
const TWO_RECORDED = () => [
  { ordinal: 1, answer: answerFor(q(1), true) },
  { ordinal: 2, answer: answerFor(q(2), false) },
];

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: a question, a recorded one, the ordering item", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    for (const n of [1, 3, 4, 6]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      await expect(page.locator("main").getByText(new RegExp(`Question ${n} of`)).first()).toBeVisible();
      expect(await clippedElements(page, ROUTE), `question ${n}`).toEqual([]);
    }
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    for (const n of [1, 3, 6]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      expect(await horizontalOverflow(page), `question ${n}`).toBeLessThanOrEqual(0);
    }
  });

  test("3. every control is reachable by keyboard", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });

  test("4. AA contrast, computed, on all three themes", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    // A wrong verdict on screen: the neutral response is text that must read.
    await page.getByRole("button", { name: /^Question 2\b/ }).click();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, ROUTE), theme).toEqual([]);
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    for (const n of [1, 3]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      expect(await offTokenStyles(page, ROUTE), `question ${n}`).toEqual([]);
    }
  });

  test("6. prefers-reduced-motion: moving between questions does not animate", async ({ page }) => {
    // Positive control first: without the media feature, a question change eases.
    await recordMotion(page);
    await open(page);
    await next(page).click();
    const moved = await motionStarted(page, "main");
    expect(moved.length, "no motion recorded without reduced motion; the control proves nothing").toBeGreaterThan(0);

    const calm = await page.context().newPage();
    await calm.emulateMedia({ reducedMotion: "reduce" });
    await recordMotion(calm);
    await open(calm);
    await next(calm).click();
    await calm.getByRole("radio").first().click();
    await recordButton(calm).click();
    await expect(calm.locator("[data-verdict]")).not.toBeEmpty();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await calm.close();
  });
});

/* ======================================================= choose, then Record */

test.describe("choose, then Record (instructor, 29 Sep 2026)", () => {
  test("the rule is said before the first answer", async ({ page }) => {
    await open(page);
    await expect(page.locator("main")).toContainText(/first recorded answer to each question is final/i);
  });

  test("selecting, by click or by arrow key, records nothing; Record does", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const served = await open(page);
    const radios = page.getByRole("radio");
    await radios.nth(1).click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
    expect(served.answerPosts, "choosing sent an answer: the first click or arrow would be final").toEqual([]);

    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).not.toBeEmpty();
    expect(served.answerPosts).toEqual([{ ordinal: 1, answer: { index: 1 } }]);
  });

  test("a recorded question is read-only and says which answer is recorded", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const served = await open(page);
    await page.getByRole("radio").nth(2).click();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).not.toBeEmpty();

    for (const r of await page.getByRole("radio").all()) await expect(r).toBeDisabled();
    await expect(recordButton(page)).toHaveCount(0);
    await expect(page.locator("main")).toContainText(/your answer/i);
    await page.getByRole("radio").nth(0).click({ force: true });
    expect(served.answerPosts.length, "a recorded question sent a second answer").toBe(1);
  });

  test("an incorrect answer is neutral: the word, the key in mono, the why; never red, never a shake", async ({ page }) => {
    await open(page);
    const wrong = answerFor(q(1), false) as { index: number };
    await page.getByRole("radio").nth(wrong.index).click();
    await recordButton(page).click();

    const verdict = page.locator("[data-verdict]");
    await expect(verdict).toContainText(/not this one/i);
    await expect(verdict).toHaveAttribute("aria-live", "polite");
    await expect(verdict.locator("strong").first()).toHaveText(q(1).correctValue);
    // A machine value in mono; a sentence stays prose (29 Sep 2026).
    if (/d/.test(q(1).correctValue) && q(1).correctValue.split(/s+/).length <= 3) {
      await expect(verdict.locator("strong").first()).toHaveClass(/mono/);
    }
    await expect(verdict).toContainText(q(1).rationale.slice(0, 40));

    const danger = await page.evaluate(() => {
      const p = document.createElement("i");
      p.style.color = "var(--danger)";
      document.body.append(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    });
    const colours = await verdict.evaluate((el) =>
      [el, ...el.querySelectorAll("*")].flatMap((e) => {
        const cs = getComputedStyle(e);
        return [cs.color, cs.backgroundColor, cs.borderLeftColor, cs.borderTopColor];
      }),
    );
    expect(colours, "the wrong-answer response uses the danger colour").not.toContain(danger);
    const moving = await page.evaluate(() =>
      document.getAnimations().filter((a) => a instanceof CSSAnimation && (a.effect as KeyframeEffect)?.target?.closest?.("[data-verdict]")).length,
    );
    expect(moving, "the verdict animates (a shake?)").toBe(0);
  });

  test("a correct answer says Correct, in words", async ({ page }) => {
    await open(page);
    const right = answerFor(q(1), true) as { index: number };
    await page.getByRole("radio").nth(right.index).click();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).toContainText(/^\s*Correct\./);
  });

  test("an ordering item stays answerable, and grades right when right (da5831b)", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const served = await open(page);
    await page.getByRole("button", { name: /^Question 3\b/ }).click();
    const key = q(3).correctValue.split(" | ");
    // Bubble the list into the key's order with the real Move up buttons.
    for (let target = 0; target < key.length; target++) {
      const rows = await page.locator("[data-order-row]").allTextContents();
      let at = rows.findIndex((t) => t.includes(key[target]!));
      while (at > target) {
        await page.getByRole("button", { name: new RegExp(`^Move "${escape(key[target]!)}" up`) }).click();
        at--;
      }
    }
    expect(served.answerPosts, "moving an item recorded an answer").toEqual([]);
    await page.getByRole("button", { name: "Record this order", exact: true }).click();
    await expect(page.locator("[data-verdict]")).toContainText(/^\s*Correct\./);
    expect(served.answerPosts).toEqual([{ ordinal: 3, answer: { order: key } }]);
  });

  test("free entry records on Enter or Record, never on blur", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const served = await open(page);
    await page.getByRole("button", { name: /^Question 6\b/ }).click();
    const box = page.getByRole("textbox", { name: /your answer/i });
    await box.fill(q(6).correctValue);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    expect(served.answerPosts, "leaving the box recorded a half-typed answer").toEqual([]);
    await box.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-verdict]")).toContainText(/^\s*Correct\./);
    expect(served.answerPosts).toEqual([{ ordinal: 6, answer: { value: q(6).correctValue } }]);
    // The unit is part of the question, and it is a number's company: mono.
    if (q(6).unit) {
      const font = await page.locator("[data-unit]").evaluate((e) => getComputedStyle(e).fontFamily);
      expect(font).toMatch(/JetBrains Mono/i);
    }
  });
});

/* =================================================================== resume */

test.describe("a resumed paper (instructor, 29 Sep 2026)", () => {
  test("restores what was recorded, and opens on the first unrecorded question", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    const main = page.locator("main");
    await expect(main).toContainText(/picking up where you left off/i);
    await expect(page.locator("[data-recorded-count]")).toHaveText(/2 of 8 recorded/);
    await expect(main.getByText(/Question 3 of 8/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Question 1, recorded/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Question 2, recorded/ })).toBeVisible();

    await page.getByRole("button", { name: /^Question 2\b/ }).click();
    await expect(page.locator("[data-verdict]")).toContainText(/not this one/i);
    for (const r of await page.getByRole("radio").all()) await expect(r).toBeDisabled();
  });
});

/* =========================================================== failure states */

test.describe("when things fail", () => {
  test("a failed Record says it was NOT recorded, keeps the choice, and Try again sends it", async ({ page }) => {
    let failing = true;
    const served = await open(page, { failRecord: () => failing });
    await page.getByRole("radio").nth(1).click();
    await recordButton(page).click();

    const main = page.locator("main");
    await expect(main).toContainText(/not recorded/i);
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toBeVisible();
    await page.waitForTimeout(4_500);
    await expect(alert, "a failure toast left on a timer").toBeVisible();

    failing = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("[data-verdict]")).not.toBeEmpty();
    expect(served.responses.has(1)).toBe(true);
  });

  test("a failed start says what failed, with Try again", async ({ page }) => {
    await open(page, { failStart: { status: 500, message: "Something went wrong on our side. Try again." } });
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(main).toContainText(/Something went wrong on our side/);
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    // The runner's own; the shell has a "Leave planet" hint of its own.
    await expect(main.getByRole("button", { name: /leave|back to the stage/i })).toBeVisible();
  });

  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    await signIn(page);
    await servePaper(page, items, { startDelayMs: 4_500 });
    await page.goto(checkUrl(assessment));
    await page.waitForTimeout(150);
    await expect(page.locator("[data-skeleton]"), "a skeleton flashed under 400ms").toHaveCount(0);
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await expect(page.locator("main")).toContainText(/taking longer|still/i, { timeout: 4_000 });
    await expect(page.locator("main").getByText(/Question 1 of 8/).first()).toBeVisible({ timeout: 8_000 });
  });
});

/* =================================================================== submit */

test.describe("submitting", () => {
  test("asks once, naming what is unanswered and that it cannot be undone", async ({ page }) => {
    const served = await open(page, { recorded: TWO_RECORDED() });
    await page.getByRole("button", { name: "Submit paper", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/6 not answered/i);
    await expect(dialog).toContainText(/cannot be undone/i);
    await page.getByRole("button", { name: "Keep working", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(served.submitted).toBe(false);
    await expect(page.getByRole("button", { name: "Submit paper", exact: true })).toBeFocused();
  });

  test("submits, confirms with a toast, and shows the result by objective in words", async ({ page }) => {
    const served = await open(page, { recorded: TWO_RECORDED() });
    await page.getByRole("button", { name: "Submit paper", exact: true }).click();
    await page.getByRole("button", { name: "Submit now", exact: true }).click();
    await expect(page.locator("[data-score]")).toBeVisible();
    expect(served.submitted).toBe(true);

    await expect(page.locator("[data-toaster] [role=status]")).toContainText(/submitted/i);
    await expect(page.locator("[data-score]")).toHaveText(/1\s*\/\s*8/);
    const font = await page.locator("[data-score]").evaluate((e) => getComputedStyle(e).fontFamily);
    expect(font).toMatch(/JetBrains Mono/i);
    // By objective, in the syllabus's words, not only a code.
    await expect(page.locator("main")).toContainText(/Outline|Define|Examine|Compute|Explain|Discuss|Describe/);
    // What was missed carries the question itself.
    await expect(page.locator("main")).toContainText(q(2).stem.slice(0, 30));
  });

  test("a refused submit keeps the paper open and says so, and the toast stays", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await open(page, { recorded: TWO_RECORDED(), failSubmit: true });
    await page.getByRole("button", { name: "Submit paper", exact: true }).click();
    await page.getByRole("button", { name: "Submit now", exact: true }).click();
    await expect(page.locator("[data-toaster] [role=alert]")).toContainText(/could not take the paper/i);
    await expect(page.getByRole("button", { name: "Submit paper", exact: true })).toBeVisible();
  });
});

/* ============================================================ the paper rail */

test.describe("the Register Bar and the paper", () => {
  test("PC is the question number during the paper, in mono", async ({ page }) => {
    await open(page);
    const pc = page.locator("[data-readout] [data-register=PC] .register-value");
    await expect(pc).toHaveText("01");
    await next(page).click();
    await expect(pc).toHaveText("02");
    expect(await pc.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("flag for review: marks an unrecorded question, is named on Submit, and a Record clears it", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await open(page);
    const flag = page.getByRole("button", { name: /flag to come back/i });
    await flag.click();
    await expect(flag).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Question 1, not answered, flagged/ })).toBeVisible();

    await page.getByRole("button", { name: "Submit paper", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toContainText(/1 flagged/i);
    await page.getByRole("button", { name: "Keep working", exact: true }).click();

    await page.getByRole("radio").nth(0).click();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).not.toBeEmpty();
    await expect(page.getByRole("button", { name: /^Question 1, recorded/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /flag to come back/i }), "a recorded question offers a flag").toHaveCount(0);
  });

  test("every count on the paper is mono", async ({ page }) => {
    await open(page, { recorded: TWO_RECORDED() });
    for (const sel of ["[data-recorded-count]", "[data-question-no]"]) {
      const font = await page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily);
      expect(font, sel).toMatch(/JetBrains Mono/i);
    }
  });

  test("a final withholds the verdict: recorded, results after submit, no key in the DOM", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await open(page, { scope: "final" });
    await page.getByRole("radio").nth(0).click();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).toContainText(/results after you submit/i);
    const html = await page.locator("main").innerHTML();
    expect(html).not.toContain(q(1).rationale.slice(0, 30));
  });
});

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
