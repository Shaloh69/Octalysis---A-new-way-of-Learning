import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { TEACHER_ID, useFixture, type FixtureOpts } from "./_content-fixture";

/**
 * Course Studio (`/studio`, CS1, 7 Oct 2026; `design/templates/console/studio/SPEC.md`),
 * which took in `/content` and `/content/:stageId`: where each chapter stands,
 * what waits for review, the block editor, subjects and books, and the locked
 * AI pane. Moved here from `console-content.spec.ts`, every assertion kept
 * where the rule still stands (the page is now a layout of three panes and a
 * chapter is tabs), with the Studio's own claims added at the end.
 *
 * What `/content` was: rebuilt 28 Sep 2026 against `design/templates/console/content/SPEC.md`
 * (Decap's split editor, Dillinger's source pane, shadcn-admin's Tasks table).
 * The instructor's rulings of that day are each a test here: summaries
 * approved in the database and bound to their text, a block editor with a
 * live preview, quote blocks read-only, review in a Summaries view and on each
 * chapter.
 *
 * Reads are the real seed; writes are intercepted (`_content-fixture.ts`).
 * `console-teaching.spec.ts` keeps its two older /content tests, which now
 * exercise the redirect and the Overview.
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

/** The Overview (`/studio`), or To review (`/studio/review`). */
async function openList(page: Page, opts: FixtureOpts = {}, view: "overview" | "review" = "overview") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/studio${view === "review" ? "/review" : ""}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs) {
    await page.locator(view === "review" ? "[data-summary]" : "[data-chapter]").first().waitFor({ timeout: 15_000 });
  }
  return fx;
}

/** One chapter, in the editor: the page and its toolbar are waited for. (The editor's own claims: console-studio-editor.spec.ts.) */
async function openChapter(page: Page, opts: FixtureOpts = {}, id = "04") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/studio/cpe-412/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs) await page.locator("[data-editor-shell] .ed-prose").first().waitFor({ timeout: 15_000 });
  return fx;
}

const saveStatus = (page: Page) => page.locator("[data-save-status]");

/** Type into the first paragraph: the draft is saved (held by the fixture, never sent) and Publish becomes possible. */
async function typeSomething(page: Page, text = " A sentence typed just now.") {
  await page.locator(".ed-prose .ed-content p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(text, { delay: 5 });
  await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved", { timeout: 10_000 });
}

async function openSendBack(page: Page, stageId: string) {
  await page.locator(`[data-summary="${stageId}"]`).getByRole("button", { name: /^Send back/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2
 * ==================================================================== */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: chapters, summaries, the send-back dialog, the editor with its controls, Publish, the student view", async ({ page }) => {
    await openList(page);
    expect(await clippedElements(page), "chapters").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    expect(await clippedElements(page), "to review").toEqual([]);
    await openSendBack(page, "04");
    expect(await clippedElements(page), "send-back dialog").toEqual([]);
    await page.keyboard.press("Escape");

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    expect(await clippedElements(page), "chapter").toEqual([]);
    await typeSomething(page);
    expect(await clippedElements(page), "editing, the topic's controls showing").toEqual([]);
    await page.getByRole("button", { name: /^Publish/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(500); // past the dialog's ease-in
    expect(await clippedElements(page), "publish dialog").toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Student view" }).click();
    await page.locator("[data-preview]").waitFor();
    expect(await clippedElements(page), "student view").toEqual([]);
  });

  test("2 · no horizontal page scroll, on every view", async ({ page }) => {
    await openList(page);
    expect(await horizontalOverflow(page), "chapters").toBeLessThanOrEqual(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    expect(await horizontalOverflow(page), "to review").toBeLessThanOrEqual(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    await typeSomething(page);
    expect(await horizontalOverflow(page), "editing").toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Student view" }).click();
    await page.locator("[data-preview]").waitFor();
    expect(await horizontalOverflow(page), "student view").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openList(page);
    expect(await unreachableByKeyboard(page, "main"), "chapters").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    expect(await unreachableByKeyboard(page, "main"), "to review").toEqual([]);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    expect(await unreachableByKeyboard(page, "main"), "chapter").toEqual([]);
    await typeSomething(page);
    expect(await unreachableByKeyboard(page, "main"), "editing, the topic's controls showing").toEqual([]);
    // The toolbar works without a mouse: Bold is a real button, and Enter presses it.
    const bold = page.getByRole("button", { name: "Bold" });
    await bold.focus();
    await page.keyboard.press("Enter");
    await expect(bold).toHaveAttribute("aria-pressed", "true");
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openList(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: chapters`).toEqual([]);
    }
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: to review`).toEqual([]);
    }
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    await typeSomething(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: editor`).toEqual([]);
    }
    await page.getByRole("button", { name: "Student view" }).click();
    await page.locator("[data-preview]").waitFor();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: student view`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openList(page);
    expect(await offTokenStyles(page), "chapters").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    expect(await offTokenStyles(page), "to review").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    await typeSomething(page);
    expect(await offTokenStyles(page), "editor").toEqual([]);
    await page.getByRole("button", { name: "Student view" }).click();
    await page.locator("[data-preview]").waitFor();
    expect(await offTokenStyles(page), "student view").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, the send-back dialog eases in.
    await recordMotion(page);
    await openList(page, {}, "review");
    await openSendBack(page, "04");
    const moving = await motionStarted(page, "dialog");
    expect(moving.length, "with motion allowed, the dialog should ease in").toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-summary]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openSendBack(page, "04");
    await page.keyboard.press("Escape");
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * Figures (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md and
 * design/templates/console/content-figure/SPEC.md). Stage 10's simple
 * instruction format is the seeded figure: a draft on every fresh database.
 * ==================================================================== */

const FIG = "10-instruction-format";
async function openFigures(page: Page, opts: FixtureOpts = {}) {
  const fx = await openChapter(page, opts, "10");
  await page.locator("[data-figures]").waitFor({ timeout: 15_000 });
  return fx;
}
const figureCard = (page: Page) => page.locator(`[data-figures] [data-figure-card="${FIG}"]`);

test.describe("figures: the gate, on the Figures card", () => {
  test("1-3 · nothing clipped, no horizontal scroll, every control by keyboard (and the send-back dialog)", async ({ page }) => {
    await openFigures(page);
    expect(await clippedElements(page), "figures").toEqual([]);
    expect(await horizontalOverflow(page), "figures").toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "main"), "figures").toEqual([]);
    await figureCard(page).getByRole("button", { name: new RegExp("^Send back figure " + FIG) }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await clippedElements(page), "figure send-back dialog").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openFigures(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), theme + ": figures").toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens, the drawing included", async ({ page }) => {
    await openFigures(page);
    expect(await offTokenStyles(page), "figures").toEqual([]);
  });

  test("6 · under reduced motion the send-back dialog does not animate", async ({ page }) => {
    await recordMotion(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFigures(page);
    await figureCard(page).getByRole("button", { name: new RegExp("^Send back figure " + FIG) }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect((await recordedMotion(page)).filter((m) => m.ms > 1)).toEqual([]);
  });
});

test.describe("figures: approval is of the exact drawing, and says what it does", () => {
  test("the card draws the figure as one named image, and says no student sees it yet", async ({ page }) => {
    await openFigures(page);
    const card = figureCard(page);
    await expect(card).toHaveAttribute("data-figure-status", "draft");
    await expect(card).toContainText("Waiting for your review");
    await expect(card).toContainText("No student sees it until you approve it.");
    await expect(card.getByRole("img", { name: "A simple 16-bit instruction format" })).toBeVisible();
    await expect(card.locator(".fig-svg svg")).toHaveAttribute("aria-hidden", "true");
  });

  test("the chapter's own figure topic is drawn in the editor with its caption and the book's figure number, locked", async ({ page }) => {
    await openChapter(page, {}, "10");
    const fig = page.locator(`[data-topic-kind="figure"] [data-preview-figure="${FIG}"]`);
    await expect(fig.getByRole("img", { name: "A simple 16-bit instruction format" })).toBeVisible();
    await expect(fig).toContainText("After Stallings, Figure 12.2. Redrawn for this course.");
    await expect(page.locator(`[data-topic-kind="figure"]`).first()).toContainText(/Locked/);
  });

  test("approving posts the drawing's hash once and says students see it now", async ({ page }) => {
    const fx = await openFigures(page);
    const api = process.env.OCTA_API_URL ?? "http://localhost:8090";
    const res = await page.request.get(api + "/api/v1/console/content/10", { headers: { authorization: "Bearer " + TEACHER } });
    const real = ((await res.json()) as { figures: Array<{ id: string; hash: string }> }).figures.find((x) => x.id === FIG)!.hash;
    await figureCard(page).getByRole("button", { name: new RegExp("^Approve figure " + FIG) }).click();
    await expect(page.getByRole("status").filter({ hasText: new RegExp("Figure " + FIG + " approved") })).toContainText(/Students see this drawing now/);
    expect(fx.writes.approveFigure).toEqual([{ id: FIG, body: { hash: real } }]);
    await expect(figureCard(page)).toHaveAttribute("data-figure-status", "approved");
    await expect(figureCard(page)).toContainText("Students see this drawing.");
  });

  test("an approval of a redrawn figure is refused, and the refusal stays", async ({ page }) => {
    await openFigures(page, { fail: "approve-figure" });
    await figureCard(page).getByRole("button", { name: new RegExp("^Approve figure " + FIG) }).click();
    const t = page.locator("[data-toaster]").getByRole("alert");
    await expect(t).toContainText(/redrawn since you opened it/i);
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("sending back needs a reason, says what happens, posts once, and shows the reason", async ({ page }) => {
    const fx = await openFigures(page);
    await figureCard(page).getByRole("button", { name: new RegExp("^Send back figure " + FIG) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("What students see does not change.");
    const confirm = dialog.getByRole("button", { name: new RegExp("^Send back figure " + FIG) });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/Reason/).fill("Mark the bit positions under each field.");
    await confirm.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: new RegExp("Figure " + FIG + " sent back") })).toBeVisible();
    expect(fx.writes.sendBackFigure).toEqual([{ id: FIG, body: { reason: "Mark the bit positions under each field." } }]);
    await expect(figureCard(page)).toContainText("Mark the bit positions under each field.");
  });

  test("captures: the Figures card, at both widths", async ({ page }, info) => {
    await openFigures(page);
    await page.locator("[data-figures]").scrollIntoViewIfNeeded();
    const s = wide(info.project.name) ? "" : "-380";
    await page.locator("[data-figures]").screenshot({ path: "design/templates/console/content-figure/current" + s + ".png" });
  });
});

/* ======================================================================
 * /content — where each chapter stands
 * ==================================================================== */

test.describe("chapters: every one, every fact visible", () => {
  test("19 chapters, each linking to its editor", async ({ page }) => {
    await openList(page);
    const rows = page.locator("[data-chapter]");
    await expect(rows).toHaveCount(19);
    const link = page.locator('[data-chapter="04"]').getByRole("link", { name: "Cache Memory" });
    await expect(link).toHaveAttribute("href", "/studio/cpe-412/04");
  });

  test("status and summary state are words in every chapter's row, visible at 380 too", async ({ page }) => {
    /*
     * The old page's 380 table cut off Status, Blocks and Live items on every
     * row (`before-380.png`). Each of those must now sit inside the viewport.
     */
    await openList(page);
    const vw = page.viewportSize()!.width;
    for (const id of ["00", "04", "18"]) {
      const row = page.locator(`[data-chapter="${id}"]`);
      for (const fact of ["status", "summary", "blocks", "live"]) {
        const el = row.locator(`[data-fact="${fact}"]`);
        await expect(el, `${id} ${fact}`).toBeVisible();
        const box = (await el.boundingBox())!;
        expect(box.x + box.width, `${id} ${fact} is off-screen`).toBeLessThanOrEqual(vw);
      }
    }
    await expect(page.locator('[data-chapter="04"] [data-fact="status"]')).toHaveText("Authored");
    await expect(page.locator('[data-chapter="18"] [data-fact="status"]')).toHaveText("Planned");
    await expect(page.locator('[data-chapter="04"] [data-fact="summary"]')).toHaveText("To review");
  });

  test("the KPI row counts what is authored, what is approved and what is not in git", async ({ page }) => {
    await openList(page);
    await expect(page.locator("[data-kpi=authored]")).toContainText("8/19");
    await expect(page.locator("[data-kpi=summaries]")).toContainText("0/19");
    await expect(page.locator("[data-kpi=summaries]")).toContainText("19 to review");
    await expect(page.locator("[data-kpi=edits]")).toContainText(/every edit is in the files/i);
  });

  test("To review is its own address, so Back and a reload keep it", async ({ page }) => {
    await openList(page, {}, "review");
    await expect(page).toHaveURL(/\/studio\/review$/);
    await expect(page.getByRole("heading", { name: "To review", level: 1 })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-summary]").first().waitFor();
    await expect(page.getByRole("heading", { name: "To review", level: 1 })).toBeVisible();
  });

  test("numbers and stage ids are mono", async ({ page }) => {
    await openList(page);
    for (const sel of ['[data-chapter="04"] [data-fact="blocks"] .num', "[data-kpi=authored] .num", '[data-chapter="04"] [data-fact="id"]']) {
      expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily), sel).toMatch(/mono/i);
    }
  });
});

/* ======================================================================
 * summary review — approve or send back, bound to the text read
 * ==================================================================== */

test.describe("summaries: approval is of the exact text, and says what it does", () => {
  test("all 19 drafts are listed in full under To review", async ({ page }) => {
    await openList(page, {}, "review");
    await expect(page.locator("[data-group=draft] [data-summary]")).toHaveCount(19);
    await expect(page.locator('[data-summary="04"] [data-draft]')).toContainText("Why cache misses cost so much");
  });

  test("approving posts the text's hash once, says students see it now, and moves on", async ({ page }) => {
    const fx = await openList(page, {}, "review");
    const hash = await page.locator('[data-summary="00"]').getAttribute("data-hash");
    await page.locator('[data-summary="00"]').getByRole("button", { name: /^Approve/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /Stage 00 summary approved/ })).toContainText(/students see it/i);
    expect(fx.writes.approve).toEqual([{ stageId: "00", body: { hash } }]);
    // Focus goes to the next one waiting, not back to the top of the page.
    await expect(page.locator('[data-summary="01"]').getByRole("button", { name: /^Approve/ })).toBeFocused();
    await expect(page.locator("[data-group=approved] [data-summary=\"00\"]")).toBeVisible();
  });

  test("an approval of a text that has changed is refused, and the refusal stays", async ({ page }) => {
    await openList(page, { fail: "approve" }, "review");
    await page.locator('[data-summary="04"]').getByRole("button", { name: /^Approve/ }).click();
    const t = page.locator("[data-toaster]").getByRole("alert");
    await expect(t).toContainText(/changed since you opened it/i);
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("sending back needs a reason, says students will not see it, posts once and toasts", async ({ page }) => {
    const fx = await openList(page, {}, "review");
    const dialog = await openSendBack(page, "04");
    await expect(dialog).toContainText(/students will not see/i);
    const confirm = dialog.getByRole("button", { name: /^Send back stage 04/ });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/Reason/).fill("Name the four mapping functions.");
    await confirm.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /Stage 04 summary sent back/ })).toBeVisible();
    expect(fx.writes.sendBack).toEqual([{ stageId: "04", body: { reason: "Name the four mapping functions." } }]);
    await expect(page.locator('[data-group=sent_back] [data-summary="04"]')).toContainText("Name the four mapping functions.");
  });

  test("the chapter page carries its summary, under the page, with the same two controls", async ({ page }) => {
    await openChapter(page, {}, "04");
    const card = page.locator("[data-summary-card]");
    await expect(card).toContainText("Why cache misses cost so much");
    await expect(card.getByRole("button", { name: /^Approve/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Send back/ })).toBeVisible();
  });
});

/* ======================================================================
 * /content/:stageId — the editor and its preview
 * ==================================================================== */

/* ======================================================================
 * loading and failure — design.md
 * ==================================================================== */

test.describe("loading and failure — design.md", () => {
  test("a slow list shows a skeleton, never a blank", async ({ page }) => {
    await openList(page, { delayMs: 2_000 });
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 1_500 });
  });

  test("a failed list says so and offers a retry", async ({ page }) => {
    await openList(page, { status: 500 });
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText(/could not be loaded/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("a failed chapter says so and offers a retry", async ({ page }) => {
    await openChapter(page, { status: 500 });
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText(/could not be loaded/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

/* ======================================================================
 * COURSE STUDIO'S OWN CLAIMS — design/templates/console/studio/SPEC.md
 *
 * Everything above is what /content did, kept. Below is what the Studio adds:
 * the old addresses, three panes (sheets at 380), subjects and books, the
 * approval rule's disabled Approve, a chapter's tabs, and the locked AI pane.
 * ==================================================================== */

type Info = { project: { name: string } };
const barButton = (page: Page, name: RegExp) => page.getByRole("toolbar", { name: "Studio panes" }).getByRole("button", { name });
const outlineNav = (page: Page) => page.getByRole("navigation", { name: "Course outline" });

/** At 380 the outline is a sheet: open it. At 1440 it is already there. */
async function showOutline(page: Page, info: Info) {
  if (wide(info.project.name)) return;
  await barButton(page, /^Outline/).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400); // past the sheet's ease-in
}

async function showAi(page: Page, info: Info) {
  await barButton(page, /^AI Assistant/).click();
  if (!wide(info.project.name)) {
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(400);
  }
}

test.describe("studio: /content's old addresses still land", () => {
  const go = async (page: Page, path: string) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await useFixture(page);
    await page.goto(`${CONSOLE_URL}${path}`, { waitUntil: "domcontentloaded" });
  };
  test("/content is the Overview", async ({ page }) => {
    await go(page, "/content");
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByRole("heading", { name: "Course Studio", level: 1 })).toBeVisible();
  });
  test("/content?view=summaries is To review", async ({ page }) => {
    await go(page, "/content?view=summaries");
    await expect(page).toHaveURL(/\/studio\/review$/);
    await expect(page.getByRole("heading", { name: "To review", level: 1 })).toBeVisible();
  });
  test("/content/04 is chapter 04 of CPE 412", async ({ page }) => {
    await go(page, "/content/04");
    await expect(page).toHaveURL(/\/studio\/cpe-412\/04$/);
    await expect(page.getByRole("heading", { name: /Cache Memory/, level: 1 })).toBeVisible();
  });
});

test.describe("studio: three panes, and sheets at 380", () => {
  test("the outline lists every subject, its books and its 19 chapters, and marks what waits", async ({ page }, info) => {
    await openList(page);
    await showOutline(page, info);
    const nav = outlineNav(page);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Overview/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /^To review/ })).toContainText(/\d+/);
    const cpe = nav.locator('[data-subject="CPE 412"]');
    await expect(cpe).toContainText("Computer Architecture and Organization");
    await expect(cpe.getByRole("link", { name: /^Books/ })).toContainText("2");
    await expect(cpe.locator("a.st-chapter")).toHaveCount(19);
    await expect(cpe.locator('a.st-chapter[href="/studio/cpe-412/04"]')).toContainText("to review");
    expect(await cpe.locator(".st-chapter-id").first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/mono/i);
  });

  test("at 1440 the sidebar is ONE pane on the RIGHT of the editor, with two tabs; at 380 it is not on the page until asked for", async ({ page }, info) => {
    await openList(page);
    if (wide(info.project.name)) {
      const side = (await page.locator("[data-sidebar]").boundingBox())!;
      const e = (await page.locator(".st-editor").boundingBox())!;
      expect(side.x, "the sidebar sits to the right of the editor").toBeGreaterThan(e.x + e.width - 1);
      await expect(page.locator("[data-sidebar]")).toHaveCount(1);
      await expect(page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab")).toHaveText([/^Outline/, /^AI Assistant/]);
      await expect(page.getByRole("tab", { name: /^Outline/ })).toHaveAttribute("aria-selected", "true");
      await expect(barButton(page, /^Outline/)).toHaveAttribute("aria-pressed", "true");
      await barButton(page, /^Outline/).click();
      await expect(page.locator("[data-sidebar]")).toHaveCount(0);
      await expect(barButton(page, /^Outline/)).toHaveAttribute("aria-pressed", "false");
    } else {
      await expect(outlineNav(page)).toHaveCount(0);
      await expect(barButton(page, /^Outline/)).toHaveAttribute("aria-haspopup", "dialog");
    }
  });

  test("choosing a chapter in the 380 sheet closes it and opens the chapter", async ({ page }, info) => {
    test.skip(wide(info.project.name), "the sheet is a 380 layout");
    await openList(page);
    await showOutline(page, info);
    await page.getByRole("dialog").getByRole("link", { name: /Cache Memory/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/studio\/cpe-412\/04$/);
  });

  test("the two tabs switch with the arrow keys, and the AI tab says it is locked", async ({ page }, info) => {
    await openList(page);
    await showOutline(page, info);
    const outlineTab = page.getByRole("tab", { name: /^Outline/ });
    const aiTab = page.getByRole("tab", { name: /^AI Assistant/ });
    await expect(aiTab).toContainText("locked");
    await outlineTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(aiTab).toBeFocused();
    await expect(aiTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-ai-pane]")).toBeVisible();
    await expect(outlineTab).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowLeft");
    await expect(outlineTab).toHaveAttribute("aria-selected", "true");
    await expect(outlineNav(page)).toBeVisible();
  });

  test("a sheet closes on Escape and gives focus back to the button that opened it", async ({ page }, info) => {
    test.skip(wide(info.project.name), "the sheet is a 380 layout");
    await openList(page);
    await showOutline(page, info);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(barButton(page, /^Outline/)).toBeFocused();
    await showAi(page, info);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(barButton(page, /^AI Assistant/)).toBeFocused();
  });
});

test.describe("studio: the AI pane is locked, says so, and offers nothing to press", () => {
  test("it is closed until asked for, then says the app is not released and what it will check", async ({ page }, info) => {
    await openList(page);
    await expect(page.locator("[data-ai-pane]")).toHaveCount(0);
    await showAi(page, info);
    const pane = page.locator("[data-ai-pane]");
    await expect(pane).toBeVisible();
    await expect(pane).toContainText("The AI Assistant app is not released yet.");
    await expect(pane).toContainText("Locked");
    await expect(pane).toContainText(/against the book/);
    await expect(pane).toContainText(/against the syllabus/);
    await expect(pane).toContainText(/students' results/);
    await expect(pane).toContainText(/the writing/);
    await expect(pane).toContainText(/proposal you accept or discard/);
    await expect(pane).toContainText(/Nothing reaches students without a teacher's approval/);
  });

  test("the pane carries no control: a button that did nothing would be a dead end", async ({ page }, info) => {
    await openList(page);
    // The bar's button says it is locked, to a screen reader too (checked first:
    // at 380 the open sheet is modal and rightly hides the bar).
    await expect(barButton(page, /^AI Assistant/)).toContainText("(locked)");
    await showAi(page, info);
    const pane = page.locator("[data-ai-pane]");
    await expect(pane.getByRole("button")).toHaveCount(0);
    await expect(pane.getByRole("link")).toHaveCount(0);
    await expect(pane.locator("input, textarea, select")).toHaveCount(0);
  });
});

test.describe("studio: subjects and books, for every teacher, each with a reason", () => {
  async function openSubject(page: Page, opts: FixtureOpts = {}) {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    const fx = await useFixture(page, opts);
    await page.goto(`${CONSOLE_URL}/studio/cpe-412`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-books]").waitFor({ timeout: 15_000 });
    return fx;
  }

  test("the subject shows its code and title, its two books with one Default, and its classes", async ({ page }) => {
    await openSubject(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CPE 412 · Computer Architecture and Organization");
    await expect(page.locator("[data-book]")).toHaveCount(2);
    await expect(page.locator("[data-books] .text-success, [data-books] [class*=success]").first()).toContainText("Default");
    // Edit on both; Make default only on the one that is not the default.
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Make .* the default$/ })).toHaveCount(1);
    await expect(page.locator("[data-classes]")).toContainText(/class(es)? tak/);
    await expect(page.locator("[data-classes]").getByRole("link", { name: "Teachers" })).toHaveAttribute("href", "/teachers");
  });

  test("Add book needs a title and a reason, posts exactly them, and the list shows the new book", async ({ page }) => {
    const fx = await openSubject(page);
    await page.getByRole("button", { name: "Add book" }).click();
    const d = page.getByRole("dialog");
    await page.waitForTimeout(300);
    const add = d.getByRole("button", { name: "Add book" });
    await expect(add).toBeDisabled();
    await d.getByLabel("Title").fill("Computer Systems: A Programmer's Perspective");
    await d.getByLabel(/^Author/).fill("Bryant and O'Hallaron");
    await d.getByLabel(/^Edition/).fill("3rd");
    await expect(add, "no reason yet").toBeDisabled();
    await d.getByLabel(/^Reason/).fill("The second-term reference");
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /added to CPE 412/ })).toBeVisible();
    expect(fx.writes.studio).toEqual([{
      method: "POST", path: "/subjects/CPE 412/books",
      body: { title: "Computer Systems: A Programmer's Perspective", author: "Bryant and O'Hallaron", edition: "3rd", isDefault: false, reason: "The second-term reference" },
    }]);
    await expect(page.locator("[data-book]")).toHaveCount(3);
  });

  test("Make default says what happens, needs a reason, and posts it", async ({ page }) => {
    const fx = await openSubject(page);
    const tenth = page.locator("[data-book]").filter({ hasText: "10th" });
    const id = await tenth.getAttribute("data-book");
    await tenth.getByRole("button", { name: /^Make .* the default$/ }).click();
    const d = page.getByRole("dialog");
    await page.waitForTimeout(300);
    await expect(d).toContainText(/Classes of CPE 412 that have not chosen a book of their own now read this one/);
    await expect(d).toContainText(/stops being the default; it stays one of the subject's books/);
    const confirm = d.getByRole("button", { name: "Make default" });
    await expect(confirm).toBeDisabled();
    await d.getByLabel(/^Reason/).fill("The 10th edition this term");
    await confirm.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(fx.writes.studio).toEqual([{ method: "POST", path: `/books/${id}/default`, body: { reason: "The 10th edition this term" } }]);
    await expect(page.locator("[data-book]").filter({ hasText: "10th" })).toContainText("Default");
    await expect(page.locator("[data-book]").filter({ hasText: "9th" })).not.toContainText("Default");
  });

  test("Rename is offered only for a different title with a reason, and keeps the code", async ({ page }) => {
    const fx = await openSubject(page);
    await page.getByRole("button", { name: "Rename" }).click();
    const d = page.getByRole("dialog");
    await page.waitForTimeout(300);
    await expect(d).toContainText("never changes");
    const go = d.getByRole("button", { name: "Rename" });
    await expect(go, "the title is unchanged").toBeDisabled();
    await d.getByLabel("Title").fill("Computer Architecture and Organisation");
    await expect(go, "no reason yet").toBeDisabled();
    await d.getByLabel(/^Reason/).fill("British spelling, as the syllabus has it");
    await go.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(fx.writes.studio).toEqual([{
      method: "PATCH", path: "/subjects/CPE 412",
      body: { title: "Computer Architecture and Organisation", reason: "British spelling, as the syllabus has it" },
    }]);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Architecture and Organisation");
  });

  test("Add subject takes a real course code, lands on the new subject, and says it has no chapters yet", async ({ page }, info) => {
    const fx = await openList(page);
    await showOutline(page, info);
    await page.getByRole("button", { name: "Add subject" }).click();
    const d = page.getByRole("dialog").last();
    await page.waitForTimeout(300);
    const add = d.getByRole("button", { name: "Add subject" });
    await d.getByLabel("Title").fill("Embedded Systems");
    await d.getByLabel(/^Reason/).fill("Second-term course");
    await d.getByLabel("Course code").fill("embedded");
    await expect(add, "not a course code").toBeDisabled();
    await d.getByLabel("Course code").fill("cpe 413");
    await expect(add, "lowercase is accepted and sent as CPE 413").toBeEnabled();
    await add.click();
    await expect(page).toHaveURL(/\/studio\/cpe-413$/);
    expect(fx.writes.studio).toEqual([{ method: "POST", path: "/subjects", body: { code: "CPE 413", title: "Embedded Systems", reason: "Second-term course" } }]);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CPE 413 · Embedded Systems");
    await expect(page.locator("main")).toContainText(/No chapters yet/);
    await expect(page.locator("[data-books]")).toContainText(/No books yet/);
  });

  test("a refused write keeps the dialog and what was typed, and the error stays", async ({ page }) => {
    await openSubject(page, { fail: "subject" });
    await page.getByRole("button", { name: "Rename" }).click();
    const d = page.getByRole("dialog");
    await page.waitForTimeout(300);
    await d.getByLabel("Title").fill("Another title");
    await d.getByLabel(/^Reason/).fill("a good reason");
    await d.getByRole("button", { name: "Rename" }).click();
    await expect(d.getByRole("alert")).toContainText(/already exists/);
    await expect(d.getByLabel("Title")).toHaveValue("Another title");
    // By CSS, not by role: under a dialog the visible toaster is aria-hidden on purpose
    // (an announcer inside the dialog says it instead; toast.tsx).
    const t = page.locator('[data-toaster] [role="alert"]');
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("an unknown subject, and a chapter that does not exist, say so and link back", async ({ page }) => {
    await page.addInitScript((tk) => localStorage.setItem("octa:dev-token", tk as string), TEACHER);
    await useFixture(page);
    await page.goto(`${CONSOLE_URL}/studio/cpe-999`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-not-found]")).toContainText("No subject cpe-999.");
    await expect(page.locator("[data-not-found]").getByRole("link", { name: "Back to the Overview" })).toHaveAttribute("href", "/studio");
    await page.goto(`${CONSOLE_URL}/studio/cpe-412/42`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-not-found]")).toContainText("No chapter 42 in CPE 412.");
  });
});

test.describe("studio: the approval rule shows as a disabled Approve, with the reason beside it", () => {
  const NOT_SUBJECT = /Only a teacher of CPE 412 or the admin approves its content\./;
  const AUTHOR = /You wrote this version; another teacher of CPE 412 approves it\./;

  test("a teacher with no class of the subject: Approve is disabled on a summary and a figure, and Publish on a drafted chapter, each saying why", async ({ page }) => {
    const o: FixtureOpts = { me: { role: "teacher", approves: [] } };
    await openList(page, o, "review");
    const s = page.locator('[data-summary="04"]');
    await expect(s.getByRole("button", { name: /^Approve/ })).toBeDisabled();
    await expect(s.locator("[data-gate-note]")).toHaveText(NOT_SUBJECT);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, o, "08");
    await expect(page.getByRole("button", { name: /^Publish/ })).toBeDisabled();
    await expect(page.locator("#ed-gate")).toHaveText(NOT_SUBJECT);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, o, "10");
    await expect(figureCard(page).getByRole("button", { name: /^Approve figure/ })).toBeDisabled();
    await expect(figureCard(page).locator("[data-gate-note]")).toHaveText(NOT_SUBJECT);
    // Send back is not an approval: it stays.
    await expect(figureCard(page).getByRole("button", { name: /^Send back figure/ })).toBeEnabled();
  });

  test("the author of a version cannot approve it, and is told so", async ({ page }) => {
    await openList(page, { authoredBy: "me" }, "review");
    const s = page.locator('[data-summary="04"]');
    await expect(s.getByRole("button", { name: /^Approve/ })).toBeDisabled();
    await expect(s.locator("[data-gate-note]")).toHaveText(AUTHOR);
  });

  test("the admin may approve their own version: enabled, and it says it is recorded as self-approved", async ({ page }) => {
    const fx = await openList(page, { me: { role: "admin", approves: ["CPE 412"] }, authoredBy: "me" }, "review");
    const s = page.locator('[data-summary="04"]');
    await expect(s.locator("[data-gate-note]")).toContainText("recorded as self-approved");
    const approve = s.getByRole("button", { name: /^Approve/ });
    await expect(approve).toBeEnabled();
    await approve.click();
    expect(fx.writes.approve.map((a) => a.stageId)).toEqual(["04"]);
  });

  test("an ordinary teacher of the subject, approving another's or the files' version, sees no gate at all", async ({ page }) => {
    await openList(page, {}, "review");
    await expect(page.locator('[data-summary="04"]').getByRole("button", { name: /^Approve/ })).toBeEnabled();
    await expect(page.locator("[data-gate-note]")).toHaveCount(0);
  });

  test("the fixture's own author id is the token's subject (the author rule is tested against the real identity)", async () => {
    const payload = JSON.parse(Buffer.from(TEACHER.split(".")[1]!, "base64url").toString());
    expect(payload.sub).toBe(TEACHER_ID);
  });
});

test.describe("studio: To review gathers summaries, drafted text and figures", () => {
  test("three sections, each with its count, and drafted text and figures link to their chapter", async ({ page }) => {
    await openList(page, {}, "review");
    for (const n of ["Summaries", "Drafted lesson text", "Figures"]) {
      await expect(page.getByRole("heading", { name: new RegExp(`^${n}`), level: 2 })).toBeVisible();
    }
    await expect(page.locator('[data-waiting-draft="08"] a')).toHaveAttribute("href", "/studio/cpe-412/08");
    await expect(page.locator('[data-waiting-figures="10"] a')).toHaveAttribute("href", "/studio/cpe-412/10");
    // The summary groups sit under their section: h3 groups, h4 entries.
    await expect(page.locator("[data-group=draft] h3").first()).toContainText("To review");
    expect(await page.locator('[data-summary="04"] h4').count()).toBe(1);
  });

  test("the outline's To review carries the number waiting", async ({ page }, info) => {
    await openList(page);
    await showOutline(page, info);
    await expect(outlineNav(page).getByRole("link", { name: /^To review/ }).locator(".st-count")).toHaveText(/^\d+$/);
  });
});

test.describe("studio: captures, opened and looked at", () => {
  const dir = "design/templates/console/studio";
  const sfx = (info: Info) => (wide(info.project.name) ? "" : "-380");
  const full = async (page: Page, info: Info, name: string) => {
    // <main> is the scroller at lg: a full capture needs a viewport as tall as its content.
    if (wide(info.project.name)) {
      const h = await page.locator("main").evaluate((m) => { m.scrollTop = 0; return m.scrollHeight; });
      await page.setViewportSize({ width: 1440, height: Math.min(h + 40, 6000) });
      await page.waitForTimeout(250);
    }
    await page.screenshot({ path: `${dir}/${name}${sfx(info)}.png`, fullPage: true });
  };

  test("current: the Overview, and To review", async ({ page }, info) => {
    await openList(page);
    await full(page, info, "current");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openList(page, {}, "review");
    await full(page, info, "current-review");
  });

  test("current: the editor, a chapter being typed in, Publish, the student view, and a drafted chapter", async ({ page }, info) => {
    await openChapter(page, {}, "04");
    await page.screenshot({ path: `${dir}/current-chapter${sfx(info)}.png` });
    await typeSomething(page);
    await page.screenshot({ path: `${dir}/current-editing${sfx(info)}.png` });
    await page.getByRole("button", { name: /^Publish/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-publish${sfx(info)}.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Student view" }).click();
    await page.locator("[data-preview]").waitFor();
    await page.screenshot({ path: `${dir}/current-student${sfx(info)}.png` });
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, {}, "08");
    await page.screenshot({ path: `${dir}/current-draft${sfx(info)}.png` });
    await full(page, info, "current-moons");
  });

  test("current: a subject, the add-book dialog, and the outline and AI panes", async ({ page }, info) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await useFixture(page);
    await page.goto(`${CONSOLE_URL}/studio/cpe-412`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-books]").waitFor({ timeout: 15_000 });
    await full(page, info, "current-subject");
    await page.getByRole("button", { name: "Add book" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-dialog${sfx(info)}.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await showAi(page, info);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-ai${sfx(info)}.png` });
    if (!wide(info.project.name)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await showOutline(page, info);
      await page.screenshot({ path: `${dir}/current-outline${sfx(info)}.png` });
    }
  });
});
