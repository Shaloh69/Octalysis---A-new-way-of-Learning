import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { TEACHER_ID, useFixture } from "./_content-fixture";

/**
 * Per-topic History in the Studio's editor (E1.5, 8 Oct 2026;
 * `docs/STUDIO-EDITOR-PLAN.md`; template `design/templates/console/studio-history/`):
 * the old block editor's History and "Use this text", on a topic. A topic with
 * earlier versions offers a History tool; the dialog lists them newest first with
 * who, when, why and the text; "Use this text" puts it back as a DRAFT (typing,
 * not publishing); a quote from the book can be read and never used.
 *
 * Reads are the real seed; the chapter's `historyCount`s and the history route are
 * stand-ins here (the seeded chapters have no earlier versions yet), and the
 * working copy's writes are the fixture's. The route itself is tested in
 * `services/api/test/content.spec.ts`.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: TEACHER_ID, email: "teacher@example.com", aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}
const TEACHER = teacherToken();

interface Wire { id: string | null; kind: string; body: string; meta: Record<string, string> }
const EARLIER = "An earlier wording of this topic, as it read before the last change.";

async function open(page: Page) {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, {});
  const kinds = new Map<string, string>();
  const reads: Array<{ blocks: Wire[]; version: number }> = [];
  page.on("response", async (r) => {
    if (r.request().method() === "GET" && /\/console\/content\/\d\d\/working$/.test(new URL(r.url()).pathname)) {
      reads.push((await r.json().catch(() => null)) as (typeof reads)[number]);
    }
  });
  // The chapter, with two earlier versions on its first text topic and on its first quote.
  let proseId = "";
  let quoteId = "";
  await page.route(/\/api\/v1\/console\/content\/04(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { blocks: Array<{ id: string; kind: string; historyCount: number }> };
    for (const b of json.blocks) kinds.set(b.id, b.kind);
    const prose = json.blocks.find((b) => b.kind === "prose")!;
    const quote = json.blocks.find((b) => b.kind === "quote")!;
    prose.historyCount = 2;
    quote.historyCount = 2;
    proseId = prose.id;
    quoteId = quote.id;
    return route.fulfill({ response: res, json });
  });
  await page.route(/\/api\/v1\/console\/content\/blocks\/([^/]+)\/history$/, async (route) => {
    const id = /blocks\/([^/]+)\/history/.exec(route.request().url())![1]!;
    const kind = kinds.get(id) ?? "prose";
    return route.fulfill({
      json: {
        versions: [
          { version: 2, kind, body: EARLIER + " (second)", via: "console", replacedAt: "2026-10-05T08:00:00.000Z", reason: "Tightened the opening", editor: "The Teacher" },
          { version: 1, kind, body: EARLIER + " (first)", via: "sync", replacedAt: "2026-10-01T08:00:00.000Z", reason: null, editor: null },
        ],
      },
    });
  });
  await page.goto(`${CONSOLE_URL}/studio/cpe-412/04`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  await page.locator("[data-editor-shell] .ed-prose").first().waitFor({ timeout: 15_000 });
  return { fx, reads, ids: () => ({ proseId, quoteId }) };
}

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Formatting and topics" });
const historyTool = (page: Page) => toolbar(page).getByRole("button", { name: "History of this topic" });
const topic = (page: Page, id: string) => page.locator(`.ed-prose [data-topic-id="${id}"]`);

async function openHistory(page: Page, id: string) {
  await topic(page, id).scrollIntoViewIfNeeded();
  await topic(page, id).locator(".ed-content").first().click();
  await expect(historyTool(page)).toBeEnabled();
  await historyTool(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Earlier versions of this topic" })).toBeVisible();
  await page.waitForTimeout(500); // past the dialog's ease-in
  return dialog;
}

test.describe("a topic's History", () => {
  test("the tool waits for a topic that has earlier versions", async ({ page }) => {
    const { ids } = await open(page);
    // A topic with no earlier versions: the tool is there and disabled.
    const plain = page.locator('.ed-prose [data-topic-kind="brief"] .ed-content p').first();
    if (await plain.count()) {
      await plain.click();
      await expect(historyTool(page)).toBeDisabled();
    }
    await topic(page, ids().proseId).locator(".ed-content").first().click();
    await expect(historyTool(page)).toBeEnabled();
  });

  test("the dialog lists the versions newest first, each with who, when, why and the text", async ({ page }) => {
    const { ids } = await open(page);
    const dialog = await openHistory(page, ids().proseId);
    const items = dialog.locator("li[data-version]");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute("data-version", "2");
    await expect(items.nth(0)).toContainText("replaced in the console by The Teacher");
    await expect(items.nth(0)).toContainText("Tightened the opening");
    await expect(items.nth(0)).toContainText(EARLIER + " (second)");
    await expect(items.nth(1)).toContainText("replaced by sync, from the file");
  });

  test("Use this text puts it in the topic as a DRAFT: saved with the version it opened, every other topic untouched", async ({ page }) => {
    const { fx, reads, ids } = await open(page);
    const dialog = await openHistory(page, ids().proseId);
    await dialog.getByRole("button", { name: "Use this text: version 2" }).click();
    await expect(dialog).toBeHidden();
    await expect(topic(page, ids().proseId)).toContainText(EARLIER + " (second)");
    await expect(page.locator("[data-save-status]")).toHaveAttribute("data-save-status", "saved", { timeout: 10_000 });
    await expect(page.locator("[data-save-status]")).toContainText("draft, not published");
    const sent = fx.writes.save.at(-1)!.body;
    expect(sent.version).toBe(reads[0]!.version);
    const was = reads[0]!.blocks;
    const changed = sent.blocks.filter((b: Wire, i: number) => b.body !== was[i]!.body);
    expect(changed, "exactly the one topic differs").toHaveLength(1);
    expect(changed[0]!.id).toBe(ids().proseId);
    expect(changed[0]!.body).toContain(EARLIER + " (second)");
    await expect(page.getByText("Version 2 placed in the topic")).toBeVisible();
    // Undo takes it back, as it does any edit.
    await page.keyboard.press("Control+z");
    await expect(topic(page, ids().proseId)).not.toContainText(EARLIER + " (second)");
  });

  test("a quote from the book can be read and never used", async ({ page }) => {
    const { fx, ids } = await open(page);
    const quote = topic(page, ids().quoteId);
    await quote.scrollIntoViewIfNeeded();
    await quote.click();
    await expect(historyTool(page)).toBeEnabled();
    await historyTool(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("li[data-version]")).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "Use this text: version 2" })).toBeDisabled();
    await expect(dialog).toContainText("never typed here");
    expect(fx.writes.save.length).toBe(0);
  });
});

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2, on the History dialog
 * ==================================================================== */

test.describe("the gate — the History dialog", () => {
  test("1-3 · nothing clipped, no horizontal scroll, every control by keyboard", async ({ page }) => {
    const { ids } = await open(page);
    const dialog = await openHistory(page, ids().proseId);
    expect(await clippedElements(page), "history dialog").toEqual([]);
    expect(await horizontalOverflow(page), "history dialog").toBeLessThanOrEqual(0);
    // A modal traps focus: Tab stays inside it and reaches both "Use this text" buttons and the close button.
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      seen.add((await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "")) ?? "");
    }
    expect([...seen].some((s) => s.includes("Use this text: version 2"))).toBe(true);
    expect([...seen].some((s) => s.includes("Use this text: version 1"))).toBe(true);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await unreachableByKeyboard(page, "main"), "the editor with its History tool").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(180_000);
    const { ids } = await open(page);
    await openHistory(page, ids().proseId);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, "[role=dialog]"), `${theme}: history dialog`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    const { ids } = await open(page);
    await openHistory(page, ids().proseId);
    expect(await offTokenStyles(page, "[role=dialog]"), "history dialog").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    await recordMotion(page);
    const { ids } = await open(page);
    await topic(page, ids().proseId).locator(".ed-content").first().click();
    await historyTool(page).click();
    expect((await motionStarted(page, "dialog")).length, "with motion allowed, the dialog should ease in").toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-editor-shell] .ed-prose").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await topic(page, ids().proseId).locator(".ed-content").first().click();
    await historyTool(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "under reduced motion nothing on the route may animate").toEqual([]);
  });

  test("capture: the dialog, for a person to open", async ({ page }, info) => {
    const { ids } = await open(page);
    await openHistory(page, ids().proseId);
    await page.screenshot({ path: `design/templates/console/studio-history/current${info.project.name === "desktop-1440" ? "" : "-380"}.png` });
  });
});
