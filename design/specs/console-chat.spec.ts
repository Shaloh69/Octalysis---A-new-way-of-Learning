import { test, expect, type Page } from "@playwright/test";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { API, S004, STAFF, seedChat, signIn } from "./_chat-fixture";

/**
 * `/chat` in the console, the instructor's side of the class chat
 * (docs/CHAT-PLAN.md; design/templates/console/chat/SPEC.md). Real API, the
 * demo section, the fixture's conversation. Moderation and storage are staff
 * writes, each with a reason, each audited.
 */

const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const wide = (project: string) => project === "desktop-1440";

let section = "";
test.beforeAll(async ({ request }) => {
  ({ section } = await seedChat(request));
});

async function open(page: Page, query = ""): Promise<void> {
  await signIn(page, STAFF);
  await page.goto(`${CONSOLE_URL}/chat${query}`, { waitUntil: "domcontentloaded" });
  await page.locator(".ch-msgs, .ch-empty").first().waitFor({ timeout: 15_000 });
}

/** A student's message to moderate, posted through the API. */
async function studentSays(page: Page, text: string): Promise<void> {
  const res = await page.request.post(`${API}/api/v1/chat/rooms/${section}/messages`, {
    headers: { authorization: `Bearer ${S004}` },
    data: { body: text, mentions: [] },
  });
  expect(res.status()).toBe(201);
}

async function openRemove(page: Page, text: string) {
  const msg = page.locator(".ch-msg", { hasText: text });
  await msg.getByRole("button", { name: /^Remove .*message/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: the room, the remove dialog, attachments", async ({ page }) => {
    const text = `Clip check ${Date.now()}`;
    await studentSays(page, text);
    await open(page);
    expect(await clippedElements(page), "room").toEqual([]);
    await openRemove(page, text);
    expect(await clippedElements(page), "dialog").toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    expect(await clippedElements(page), "attachments").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    expect(await horizontalOverflow(page), "attachments").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });

  test("4 · AA computed on all three themes, the room and the dialog", async ({ page }) => {
    const text = `Contrast check ${Date.now()}`;
    await studentSays(page, text);
    await open(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `room · ${theme}`).toEqual([]);
    }
    await openRemove(page, text);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `dialog · ${theme}`).toEqual([]);
    }
  });

  test("5 · the token system is what rendered", async ({ page }) => {
    await open(page);
    expect(await offTokenStyles(page), "room").toEqual([]);
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    expect(await offTokenStyles(page), "attachments").toEqual([]);
  });

  test("6 · reduced motion: messages arrive without moving", async ({ page, browser }, info) => {
    test.skip(!wide(info.project.name), "one width is enough");
    await recordMotion(page);
    await open(page);
    expect((await motionStarted(page, "main", 50)).length, "messages ease in without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await open(calm);
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/chat — what the page owes", () => {
  test("every section's room, and private threads that have a message", async ({ page }) => {
    await open(page);
    const rooms = page.getByRole("navigation", { name: "Rooms" });
    await expect(rooms.locator(".ch-room").first()).toContainText("BSCPE - 4");
    await expect(rooms.locator(".ch-room", { hasText: "Kristine Joy Montebon" })).toContainText("232129006");
    // The room being read has nothing "new": opening it marked it read.
    await expect(rooms.locator('.ch-room[aria-current="true"] .ch-room-count')).toHaveCount(0);
    // A section code is a code: mono.
    expect(await rooms.locator(".ch-room-name").first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("the instructor opens a private thread with any student", async ({ page }) => {
    await open(page);
    await page.getByLabel("Message a student").selectOption({ label: "Angelo Go (232129009)" });
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.locator("#ch-room-title")).toHaveText("Angelo Go");
    await expect(page).toHaveURL(/room=/);
    await expect(page.locator(".ch-room-head .ch-room-sub")).toContainText("private thread");
  });

  test("removing a student's message needs a reason, says what happened, and the text is gone", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "it writes; one width");
    const text = `Off topic, run ${Date.now()}`;
    await studentSays(page, text);
    await open(page);
    const dialog = await openRemove(page, text);
    await expect(dialog.locator(".ch-quote")).toHaveText(text);
    const remove = dialog.getByRole("button", { name: "Remove", exact: true });
    await expect(remove).toBeDisabled();
    await dialog.getByLabel(/Why/).fill("off topic");
    await remove.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[role=status]", { hasText: "Message from Jocelyn Mae Sy Tan removed" })).toBeVisible();
    await expect(page.locator(".ch-msgs")).not.toContainText(text);
  });

  test("Keep it closes the dialog and changes nothing", async ({ page }) => {
    const text = `Kept, run ${Date.now()}`;
    await studentSays(page, text);
    await open(page);
    const dialog = await openRemove(page, text);
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".ch-msgs")).toContainText(text);
  });

  test("@ offers the room's people to the instructor too", async ({ page }) => {
    await open(page);
    const box = page.getByRole("combobox", { name: /Message BSCPE - 4/ });
    await box.pressSequentially("@Kris");
    await expect(page.getByRole("listbox", { name: "People to mention" }).getByRole("option")).toHaveText(["Kristine Joy Montebon"]);
    await box.press("Enter");
    await expect(box).toHaveValue("@Kristine Joy Montebon ");
  });

  test("Attachments: storage used of 1 GB, oldest first, and prune needs something to prune", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: "Attachments" }).click();
    const card = page.locator(".ch-card");
    await expect(card).toContainText("MB of");
    await expect(card).toContainText("1024.0");
    await expect(page.getByRole("tab", { name: "Attachments" })).toHaveAttribute("aria-selected", "true");
    // Locally nothing is ever attached (no storage): the list says what will appear.
    await expect(page.locator(".ch-empty")).toContainText("oldest first");
    await expect(card.getByRole("button", { name: /^Remove/ })).toBeDisabled();
  });

  test("with no file storage there is no Attach, and the hint says why", async ({ page }) => {
    await open(page);
    await expect(page.locator(".ch-attach")).toHaveCount(0);
    await expect(page.locator(".ch-hint")).toContainText("Attachments are not available on this server");
  });

  test("Chat sits under In class in the nav", async ({ page }, info) => {
    await open(page);
    // At 380 the nav is a sheet behind its button.
    if (!wide(info.project.name)) await page.getByRole("button", { name: "Open menu" }).click();
    const link = page.getByRole("navigation", { name: "Console sections" }).getByRole("link", { name: /^Chat/ });
    await expect(link).toHaveAttribute("aria-current", "page");
  });

  test("capture: current, current-380 and the attachments view, then opened", async ({ page }, info) => {
    await open(page);
    await page.waitForTimeout(300);
    const s = wide(info.project.name) ? "" : "-380";
    await page.screenshot({ path: `design/templates/console/chat/current${s}.png` });
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    await page.screenshot({ path: `design/templates/console/chat/current-attachments${s}.png` });
  });
});
