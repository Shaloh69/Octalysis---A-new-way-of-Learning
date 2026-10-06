import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * The console SHELL: the sidebar, its nav, the account block, the 380 top bar
 * and its menu. `design/templates/console/shell/SPEC.md`.
 *
 * Every console route renders inside it, so every other console spec also
 * runs through it; this file asserts what the shell itself owes: the six
 * gate assertions scoped to the shell, and the shell's own claims.
 *
 * The guard's server half (a student token refused by every console
 * endpoint) is `console-gate.spec.ts`'s, and the two gate screens are
 * `/signin`'s. Not repeated here.
 *
 * FIXTURE DATA ONLY: teacher `dddddddd-0000-4000-8000-000000000001` from
 * `db/demo-seed.sql`.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "teacher@octa.local",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: "Demo Teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** The four groups the instructor ruled on, 28 Sep 2026, in order. */
const GROUPS: Array<[string, string[]]> = [
  ["In class", ["Locks", "Live", "Chat"]],
  ["Students", ["Students", "Submissions", "Gradebook"]],
  ["Course", ["Assessments", "Items", "Content"]],
  ["Records", ["Audit log", "System health", "Feedback"]],
];

const SHELL = "[data-shell]";
const narrow = (t: TestInfo) => t.project.name === "mobile-380";

async function open(page: Page, route = "/gradebook"): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("octa:dev-token", t);
      localStorage.removeItem("octa:theme");
    } catch {
      /* ignore */
    }
  }, teacherToken());
  await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "domcontentloaded" });
  // The page has decided: its own heading is in <main>.
  await page.locator("main h1").first().waitFor({ timeout: 20_000 });
}

const menuButton = (page: Page) => page.locator("button[aria-controls='console-nav']");
const accountButton = (page: Page) => page.getByRole("button", { name: /account menu/i });

async function openMenu(page: Page): Promise<void> {
  await menuButton(page).click();
  await expect(page.locator("#console-nav")).toBeVisible();
  await page.waitForTimeout(350); // the sheet's slide, 240ms
}

/* ======================================================================
 * THE SIX-ASSERTION GATE, scoped to the shell, at 1440 AND 380.
 * At 380 it is measured twice: the bar closed, and the sheet open.
 * ==================================================================== */

/** Each state the shell can be in at this width, as a function that puts it there. */
function states(testInfo: TestInfo): Array<[string, (p: Page) => Promise<void>]> {
  return narrow(testInfo)
    ? [
        ["bar", async () => {}],
        ["sheet open", openMenu],
      ]
    : [["sidebar", async () => {}]];
}

test.describe("the shell — the six-assertion gate", () => {
  test("1 · nothing in the shell is clipped", async ({ page }, testInfo) => {
    await open(page);
    for (const [name, put] of states(testInfo)) {
      await put(page);
      expect(await clippedElements(page, SHELL), name).toEqual([]);
    }
    // And the account menu, open over the foot.
    if (narrow(testInfo)) await page.keyboard.press("Escape");
    if (narrow(testInfo)) await openMenu(page);
    await accountButton(page).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await clippedElements(page, `${SHELL}, [role=menu]`), "account menu").toEqual([]);
  });

  test("2 · no horizontal page scroll, in any state", async ({ page }, testInfo) => {
    await open(page);
    for (const [name, put] of states(testInfo)) {
      await put(page);
      expect(await horizontalOverflow(page), name).toBeLessThanOrEqual(0);
    }
  });

  test("3 · every shell control is reachable by keyboard", async ({ page }, testInfo) => {
    await open(page);
    for (const [name, put] of states(testInfo)) {
      await put(page);
      expect(await unreachableByKeyboard(page, SHELL), name).toEqual([]);
    }
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }, testInfo) => {
    await open(page);
    for (const [name, put] of states(testInfo)) {
      await put(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        expect(await contrastFailures(page, SHELL), `${theme}: ${name}`).toEqual([]);
      }
    }
    await accountButton(page).click();
    await expect(page.getByRole("menu")).toBeVisible();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, "[role=menu]"), `${theme}: account menu`).toEqual([]);
    }
  });

  test("5 · the rendered shell uses the tokens", async ({ page }, testInfo) => {
    await open(page);
    for (const [name, put] of states(testInfo)) {
      await put(page);
      expect(await offTokenStyles(page, SHELL), name).toEqual([]);
    }
    await accountButton(page).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await offTokenStyles(page, "[role=menu]"), "account menu").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }, testInfo) => {
    /*
     * POSITIVE CONTROL FIRST, read through motionStarted(): at 380 the sheet
     * slides in; at 1440 the account menu fades in. Without this the test
     * passes on a shell with no motion at all.
     */
    await recordMotion(page);
    await open(page);
    const surface = narrow(testInfo) ? "shell" : "menu";
    if (narrow(testInfo)) await menuButton(page).click();
    else await accountButton(page).click();
    const moving = await motionStarted(page, surface);
    expect(moving.length, `with motion allowed, the ${surface} should animate in`).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("main h1").first().waitFor({ timeout: 20_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    if (narrow(testInfo)) await menuButton(page).click();
    else await accountButton(page).click();
    await page.waitForTimeout(400);
    const still = (await recordedMotion(page)).filter(
      (m) => (m.on.startsWith("shell") || m.on.startsWith("menu")) && m.ms > 1,
    );
    expect(still, "under reduced motion nothing in the shell may animate").toEqual([]);
  });
});

/* ======================================================================
 * THE SHELL'S OWN CLAIMS
 * ==================================================================== */

test.describe("the shell — what it owes every route", () => {
  test("the nav offers all twelve routes, in the four ruled groups, each named", async ({ page }, testInfo) => {
    await open(page);
    if (narrow(testInfo)) await openMenu(page);
    const nav = page.getByRole("navigation", { name: "Console sections" });
    for (const [label, items] of GROUPS) {
      const list = nav.getByRole("list", { name: label });
      await expect(list, `group "${label}"`).toBeVisible();
      const names = (await list.getByRole("link").allInnerTexts()).map((s) => s.trim());
      expect(names, `group "${label}"`).toEqual(items);
    }
    expect(await nav.getByRole("link").count(), "twelve routes (Chat joined In class, 6 Oct 2026), no more, no fewer").toBe(12);
  });

  test("the current route is marked, and only it", async ({ page }, testInfo) => {
    for (const [route, name] of [["/gradebook", "Gradebook"], ["/students", "Students"], ["/locks", "Locks"]] as const) {
      await open(page, route);
      if (narrow(testInfo)) await openMenu(page);
      const current = page.locator("#console-nav a[aria-current='page']");
      await expect(current, route).toHaveCount(1);
      await expect(current, route).toHaveText(name);
    }
  });

  test("the skip link is first, and lands focus in <main>", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
  });

  test("no 'Checking your access…' flash on a fast load", async ({ page }) => {
    /*
     * §0b.3: the shell rendered that bare text while getIdentity() resolved,
     * so it blinked on every route. Under 400ms it must render nothing.
     * Watched from the first byte with a MutationObserver.
     */
    await page.addInitScript(() => {
      const w = window as unknown as { __flash: boolean };
      w.__flash = false;
      new MutationObserver(() => {
        if (document.body?.textContent?.includes("Checking your access")) w.__flash = true;
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await open(page, "/locks");
    await page.goto(`${CONSOLE_URL}/students`, { waitUntil: "domcontentloaded" });
    await page.locator("main h1").first().waitFor({ timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { __flash: boolean }).__flash)).toBe(false);
  });

  test("the theme control changes data-theme on <html>, and it is remembered", async ({ page }, testInfo) => {
    await open(page);
    if (narrow(testInfo)) await openMenu(page);
    await accountButton(page).click();
    await page.getByRole("menuitemradio", { name: "Phosphor" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "phosphor");
    await expect(accountButton(page), "focus returns to the menu's button").toBeFocused();

    // Remembered: the same key apps/web reads, so the choice follows the teacher.
    expect(await page.evaluate(() => localStorage.getItem("octa:theme"))).toBe("phosphor");

    // At 380 the sheet is still open: the account menu lives inside it.
    await accountButton(page).click();
    await expect(page.getByRole("menuitemradio", { name: "Phosphor" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "Bare metal" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bare-metal");
  });

  test("signing out confirms itself, and lands on /signin", async ({ page }, testInfo) => {
    await open(page);
    if (narrow(testInfo)) await openMenu(page);
    await accountButton(page).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signin/);
    const toast = page.locator("[data-toaster]");
    await expect(toast).toContainText("Signed out");
    await expect(toast).toContainText("teacher@octa.local");
    expect(await page.evaluate(() => localStorage.getItem("octa:dev-token"))).toBeNull();
  });

  test("1440: only <main> scrolls; the sidebar runs the window's height and never moves", async ({ page }, testInfo) => {
    test.skip(narrow(testInfo), "the sidebar is a sheet below lg");
    await open(page, "/gradebook");
    await page.locator("[data-student]").first().waitFor({ timeout: 15_000 });

    // Measured 28 Sep before the rebuild: 1120px on /locks, /assessments,
    // /submissions and /gradebook. The widest route needs 66rem.
    const content = await page.evaluate(() => {
      const m = document.querySelector("main")!;
      const cs = getComputedStyle(m);
      return m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });
    expect(content, "main's content box at 1440").toBeGreaterThanOrEqual(70 * 16);

    /*
     * Instructor, 28 Sep 2026: the template's layout, "make the inner page
     * itself scrollable, not the sidebar". The DOCUMENT does not scroll;
     * <main> does, and /gradebook is long enough that it must.
     */
    const scroll = await page.evaluate(() => {
      const d = document.documentElement;
      const m = document.querySelector("main")!;
      return { doc: d.scrollHeight - d.clientHeight, main: m.scrollHeight - m.clientHeight };
    });
    expect(scroll.doc, "the window itself must not scroll").toBeLessThanOrEqual(0);
    expect(scroll.main, "a long route scrolls inside <main>").toBeGreaterThan(0);

    const footBefore = await accountButton(page).boundingBox();
    await page.locator("main").evaluate((m) => m.scrollTo(0, m.scrollHeight));
    await page.waitForTimeout(200);
    expect(await page.locator("main").evaluate((m) => m.scrollTop), "main scrolled").toBeGreaterThan(0);

    // The account sits at the window's foot, and did not move.
    const box = await accountButton(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    expect(box!.y + box!.height, "pinned to the foot of the window").toBeGreaterThan(900 - 80);
    expect(box!.y).toBe(footBefore!.y);
    await expect(page.getByRole("link", { name: "Locks" })).toBeInViewport();
    const side = await page.locator("#console-nav").boundingBox();
    expect(side!.height, "the sidebar runs the window's full height").toBeGreaterThanOrEqual(899);
  });

  test("380: the bar names the page you are on", async ({ page }, testInfo) => {
    test.skip(!narrow(testInfo), "the bar exists below lg only");
    await open(page, "/gradebook");
    await expect(page.locator("header[data-shell]")).toContainText("Gradebook");
    await open(page, "/students");
    await expect(page.locator("header[data-shell]")).toContainText("Students");
  });

  test("380: the menu closes on Escape, with focus back on its button", async ({ page }, testInfo) => {
    test.skip(!narrow(testInfo), "the menu exists below lg only");
    await open(page);
    await openMenu(page);
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
    // The template's sheet: the window's full height, the account at its foot.
    expect((await page.locator("#console-nav").boundingBox())!.height).toBeGreaterThanOrEqual(843);
    await page.getByRole("link", { name: "Locks" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#console-nav")).toBeHidden();
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton(page)).toBeFocused();
  });

  test("380: the menu closes on navigation, with focus back on its button", async ({ page }, testInfo) => {
    test.skip(!narrow(testInfo), "the menu exists below lg only");
    await open(page, "/gradebook");
    await openMenu(page);
    await page.getByRole("link", { name: "Students" }).click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(page.locator("#console-nav")).toBeHidden();
    await expect(menuButton(page)).toBeFocused();

    // Back is a navigation too.
    await openMenu(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/gradebook$/);
    await expect(page.locator("#console-nav")).toBeHidden();
  });

  test("380: the open menu traps nothing, and a click outside closes it", async ({ page }, testInfo) => {
    test.skip(!narrow(testInfo), "the menu exists below lg only");
    await open(page);
    await openMenu(page);
    // Tab through the sheet and out of it: focus reaches <main>, the sheet goes.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => !!document.activeElement?.closest("main"))) break;
    }
    expect(await page.evaluate(() => !!document.activeElement?.closest("main")), "focus left the sheet").toBe(true);
    await expect(page.locator("#console-nav")).toBeHidden();

    // The scrim.
    await openMenu(page);
    await page.mouse.click(370, 600);
    await expect(page.locator("#console-nav")).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });
});
