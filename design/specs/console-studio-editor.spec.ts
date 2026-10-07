import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { TEACHER_ID, useFixture, type FixtureOpts } from "./_content-fixture";

/**
 * The Studio's editor (`/studio/cpe-412/:stageId`, E1, 8 Oct 2026;
 * `docs/STUDIO-EDITOR-PLAN.md`): a chapter is a page you type on, a topic is a
 * block of it, and nothing reaches a student until Publish. The six gate
 * assertions for the route are in `console-studio.spec.ts`; this file holds
 * the editor's own claims, each one a thing a teacher does.
 *
 * Reads are the real seed (a real chapter 04: prose, a book quote, a figure);
 * the working copy's writes are intercepted and replayed by the fixture
 * (`_content-fixture.ts`), so what is asserted is what would have been sent.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: TEACHER_ID,
    email: "teacher@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}
const TEACHER = teacherToken();

interface Wire { id: string | null; kind: string; body: string; meta: Record<string, string>; locked?: boolean }
interface Loaded { reads: Array<{ blocks: Wire[]; version: number; hash: string }> }

/** Open a chapter in the editor, remembering what the working-copy read returned (the originals). */
async function open(page: Page, opts: FixtureOpts = {}, id = "04") {
  const loaded: Loaded = { reads: [] };
  page.on("response", async (r) => {
    if (r.request().method() !== "GET") return;
    if (!/\/console\/content\/\d\d\/working$/.test(new URL(r.url()).pathname)) return;
    loaded.reads.push((await r.json().catch(() => null)) as Loaded["reads"][number]);
  });
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/studio/cpe-412/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  await page.locator("[data-editor-shell] .ed-prose").first().waitFor({ timeout: 15_000 });
  return { fx, loaded };
}

const topics = (page: Page) => page.locator(".ed-prose [data-topic-id]");
const status = (page: Page) => page.locator("[data-save-status]");
const saved = (page: Page) => expect(status(page)).toHaveAttribute("data-save-status", "saved", { timeout: 10_000 });
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Formatting and topics" });

/** The first text topic's first paragraph: a place to click and type that is not locked. */
const firstText = (page: Page) => page.locator('.ed-prose [data-topic-kind="prose"] .ed-content p').first();

/** Add a text topic under the cursor's topic, and leave the cursor in it, empty. */
async function addTextTopic(page: Page) {
  const before = await topics(page).count();
  await toolbar(page).getByRole("button", { name: "Add a topic" }).click();
  await page.getByRole("menuitem", { name: "Text topic" }).click();
  await expect(topics(page)).toHaveCount(before + 1);
}

const lastSave = (fx: { writes: { save: Array<{ body: { version: number; blocks: Wire[] } }> } }) => fx.writes.save.at(-1)!.body;

test.describe("the editor: the chapter is a page, a topic is a block of it", () => {
  test("the chapter opens as topics on a page, with a toolbar, and the book's quote is locked", async ({ page }) => {
    const { loaded } = await open(page);
    await expect(toolbar(page)).toBeVisible();
    const n = await topics(page).count();
    expect(n, "the chapter has topics").toBeGreaterThan(2);
    expect(n, "every stored block is a topic").toBe(loaded.reads[0]!.blocks.length);
    const quote = page.locator('.ed-prose [data-topic-kind="quote"]').first();
    await expect(quote).toContainText("Locked");
    await expect(status(page)).toHaveAttribute("data-save-status", "saved");
    await expect(status(page)).not.toContainText("draft, not published");
    // Nothing is a draft until something is typed: Publish and Discard wait.
    await expect(page.locator("[data-publish]")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(0);
  });

  test("typing saves a draft on its own: the version it opened, every untouched topic as it was, the typed one changed", async ({ page }) => {
    const { fx, loaded } = await open(page);
    const first = loaded.reads[0]!;
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" A sentence typed just now.", { delay: 5 });
    await expect(status(page)).toHaveAttribute("data-save-status", /dirty|saving|saved/);
    await saved(page);
    await expect(status(page)).toContainText("draft, not published");
    expect(fx.writes.save.length, "one save for one burst of typing").toBe(1);
    const body = lastSave(fx);
    expect(body.version, "the version it opened, so a stale save is a 409").toBe(first.version);
    expect(body.blocks.length).toBe(first.blocks.length);
    const changed = body.blocks.filter((b, i) => b.body !== first.blocks[i]!.body);
    expect(changed, "exactly one topic differs").toHaveLength(1);
    expect(changed[0]!.body).toContain("A sentence typed just now.");
    body.blocks.forEach((b, i) => {
      expect(b.id, `topic ${i} keeps its id, so its history follows it`).toBe(first.blocks[i]!.id);
      expect(b.kind).toBe(first.blocks[i]!.kind);
    });
    await expect(page.locator("[data-publish]")).toBeEnabled();
  });

  test("only the topic the cursor is in shows its controls, and they follow the cursor", async ({ page }) => {
    await open(page);
    const active = page.locator(".ed-prose .ed-topic.is-active");
    await firstText(page).click();
    await expect(active).toHaveCount(1);
    const first = await active.getAttribute("data-topic-id");
    expect(first).toBe(await page.locator('.ed-prose [data-topic-kind="prose"]').first().getAttribute("data-topic-id"));
    // A different topic: the marker leaves the first and lands on the second, never on both.
    await page.locator('.ed-prose [data-topic-kind="brief"] .ed-content p').first().click();
    await expect(active).toHaveCount(1);
    await expect(active).not.toHaveAttribute("data-topic-id", first!);
    await expect(active.locator("> .ed-gutter")).toBeVisible();
    // The controls of a topic the cursor is not in are not Tab stops: forty topics would be a hundred and sixty.
    await expect(page.locator('.ed-prose .ed-topic:not(.is-active) > .ed-gutter button:visible')).toHaveCount(0);
  });

  test("a reload brings the draft back, and says it is not published", async ({ page }) => {
    const { fx } = await open(page);
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Still here after a reload.", { delay: 5 });
    await saved(page);
    expect(fx.writes.save.length).toBe(1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-editor-shell] .ed-prose").first().waitFor({ timeout: 15_000 });
    await expect(page.locator(".ed-prose")).toContainText("Still here after a reload.");
    await expect(status(page)).toContainText("draft, not published");
    await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();
  });

  test("the toolbar formats what is selected: bold, italic, a heading and a list are written as the reader's own shapes", async ({ page }) => {
    const { fx } = await open(page);
    await addTextTopic(page);
    await page.keyboard.type("alpha beta", { delay: 5 });
    await page.keyboard.press("Shift+Control+ArrowLeft"); // selects "beta"
    await toolbar(page).getByRole("button", { name: "Bold" }).click();
    await saved(page);
    expect(lastSave(fx).blocks.find((b) => b.body.includes("alpha"))!.body).toBe("alpha **beta**");

    await toolbar(page).getByRole("button", { name: "Bold" }).click(); // off again
    await toolbar(page).getByRole("button", { name: "Italic" }).click();
    await saved(page);
    expect(lastSave(fx).blocks.find((b) => b.body.includes("alpha"))!.body).toBe("alpha *beta*");
    await toolbar(page).getByRole("button", { name: "Italic" }).click();

    await page.getByLabel("Paragraph style").selectOption("3");
    await saved(page);
    expect(lastSave(fx).blocks.find((b) => b.body.includes("alpha"))!.body).toMatch(/^### alpha beta$/);
    await page.getByLabel("Paragraph style").selectOption("p");

    await toolbar(page).getByRole("button", { name: "Bulleted list" }).click();
    await saved(page);
    expect(lastSave(fx).blocks.find((b) => b.body.includes("alpha"))!.body).toBe("- alpha beta");
  });

  test("Add topic puts a new, empty topic under the cursor's, and it is saved as one more block with no history yet", async ({ page }) => {
    const { fx, loaded } = await open(page);
    const before = loaded.reads[0]!.blocks.length;
    await firstText(page).click();
    await addTextTopic(page);
    await page.keyboard.type("A topic that is new.", { delay: 5 });
    await saved(page);
    const blocks = lastSave(fx).blocks;
    expect(blocks.length).toBe(before + 1);
    const idx = blocks.findIndex((b) => b.body === "A topic that is new.");
    expect(idx, "directly under the topic the cursor was in").toBe(loaded.reads[0]!.blocks.findIndex((b) => b.id === blocks[idx - 1]!.id) + 1);
    expect(blocks[idx]!.kind).toBe("prose");
  });

  test("a topic moves up and down with the toolbar and with Alt+Arrow, and the saved order follows", async ({ page }) => {
    const { fx, loaded } = await open(page);
    const ids = loaded.reads[0]!.blocks.map((b) => b.id);
    await firstText(page).click();
    const startIndex = ids.indexOf(await page.locator('.ed-prose [data-topic-kind="prose"]').first().getAttribute("data-topic-id"));
    expect(startIndex).toBeGreaterThanOrEqual(0);
    await toolbar(page).getByRole("button", { name: "Move this topic down" }).click();
    await saved(page);
    const movedId = ids[startIndex]!;
    expect(lastSave(fx).blocks.map((b) => b.id).indexOf(movedId)).toBe(startIndex + 1);
    // Alt+Up brings it back, from the keyboard alone.
    await page.keyboard.press("Alt+ArrowUp");
    await saved(page);
    expect(lastSave(fx).blocks.map((b) => b.id)).toEqual(ids);
  });

  test("Delete this topic removes the topic the cursor is in, and nothing else", async ({ page }) => {
    const { fx, loaded } = await open(page);
    await addTextTopic(page);
    await page.keyboard.type("Remove me.", { delay: 5 });
    await saved(page);
    const withIt = lastSave(fx).blocks.length;
    await toolbar(page).getByRole("button", { name: "Delete this topic" }).click();
    await saved(page);
    const body = lastSave(fx);
    expect(body.blocks.length).toBe(withIt - 1);
    expect(body.blocks.map((b) => b.id)).toEqual(loaded.reads[0]!.blocks.map((b) => b.id));
    expect(body.blocks.some((b) => b.body === "Remove me.")).toBe(false);
  });

  test("a quote from the book cannot be typed into: its words are the book's, checked word for word", async ({ page }) => {
    const { fx, loaded } = await open(page);
    const quote = page.locator('.ed-prose [data-topic-kind="quote"]').first();
    await quote.scrollIntoViewIfNeeded();
    const before = (await quote.textContent()) ?? "";
    await quote.click();
    await page.keyboard.type("zzzz typed over a quote", { delay: 5 });
    await page.waitForTimeout(1200); // past the autosave
    expect(await quote.textContent()).toBe(before);
    await expect(page.locator(".ed-prose")).not.toContainText("zzzz typed over a quote");
    expect(fx.writes.save.length, "nothing was typed, so nothing was saved").toBe(0);
    // It can be moved, though: the same toolbar, and the saved block is still the book's text.
    const id = await quote.getAttribute("data-topic-id");
    await toolbar(page).getByRole("button", { name: "Move this topic down" }).click();
    await saved(page);
    const sent = lastSave(fx).blocks.find((b) => b.id === id)!;
    const original = loaded.reads[0]!.blocks.find((b) => b.id === id)!;
    expect(sent.body).toBe(original.body);
    expect(sent.meta).toEqual(original.meta);
  });

  test("Student view shows the chapter as a student reads it, with the typing in it, and the editor's controls wait", async ({ page }) => {
    await open(page);
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Seen by the preview.", { delay: 5 });
    await saved(page);
    const toggle = page.getByRole("button", { name: "Student view" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const preview = page.locator("[data-preview]");
    await expect(preview).toContainText("Seen by the preview.");
    await expect(page.locator(".ed-page")).toBeHidden();
    await expect(toolbar(page).getByRole("button", { name: "Bold" })).toBeDisabled();
    await expect(toolbar(page).getByRole("button", { name: "Add a topic" })).toBeDisabled();
    await toggle.click();
    await expect(preview).toHaveCount(0);
    await expect(page.locator(".ed-page")).toBeVisible();
    await expect(toolbar(page).getByRole("button", { name: "Bold" })).toBeEnabled();
  });

  test("text a student would read differently is said so, before Publish: the reader has no way to escape a star", async ({ page }) => {
    await open(page);
    await addTextTopic(page);
    await page.keyboard.type("the value a*b*c here", { delay: 5 });
    await expect(page.locator('[data-banner="collisions"]')).toBeVisible();
    await expect(page.locator('[data-banner="collisions"]')).toContainText("differently");
  });
});

test.describe("the editor: failure never loses what was typed", () => {
  test("a save that is refused as stale says who got there first, and keeps the typing on the page", async ({ page }) => {
    const { fx } = await open(page, { fail: "save-stale" });
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Typed against a stale page.", { delay: 5 });
    const banner = page.locator('[data-banner="save-failed"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText("Someone saved this chapter's draft");
    await expect(status(page)).toHaveAttribute("data-save-status", "conflict");
    await expect(page.locator(".ed-prose")).toContainText("Typed against a stale page.");
    await expect(page.locator("[data-publish]"), "an unsaved page cannot be published").toBeDisabled();
    expect(fx.writes.save).toHaveLength(0);
    await expect(banner.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  test("a save that fails says so, keeps the typing, and Publish waits", async ({ page }) => {
    await open(page, { fail: "save" });
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Typed while the database was down.", { delay: 5 });
    const banner = page.locator('[data-banner="save-failed"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText("Your typing is still on this page.");
    await expect(status(page)).toHaveAttribute("data-save-status", "error");
    await expect(page.locator(".ed-prose")).toContainText("Typed while the database was down.");
    await expect(page.locator("[data-publish]")).toBeDisabled();
  });

  test("a draft begun against text that has since changed says so, and cannot be published", async ({ page }) => {
    await open(page, { stale: true });
    const banner = page.locator('[data-banner="stale"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Discard this draft and start again");
    await expect(page.locator("[data-publish]")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Discard draft" })).toBeEnabled();
  });
});

test.describe("the editor: Publish is the only way a student sees a change", () => {
  async function typeAndSave(page: Page) {
    await firstText(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Ready to publish.", { delay: 5 });
    await saved(page);
  }

  test("Publish… opens a dialog that says what changes, needs a reason, and posts the saved draft's hash once", async ({ page }) => {
    const { fx } = await open(page);
    await typeAndSave(page);
    await page.locator("[data-publish]").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Publish stage 04?" })).toBeVisible();
    await expect(dialog.locator("[data-publish-summary]")).toContainText("changed");
    await expect(dialog.locator("[data-publish-summary]")).toContainText(/1\s*changed/);
    const go = dialog.getByRole("button", { name: "Publish stage 04" });
    await expect(go, "a reason is required").toBeDisabled();
    await dialog.getByLabel("What changed (required)").fill("Added a closing sentence");
    await expect(go).toBeEnabled();
    await go.click();
    await expect(page.getByRole("status").filter({ hasText: "Stage 04 published" })).toBeVisible();
    expect(fx.writes.publish).toHaveLength(1);
    expect(fx.writes.publish[0]!.body.reason).toBe("Added a closing sentence");
    expect(fx.writes.publish[0]!.body.hash, "the hash of the draft that was saved").toBe(`fixture-draft-${fx.writes.save.length}`);
    // Published: the draft is gone, and the page reads as live.
    await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(0);
    await expect(status(page)).not.toContainText("draft, not published");
  });

  test("a publish that is refused keeps the dialog open with the reason in it, and says why", async ({ page }) => {
    const { fx } = await open(page, { fail: "publish" });
    await typeAndSave(page);
    await page.locator("[data-publish]").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What changed (required)").fill("A reason that must survive");
    await dialog.getByRole("button", { name: "Publish stage 04" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Not published.");
    await expect(dialog.getByRole("alert")).toContainText("The published chapter changed");
    await expect(dialog.getByLabel("What changed (required)")).toHaveValue("A reason that must survive");
    expect(fx.writes.publish).toHaveLength(0);
  });

  test("Discard draft asks first, says students saw nothing, and returns the chapter to the published text", async ({ page }) => {
    const { fx } = await open(page);
    await typeAndSave(page);
    await page.getByRole("button", { name: "Discard draft" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Students saw none of it");
    await dialog.getByRole("button", { name: "Keep the draft" }).click();
    await expect(dialog).toBeHidden();
    expect(fx.writes.discard).toHaveLength(0);
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Stage 04 draft discarded" })).toBeVisible();
    expect(fx.writes.discard).toEqual(["04"]);
    await expect(page.locator(".ed-prose")).not.toContainText("Ready to publish.");
  });

  test("a chapter drafted from the textbook opens as a draft to review: Publish is ready, and it can be sent back", async ({ page }) => {
    const { fx } = await open(page, {}, "08");
    const banner = page.locator('[data-banner="file"]');
    await expect(banner).toContainText("drafted from the textbook");
    await expect(banner.getByRole("button", { name: /^Send back/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Discard draft" }), "the file is the source: there is nothing to discard").toHaveCount(0);
    await expect(page.locator("[data-publish]")).toBeEnabled();
    await page.locator("[data-publish]").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("[data-publish-summary]")).toContainText("Replaces");
    await dialog.getByLabel("What changed (required)").fill("Read it through; approved as drafted");
    await dialog.getByRole("button", { name: "Publish stage 08" }).click();
    await expect.poll(() => fx.writes.publish.length).toBe(1);
    expect(fx.writes.publish[0]!.stageId).toBe("08");
  });
});

test.describe("studio-editor: captures, opened and looked at", () => {
  const dir = "design/templates/console/studio";
  const sfx = (info: { project: { name: string } }) => (info.project.name === "desktop-1440" ? "" : "-380");

  test("current: the page with a topic active, a new topic, a locked quote, and the collisions note", async ({ page }, info) => {
    await open(page);
    await firstText(page).click();
    await page.screenshot({ path: `${dir}/editor-active${sfx(info)}.png` });
    await addTextTopic(page);
    await page.keyboard.type("the value a*b*c here", { delay: 5 });
    await page.screenshot({ path: `${dir}/editor-new-topic${sfx(info)}.png` });
    await page.locator('.ed-prose [data-topic-kind="quote"]').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/editor-quote${sfx(info)}.png` });
  });
});
