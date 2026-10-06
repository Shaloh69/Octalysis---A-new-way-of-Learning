import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  motionStarted,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";
import { API, S006, STAFF, seedChat, signIn } from "./_chat-fixture";
import { createHmac } from "node:crypto";

/**
 * `/app/chat`, the class chat (docs/CHAT-PLAN.md; design/templates/web/chat/
 * SPEC.md). The section's room and a private thread with the instructor, in
 * the star HUD. Real API, the demo section; a conversation is seeded once by
 * the fixture. The 423 (a paper open) and a failed load are patched, because
 * the seed has neither.
 *
 * Bea (232129010) is the student who sends and deletes, and whose Chat tab
 * counts a mention: no other test opens the chat as her, so her read marker is
 * hers alone while the specs run in parallel.
 */

const ROUTE = ".chat";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";
const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const BEA_ID = "dddddddd-1111-4000-8000-000000000010";
const BEA = (() => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    sub: BEA_ID,
    email: "232129010@example.com",
    app_metadata: { role: "student", student_id: "232129010" },
  });
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
})();

let section = "";
test.beforeAll(async ({ request }) => {
  ({ section } = await seedChat(request));
});

/** The private thread's room button (the section's subtitle also says "instructor"). */
const thread = (page: Page) =>
  page.locator(".chat-room-btn").filter({ has: page.locator(".chat-room-name", { hasText: /^Instructor$/ }) });

async function chat(page: Page, token = S006, query = ""): Promise<void> {
  await signIn(page, token);
  await page.goto(`/app/chat${query}`, { waitUntil: "domcontentloaded" });
  await page.locator(".chat-msgs, .chat-empty").first().waitFor({ timeout: 15_000 });
}

test.describe("/app/chat — the six gate assertions", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await chat(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await chat(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await chat(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the star set, a room with a mention, and the private thread", async ({ page }) => {
    await chat(page);
    expect(await contrastFailures(page, ROUTE), "section room").toEqual([]);
    await thread(page).click();
    await page.locator(".chat-msgs").waitFor();
    expect(await contrastFailures(page, ROUTE), "private thread").toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await chat(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: messages arrive without moving", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    await recordMotion(page);
    await chat(page);
    await thread(page).click();
    expect((await motionStarted(page, "main", 50)).length, "messages ease in without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await chat(calm);
    await thread(calm).click();
    await calm.locator(".chat-msgs").waitFor();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/chat — what the page owes", () => {
  test("two rooms: the section's (current) and the private thread with the instructor", async ({ page }) => {
    await chat(page);
    const rooms = page.locator(".chat-room-btn");
    await expect(rooms).toHaveCount(2);
    await expect(rooms.nth(0)).toContainText("BSCPE - 4");
    await expect(rooms.nth(0)).toHaveAttribute("aria-current", "true");
    await expect(rooms.nth(1)).toContainText("Instructor");
    // A section code is a code: mono.
    expect(await rooms.nth(0).locator(".chat-room-name").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("a message that mentions you says so in words, and the name is picked out", async ({ page }) => {
    await chat(page);
    const forMe = page.locator(".chat-msg.is-for-me").first();
    await expect(forMe).toContainText("Mentions you");
    await expect(forMe.locator(".chat-at")).toHaveText("@Kristine Joy Montebon");
    await expect(forMe.locator(".chat-badge", { hasText: "Instructor" })).toHaveCount(1);
    // Times are numbers: mono.
    expect(await forMe.locator(".chat-msg-time").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("the private thread says who can read it", async ({ page }) => {
    await chat(page);
    await thread(page).click();
    await expect(page.locator(".chat-room-about")).toHaveText(/only you and the instructor/i);
    await expect(page.locator(".chat-msgs")).toContainText("after the lecture");
    await expect(page).toHaveURL(/room=/);
  });

  test("typing @ offers the room's people; the keyboard picks one", async ({ page }) => {
    await chat(page);
    const box = page.getByRole("combobox", { name: /Message BSCPE - 4/ });
    await box.fill("");
    await box.pressSequentially("Thanks @Joc");
    const list = page.getByRole("listbox", { name: "People to mention" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("option")).toHaveText(["Jocelyn Mae Sy Tan"]);
    await box.press("Enter");
    await expect(box).toHaveValue("Thanks @Jocelyn Mae Sy Tan ");
    await expect(list).toHaveCount(0);
    // Nobody outside the section is offered: the room's members only.
    await box.pressSequentially("@Prof");
    await expect(page.getByRole("option")).toContainText(["Prof. Amalia R. Bontuyan"]);
    await box.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("a mention counts on the Chat tab until the student opens the chat", async ({ page, request }, info) => {
    test.skip(!wide(info), "behaviour, one width; it writes");
    const posted = await request.post(`${API}/api/v1/chat/rooms/${section}/messages`, {
      headers: { authorization: `Bearer ${STAFF}` },
      data: { body: "@Bea Katrina Enriquez your lab 1 is in, thank you.", mentions: [BEA_ID] },
    });
    expect(posted.status()).toBe(201);
    await signIn(page, BEA);
    await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
    const tab = page.locator("nav[aria-label=Main] .star-tab", { hasText: "Chat" });
    await expect(tab).toHaveAttribute("aria-label", /Chat, \d+ unread mentions?/);
    await expect(tab.locator("[data-chat-mentions]")).toBeVisible();
    await tab.click();
    await page.locator(".chat-msgs").waitFor();
    await expect(page.locator(".chat-msg.is-for-me").last()).toContainText("your lab 1 is in");
    await page.locator("nav[aria-label=Main] .star-tab", { hasText: "Settings" }).click();
    await expect(tab).toHaveAttribute("aria-label", "Chat");
  });

  test("send, then delete: the message appears as yours, and goes for everyone", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width; it writes");
    await chat(page, BEA);
    const text = `Checking the bus width, run ${Date.now()}`;
    const box = page.getByRole("combobox", { name: /Message BSCPE - 4/ });
    await box.fill(text);
    await box.press("Enter");
    const mine = page.locator(".chat-msg.is-mine", { hasText: text });
    await expect(mine).toBeVisible();
    await expect(mine.locator(".chat-msg-author")).toHaveText("You");
    await expect(box).toHaveValue("");

    await mine.getByRole("button", { name: /Delete your message/ }).click();
    await expect(mine.locator(".chat-msg-ask")).toHaveText("Delete it for everyone?");
    await mine.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Message deleted");
    await expect(page.locator(".chat-msgs")).not.toContainText(text);
  });

  test("an empty message is not sent, and the page says what to do", async ({ page }) => {
    await chat(page);
    await page.locator(".chat-send").click();
    await expect(page.locator(".chat-problem")).toHaveText("Write something or attach a file.");
  });

  test("with no file storage (the local stack) there is no Attach, and the page says why", async ({ page }) => {
    await chat(page);
    await expect(page.locator(".chat-attach")).toHaveCount(0);
    await expect(page.locator(".chat-compose-hint")).toContainText("Attachments are not available on this server");
  });

  test("a paper open: the chat is closed, says why, and offers no way to post (ruling 3)", async ({ page }) => {
    await page.route("**/api/v1/chat/rooms", (r) =>
      r.fulfill({ status: 423, contentType: "application/json", body: JSON.stringify({ error: { code: "paper_open", message: "You have a paper open. The chat opens again when you submit it." } }) }),
    );
    await signIn(page, S006);
    await page.goto("/app/chat", { waitUntil: "domcontentloaded" });
    const state = page.locator("[data-chat-state=closed]");
    await expect(state).toContainText("Closed while your paper is open");
    await expect(state).toContainText("submit it");
    await expect(page.locator(".chat-compose, .chat-msgs")).toHaveCount(0);
    await expect(state.getByRole("button", { name: "Check again" })).toBeVisible();
  });

  test("a failed load says so and retries, never a blank page", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/chat/rooms", (r) =>
      fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Something went wrong on our side. Try again." } }) }) : r.continue(),
    );
    await signIn(page, S006);
    await page.goto("/app/chat", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-chat-state=error]")).toContainText("That did not load");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".chat-msgs")).toBeVisible();
  });

  test("the star realm, no biome; Chat is the sixth tab", async ({ page }) => {
    await chat(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
    await expect(page.locator("nav[aria-label=Main] .star-tab")).toHaveCount(6);
    await expect(page.locator("nav[aria-label=Main] .star-tab", { hasText: "Chat" })).toHaveAttribute("aria-current", "page");
  });

  test("capture: current and current-380, then opened", async ({ page }, info) => {
    await chat(page);
    await page.waitForTimeout(300);
    const suffix = wide(info) ? "" : "-380";
    await page.screenshot({ path: `design/templates/web/chat/current${suffix}.png`, fullPage: !wide(info) });
    await thread(page).click();
    await page.locator(".chat-msgs").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `design/templates/web/chat/current-thread${suffix}.png`, fullPage: !wide(info) });
  });
});
