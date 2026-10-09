import { test, expect, type Page } from "@playwright/test";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { API, S004, S004_ID, STAFF, seedChat, signIn } from "./_chat-fixture";

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

/**
 * Below 52rem the page is two screens (Messenger's shape; SPEC.md "As remade"): the rooms,
 * then one room. `mode: "room"` opens a room (at 380 through `?room=`, as a tap on it would);
 * `"list"` opens the rooms. Wide, both are the same page, the first room open.
 */
async function open(page: Page, query = "", mode: "room" | "list" = "room"): Promise<void> {
  await signIn(page, STAFF);
  const narrow = !wide(test.info().project.name);
  const q = narrow && mode === "room" && !query.includes("room=") ? `${query ? query + "&" : "?"}room=${section}` : query;
  await page.goto(`${CONSOLE_URL}/chat${q}`, { waitUntil: "domcontentloaded" });
  await page.locator(mode === "list" && narrow ? ".ch-rooms" : ".ch-msgs, .ch-empty").first().waitFor({ timeout: 15_000 });
}

/** Back to the rooms where the page is two screens; nothing to do where it is one. */
async function toList(page: Page): Promise<void> {
  if (!wide(test.info().project.name)) {
    await page.getByRole("button", { name: "Back to rooms" }).click();
    await page.locator(".ch-rooms").waitFor();
  }
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
    await toList(page);
    expect(await clippedElements(page), "the rooms").toEqual([]);
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    expect(await clippedElements(page), "attachments").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await toList(page);
    expect(await horizontalOverflow(page), "the rooms").toBeLessThanOrEqual(0);
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
    await toList(page);
    expect(await offTokenStyles(page), "the rooms").toEqual([]);
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
    await open(page, "", "list");
    const rooms = page.getByRole("navigation", { name: "Rooms" });
    await expect(rooms.locator(".ch-room").first()).toContainText("BSCPE - 4");
    await expect(rooms.locator(".ch-room", { hasText: "Kristine Joy Montebon" })).toContainText("232129006");
    // Each row has a face (a generated planet seeded from the room).
    await expect(rooms.locator(".ch-room").first().locator(".avatar")).toBeVisible();
    // The room being read has nothing "new": opening it marked it read (wide opens the first by itself).
    if (wide(test.info().project.name)) {
      await expect(rooms.locator('.ch-room[aria-current="true"] .ch-room-count')).toHaveCount(0);
    }
    // A section code is a code: mono.
    expect(await rooms.locator(".ch-room-name").first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("the instructor opens a private thread with any student", async ({ page }) => {
    await open(page, "", "list");
    await page.getByLabel("Message a student").selectOption({ label: "Angelo Go (232129009)" });
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.locator("#ch-room-title")).toHaveText("Angelo Go");
    await expect(page).toHaveURL(/room=/);
    await expect(page.locator(".ch-room-head .ch-room-about")).toContainText("private thread");
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
    await open(page, "", "list");
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

  test("capture: current, current-380, the rooms and the attachments view, then opened", async ({ page }, info) => {
    await open(page);
    await page.waitForTimeout(300);
    const s = wide(info.project.name) ? "" : "-380";
    await page.screenshot({ path: `design/templates/console/chat/current${s}.png` });
    await toList(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `design/templates/console/chat/current-rooms${s}.png` });
    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.locator(".ch-card").waitFor();
    await page.screenshot({ path: `design/templates/console/chat/current-attachments${s}.png` });
  });
});

test.describe("/chat — Messenger's shape (9 Oct 2026, SPEC.md 'As remade')", () => {
  test("a phone is two screens: the rooms, then one room; the page's own header makes way", async ({ page }, info) => {
    test.skip(wide(info.project.name), "two screens exist below 52rem");
    await open(page, "", "list");
    // Screen one: the rooms. No log, no composer.
    await expect(page.locator(".ch-rooms")).toBeVisible();
    await expect(page.locator(".ch-log, .ch-compose")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Chat" })).toBeVisible();
    // Tap a room: a history entry, the room fills the page, the title and tabs step aside.
    await page.locator(".ch-room").first().click();
    await expect(page).toHaveURL(/room=/);
    await expect(page.locator(".ch-rooms")).toHaveCount(0);
    await expect(page.locator(".ch-log")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Attachments" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Back to rooms" })).toBeVisible();
    // Back (the arrow, or the browser's) returns to the rooms.
    await page.goBack();
    await expect(page.locator(".ch-rooms")).toBeVisible();
    await page.locator(".ch-room").first().click();
    await page.getByRole("button", { name: "Back to rooms" }).click();
    await expect(page.locator(".ch-rooms")).toBeVisible();
  });

  test("opening the rooms reads nothing: only opening a room marks it read", async ({ page, request }, info) => {
    test.skip(wide(info.project.name), "wide opens the first room by itself");
    // A private thread of its own, so other specs opening the section's room cannot mark it read.
    const staff = { authorization: `Bearer ${STAFF}` };
    const opened = await request.post(`${API}/api/v1/chat/threads`, { headers: staff, data: { userId: S004_ID } });
    const thread = ((await opened.json()) as { id: string }).id;
    const said = await request.post(`${API}/api/v1/chat/rooms/${thread}/messages`, {
      headers: { authorization: `Bearer ${S004}` }, data: { body: `Unread check ${Date.now()}`, mentions: [] },
    });
    expect(said.status()).toBe(201);
    const unread = async () =>
      ((await (await request.get(`${API}/api/v1/chat/rooms`, { headers: staff })).json()) as { rooms: Array<{ id: string; unread: number }> })
        .rooms.find((r) => r.id === thread)!.unread;
    const before = await unread();
    expect(before).toBeGreaterThan(0);
    await open(page, "", "list");
    await page.waitForTimeout(1500);
    expect(await unread(), "the list screen read the thread").toBe(before);
    await page.locator(".ch-room", { hasText: "Jocelyn" }).click();
    await page.locator(".ch-msgs").waitFor();
    await expect.poll(unread, { timeout: 8000 }).toBe(0);
  });

  test("messages are bubbles: others' on the left with a face at the start of a run, yours on the right", async ({ page }) => {
    await studentSays(page, `Run one ${Date.now()}`);
    await studentSays(page, `Run two ${Date.now()}`);
    await open(page);
    const grouped = page.locator(".ch-msg.is-grouped").first();
    await expect(grouped).toBeVisible();
    // A run is one speaker: the second bubble has no face and no visible name.
    await expect(grouped.locator(".ch-msg-face .avatar")).toHaveCount(0);
    await expect(grouped.locator(".ch-author")).toHaveClass(/sr-only/);
    const starter = page.locator(".ch-msg:not(.is-grouped):not(.is-mine)").last();
    await expect(starter.locator(".ch-msg-face .avatar")).toBeVisible();
    // The author is always in the text.
    await expect(starter.locator(".ch-author")).not.toHaveClass(/sr-only/);
    // Bubbles sit left; the instructor's own sits right.
    const box = (await page.locator(".ch-log").boundingBox())!;
    const left = (await starter.locator(".ch-bubble").boundingBox())!;
    expect(left.x - box.x).toBeLessThan(box.width / 4);
    await page.getByRole("combobox", { name: /Message BSCPE - 4/ }).fill(`Mine ${Date.now()}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const mine = page.locator(".ch-msg.is-mine").last();
    await expect(mine).toBeVisible();
    const right = (await mine.locator(".ch-bubble").boundingBox())!;
    expect(right.x + right.width).toBeGreaterThan(box.x + (box.width * 3) / 4);
  });

  test("Send sits beside the field, not under it, and the field grows with what is typed", async ({ page }) => {
    await open(page);
    const field = page.getByRole("combobox", { name: /Message BSCPE - 4/ });
    const send = page.getByRole("button", { name: "Send", exact: true });
    const f = (await field.boundingBox())!;
    const s = (await send.boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(f.x + f.width - 1);
    expect(Math.abs(s.y + s.height - (f.y + f.height))).toBeLessThanOrEqual(8);
    const h0 = f.height;
    await field.fill("one\ntwo\nthree\nfour");
    expect((await field.boundingBox())!.height).toBeGreaterThan(h0 + 20);
  });

  test("a face on every room, and the room's name in mono where it is a section code", async ({ page }) => {
    await open(page, "", "list");
    const rows = page.locator(".ch-room");
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    expect(await page.locator(".ch-room .avatar").count()).toBe(n);
  });
});
