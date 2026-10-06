import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { useFixture, type FixtureOpts } from "./_content-fixture";

/**
 * `/content` and `/content/:stageId`: where each chapter stands, the planet
 * summaries waiting for review, and the block editor.
 *
 * Rebuilt 28 Sep 2026 against `design/templates/console/content/SPEC.md`
 * (Decap's split editor, Dillinger's source pane, shadcn-admin's Tasks table).
 * The instructor's rulings of that day are each a test here: summaries
 * approved in the database and bound to their text, a block editor with a
 * live preview, quote blocks read-only, review in a Summaries view and on each
 * chapter.
 *
 * Reads are the real seed; writes are intercepted (`_content-fixture.ts`).
 * `console-teaching.spec.ts` keeps its two older /content tests.
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

/** Stage 04's block 2 is prose (editable); block 5 quotes ch-04.md 4.2 (read-only). */
const PROSE = 2;
const QUOTE = 5;

async function openList(page: Page, opts: FixtureOpts = {}, query = "") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/content${query}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs) {
    await page.locator(query.includes("summaries") ? "[data-summary]" : "[data-chapter]").first().waitFor({ timeout: 15_000 });
  }
  return fx;
}

async function openChapter(page: Page, opts: FixtureOpts = {}, id = "04") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/content/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  if (!opts.status && !opts.delayMs) await page.locator("[data-block]").first().waitFor({ timeout: 15_000 });
  return fx;
}

const block = (page: Page, n: number) => page.locator(`[data-block="${n}"]`);

/** At 380 the editor and the preview are one at a time. */
async function showHalf(page: Page, half: "Blocks" | "Preview") {
  const b = page.getByRole("button", { name: half, exact: true });
  if (await b.isVisible()) {
    await b.click();
    await expect(b).toHaveAttribute("aria-pressed", "true");
  }
}

async function startEdit(page: Page, n = PROSE) {
  await showHalf(page, "Blocks");
  await block(page, n).getByRole("button", { name: /^Edit block/ }).click();
  const editor = block(page, n).getByLabel(/^Source of block/);
  await expect(editor).toBeVisible();
  return editor;
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
  test("1 · nothing is clipped: chapters, summaries, the send-back dialog, the editor, history", async ({ page }) => {
    await openList(page);
    expect(await clippedElements(page), "chapters").toEqual([]);
    await page.getByRole("button", { name: /^Summaries/ }).click();
    await page.locator("[data-summary]").first().waitFor();
    expect(await clippedElements(page), "summaries").toEqual([]);
    await openSendBack(page, "04");
    expect(await clippedElements(page), "send-back dialog").toEqual([]);
    await page.keyboard.press("Escape");

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, { history: true });
    expect(await clippedElements(page), "chapter").toEqual([]);
    await startEdit(page);
    expect(await clippedElements(page), "editing").toEqual([]);
    await block(page, PROSE).getByRole("button", { name: /^History/ }).click();
    await block(page, PROSE).locator("[data-version]").first().waitFor();
    expect(await clippedElements(page), "history").toEqual([]);
    await showHalf(page, "Preview");
    expect(await clippedElements(page), "preview").toEqual([]);
  });

  test("2 · no horizontal page scroll, on either route", async ({ page }) => {
    await openList(page);
    expect(await horizontalOverflow(page), "chapters").toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: /^Summaries/ }).click();
    await page.locator("[data-summary]").first().waitFor();
    expect(await horizontalOverflow(page), "summaries").toBeLessThanOrEqual(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    await startEdit(page);
    expect(await horizontalOverflow(page), "editing").toBeLessThanOrEqual(0);
    await showHalf(page, "Preview");
    expect(await horizontalOverflow(page), "preview").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openList(page);
    expect(await unreachableByKeyboard(page, "main"), "chapters").toEqual([]);
    const tab = page.getByRole("button", { name: /^Summaries/ });
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-summary]").first().waitFor();
    expect(await unreachableByKeyboard(page, "main"), "summaries").toEqual([]);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, { history: true });
    expect(await unreachableByKeyboard(page, "main"), "chapter").toEqual([]);
    // Open the editor without the mouse, and Cancel returns focus to Edit.
    await showHalf(page, "Blocks");
    const edit = block(page, PROSE).getByRole("button", { name: /^Edit block/ });
    await edit.focus();
    await page.keyboard.press("Enter");
    const source = block(page, PROSE).getByLabel(/^Source of block/);
    await expect(source).toBeFocused();
    expect(await unreachableByKeyboard(page, "main"), "editing").toEqual([]);
    await block(page, PROSE).getByRole("button", { name: "Cancel" }).focus();
    await page.keyboard.press("Enter");
    await expect(edit).toBeFocused();
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openList(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: chapters`).toEqual([]);
    }
    await page.getByRole("button", { name: /^Summaries/ }).click();
    await page.locator("[data-summary]").first().waitFor();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: summaries`).toEqual([]);
    }
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page, { history: true });
    await startEdit(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: editor`).toEqual([]);
      await showHalf(page, "Preview");
      expect(await contrastFailures(page), `${theme}: preview`).toEqual([]);
      await showHalf(page, "Blocks");
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openList(page);
    expect(await offTokenStyles(page), "chapters").toEqual([]);
    await page.getByRole("button", { name: /^Summaries/ }).click();
    await page.locator("[data-summary]").first().waitFor();
    expect(await offTokenStyles(page), "summaries").toEqual([]);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChapter(page);
    await startEdit(page);
    expect(await offTokenStyles(page), "editor").toEqual([]);
    await showHalf(page, "Preview");
    expect(await offTokenStyles(page), "preview").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, the send-back dialog eases in.
    await recordMotion(page);
    await openList(page, {}, "?view=summaries");
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
    await page.getByRole("button", { name: "Chapters", exact: true }).click();
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * Drafted lesson text — instructor ruling, 5 Oct 2026
 *
 * Chapter 08's text was drafted from book chapter 8 and waits, staff-only,
 * for approval. The six gate assertions run on its card, then what it owes:
 * approval of the exact text, a reason to send it back, and words for both.
 * ==================================================================== */

async function openDraft(page: Page, opts: FixtureOpts = {}) {
  const fx = await openChapter(page, opts, "08");
  await page.locator("[data-draft-card]").waitFor({ timeout: 15_000 });
  return fx;
}
const draftCard = (page: Page) => page.locator("[data-draft-card]");

test.describe("drafted lesson text: the gate, on the draft card", () => {
  test("1-3 · nothing clipped, no horizontal scroll, every control by keyboard (and the send-back dialog)", async ({ page }) => {
    await openDraft(page);
    expect(await clippedElements(page), "draft card").toEqual([]);
    expect(await horizontalOverflow(page), "draft card").toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "main"), "draft card").toEqual([]);
    await draftCard(page).getByRole("button", { name: /^Send back stage 08/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await clippedElements(page), "send-back dialog").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openDraft(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `${theme}: draft`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openDraft(page);
    expect(await offTokenStyles(page), "draft").toEqual([]);
  });

  test("6 · under reduced motion the send-back dialog does not animate", async ({ page }) => {
    await recordMotion(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDraft(page);
    await draftCard(page).getByRole("button", { name: /^Send back stage 08/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still).toEqual([]);
  });
});

test.describe("drafted lesson text: approval is of the exact text, and says what it does", () => {
  test("the card says no student reads it, counts its blocks and quotes, and draws the draft as a student would", async ({ page }) => {
    await openDraft(page);
    const card = draftCard(page);
    await expect(card).toHaveAttribute("data-draft-status", "draft");
    await expect(card).toContainText("Waiting for your review");
    await expect(card).toContainText(/No student reads it until you approve it/);
    await expect(card).toContainText(/quoted from the book, each checked against it by sync/);
    await expect(card.getByRole("heading", { name: /The draft · as a student would read it/ })).toBeVisible();
    await expect(card.locator("[data-preview]")).toContainText("An OS is a program that controls the execution of application programs");
  });

  test("approving posts the text's hash once and says students read it now", async ({ page }) => {
    const fx = await openDraft(page);
    const api = process.env.OCTA_API_URL ?? "http://localhost:8090";
    const res = await page.request.get(`${api}/api/v1/console/content/08`, { headers: { authorization: `Bearer ${TEACHER}` } });
    const real = ((await res.json()) as { draft: { hash: string } }).draft.hash;
    await draftCard(page).getByRole("button", { name: /^Approve stage 08 lesson text/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /Stage 08 lesson text approved/ })).toContainText(/Students read these \d+ blocks now/);
    expect(fx.writes.approveDraft).toEqual([{ stageId: "08", body: { hash: real } }]);
    await expect(draftCard(page)).toHaveAttribute("data-draft-status", "approved");
  });

  test("an approval of a draft that has changed is refused, and the refusal stays", async ({ page }) => {
    await openDraft(page, { fail: "approve-draft" });
    await draftCard(page).getByRole("button", { name: /^Approve stage 08 lesson text/ }).click();
    const t = page.locator("[data-toaster]").getByRole("alert");
    await expect(t).toContainText(/changed since you opened it/i);
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("sending back needs a reason, says what happens, posts once, and shows the reason", async ({ page }) => {
    const fx = await openDraft(page);
    await draftCard(page).getByRole("button", { name: /^Send back stage 08/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/Students read none of it/);
    const confirm = dialog.getByRole("button", { name: /^Send back stage 08/ });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/Reason/).fill("Add the book's own paging figure, described.");
    await confirm.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /Stage 08 lesson text sent back/ })).toBeVisible();
    expect(fx.writes.sendBackDraft).toEqual([{ stageId: "08", body: { reason: "Add the book's own paging figure, described." } }]);
    await expect(draftCard(page)).toContainText("Add the book's own paging figure, described.");
  });

  test("the chapters list says a chapter's text is waiting, in words", async ({ page }) => {
    await openList(page);
    await expect(page.locator('[data-chapter="08"] [data-fact="draft"]').first()).toHaveText("Text to review");
    await expect(page.locator('[data-chapter="04"] [data-fact="draft"]')).toHaveCount(0);
  });

  test("captures: the draft card, at both widths", async ({ page }, info) => {
    await openDraft(page);
    await draftCard(page).scrollIntoViewIfNeeded();
    const s = wide(info.project.name) ? "" : "-380";
    await page.screenshot({ path: `design/templates/console/content/current-draft${s}.png` });
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

  test("the previews draw the figure block with its caption and the book's figure number", async ({ page }) => {
    await openFigures(page);
    const fig = page.locator("[data-draft-card] [data-preview-figure=\"" + FIG + "\"]");
    await expect(fig.getByRole("img", { name: "A simple 16-bit instruction format" })).toBeVisible();
    await expect(fig).toContainText("After Stallings, Figure 12.2. Redrawn for this course.");
    await expect(fig).toContainText("Not approved yet: students do not see this figure.");
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
    await expect(link).toHaveAttribute("href", "/content/04");
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

  test("the view is in the address, so Back and a reload keep it", async ({ page }) => {
    await openList(page);
    await page.getByRole("button", { name: /^Summaries/ }).click();
    await expect(page).toHaveURL(/\?view=summaries/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^Summaries/ })).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-summary]").first().waitFor();
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
    await openList(page, {}, "?view=summaries");
    await expect(page.locator("[data-group=draft] [data-summary]")).toHaveCount(19);
    await expect(page.locator('[data-summary="04"] [data-draft]')).toContainText("Why cache misses cost so much");
  });

  test("approving posts the text's hash once, says students see it now, and moves on", async ({ page }) => {
    const fx = await openList(page, {}, "?view=summaries");
    const hash = await page.locator('[data-summary="00"]').getAttribute("data-hash");
    await page.locator('[data-summary="00"]').getByRole("button", { name: /^Approve/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /Stage 00 summary approved/ })).toContainText(/students see it/i);
    expect(fx.writes.approve).toEqual([{ stageId: "00", body: { hash } }]);
    // Focus goes to the next one waiting, not back to the top of the page.
    await expect(page.locator('[data-summary="01"]').getByRole("button", { name: /^Approve/ })).toBeFocused();
    await expect(page.locator("[data-group=approved] [data-summary=\"00\"]")).toBeVisible();
  });

  test("an approval of a text that has changed is refused, and the refusal stays", async ({ page }) => {
    await openList(page, { fail: "approve" }, "?view=summaries");
    await page.locator('[data-summary="04"]').getByRole("button", { name: /^Approve/ }).click();
    const t = page.locator("[data-toaster]").getByRole("alert");
    await expect(t).toContainText(/changed since you opened it/i);
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("sending back needs a reason, says students will not see it, posts once and toasts", async ({ page }) => {
    const fx = await openList(page, {}, "?view=summaries");
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

  test("the chapter page carries its summary with the same two controls", async ({ page }) => {
    await openChapter(page);
    const card = page.locator("[data-summary-card]");
    await expect(card).toContainText("Why cache misses cost so much");
    await expect(card.getByRole("button", { name: /^Approve/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Send back/ })).toBeVisible();
  });
});

/* ======================================================================
 * /content/:stageId — the editor and its preview
 * ==================================================================== */

test.describe("the editor: one block at a time, the preview follows the typing", () => {
  test("every block is listed in order, and the preview renders the chapter", async ({ page }) => {
    await openChapter(page);
    // Chapter 04 has 32 blocks since c08fc7e (6 Oct) drew the address split as
    // a figure; the full run of 7 Oct caught this count still at 31.
    await expect(page.locator("[data-block]")).toHaveCount(32);
    await showHalf(page, "Preview");
    await expect(page.locator("[data-preview] [data-preview-block]")).toHaveCount(32);
    // Code in mono, exactly as the student reader draws it.
    expect(await page.locator('[data-preview-block="3"] pre').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/mono/i);
  });

  test("typing changes the preview before anything is saved", async ({ page }) => {
    await openChapter(page);
    const src = await startEdit(page);
    await src.fill("A new **opening** for the trade-off.");
    await showHalf(page, "Preview");
    const p = page.locator(`[data-preview-block="${PROSE}"]`);
    await expect(p).toHaveAttribute("data-editing", "true");
    await expect(p.locator("strong")).toHaveText("opening");
  });

  test("Save needs a change and a reason, posts the version it opened, and toasts the new one", async ({ page }) => {
    const fx = await openChapter(page);
    const version = Number(await block(page, PROSE).getAttribute("data-version"));
    const src = await startEdit(page);
    const save = block(page, PROSE).getByRole("button", { name: /^Save/ });
    await expect(save).toBeDisabled();
    await src.fill("The problem, stated as a trade, in fewer words.");
    await expect(save, "no reason yet").toBeDisabled();
    await block(page, PROSE).getByLabel(/What changed/).fill("tighten the opening");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`Stage 04, block ${PROSE} saved as version ${version + 1}`) })).toBeVisible();
    expect(fx.writes.edit).toEqual([{
      id: await block(page, PROSE).getAttribute("data-block-id"),
      body: { body: "The problem, stated as a trade, in fewer words.", version, reason: "tighten the opening" },
    }]);
    await expect(block(page, PROSE)).toContainText(/edited in the console/i);
  });

  test("a stale save keeps the typed text and says what happened, and the message stays", async ({ page }) => {
    await openChapter(page, { fail: "stale" });
    const src = await startEdit(page);
    await src.fill("My edit.");
    await block(page, PROSE).getByLabel(/What changed/).fill("typo");
    await block(page, PROSE).getByRole("button", { name: /^Save/ }).click();
    const t = page.locator("[data-toaster]").getByRole("alert");
    await expect(t).toContainText(/Someone saved this block/);
    await expect(src).toHaveValue("My edit.");
    await page.waitForTimeout(4_500);
    await expect(t).toBeVisible();
  });

  test("a quote from the book has no Edit control, and says where to edit it", async ({ page }) => {
    await openChapter(page);
    await showHalf(page, "Blocks");
    const q = block(page, QUOTE);
    await expect(q.getByRole("button", { name: /^Edit block/ })).toHaveCount(0);
    await expect(q).toContainText("ch-04.md 4.2");
    await expect(q).toContainText("content/stages/04.md");
  });

  test("history lists what was replaced, and Use this text loads it for an ordinary edit", async ({ page }) => {
    await openChapter(page, { history: true });
    await showHalf(page, "Blocks");
    await block(page, PROSE).getByRole("button", { name: /^History/ }).click();
    const v = block(page, PROSE).locator("[data-version]");
    await expect(v).toHaveCount(2);
    await expect(v.first()).toContainText("typo in the second sentence");
    await expect(v.first()).toContainText(/console/i);
    await v.first().getByRole("button", { name: /^Use this text/ }).click();
    await expect(block(page, PROSE).getByLabel(/^Source of block/)).toHaveValue("An earlier wording, fixed in the console.");
  });

  test("the source is mono and counts its characters", async ({ page }) => {
    await openChapter(page);
    const src = await startEdit(page);
    expect(await src.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/mono/i);
    await src.fill("12345");
    await expect(block(page, PROSE).locator("[data-count]")).toHaveText(/5 characters/);
  });

  test("at 1440 the blocks and the preview sit side by side", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "the split is a 1440 layout; 380 is one at a time");
    await openChapter(page);
    const a = (await page.locator("[data-blocks]").boundingBox())!;
    const b = (await page.locator("[data-preview]").boundingBox())!;
    expect(b.x, "the preview should be to the right of the blocks").toBeGreaterThan(a.x + a.width - 1);
  });
});

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
