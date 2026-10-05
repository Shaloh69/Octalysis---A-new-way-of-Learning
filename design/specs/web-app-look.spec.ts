import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/app`: looking around the system (instructor, 5 Oct 2026). Its own file for
 * one reason: the trace snapshots every frame of a canvas that redraws every
 * frame, and with it on one wheel test took 150s and timed out (off, 16s;
 * measured 5 Oct 2026). `trace` can only be set for a whole file. A failure
 * still leaves its screenshot.
 */
test.use({ trace: "off" });
// One WebGL page at a time in this file: several in parallel starve software rendering.
test.describe.configure({ mode: "default" });

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
function token(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const TOKEN = token();

async function map(page: Page, path = "/app"): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-bodies input[type=radio]").first().waitFor({ state: "attached" });
}
const wide = (name: string) => !name.includes("380");

/* ============================================ looking around (5 Oct 2026) */

/*
 * Instructor, 5 Oct 2026: "the students in the map have the ability to zoom in
 * manually and look around the solar system", "the camera view will reset on
 * its own after 30 seconds of not doing anything", "make sure that works on
 * the phone too". The canvas is compared to itself (reduced motion holds
 * everything else still), and `data-view` says whose view it is.
 */
test.describe("/app — looking around the system", () => {
  // Software WebGL is slow to read back; these tests read the canvas several times.
  test.describe.configure({ timeout: 150_000, mode: "default" });
  const stage = (page: Page) => page.locator(".starmap-stage");
  /** The middle of the free area, where the system is: enough to see a change, cheap to read back. */
  const canvasShot = async (page: Page) => {
    const v = page.viewportSize()!;
    const w = Math.min(320, v.width - 40);
    return page.screenshot({ clip: { x: v.width * 0.62 - w / 2, y: v.height * 0.6 - 120, width: w, height: 240 } });
  };
  async function settled(page: Page): Promise<void> {
    await page.locator(".starmap-stage canvas").waitFor();
    await page.waitForTimeout(4000);
  }

  test("the wheel zooms in toward the pointer, and the view becomes the student's", async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await map(page);
    await settled(page);
    await expect(stage(page)).toHaveAttribute("data-view", "home");
    const before = await canvasShot(page);
    const box = (await page.locator(".starmap-stage canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55);
    await page.mouse.wheel(0, -900);
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.waitForTimeout(400);
    expect((await canvasShot(page)).equals(before), "the picture did not change").toBe(false);
    await ctx.close();
  });

  test("a drag turns and tilts the system, and choosing nothing by it", async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await map(page);
    await settled(page);
    const before = await canvasShot(page);
    const box = (await page.locator(".starmap-stage canvas").boundingBox())!;
    const x = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.7;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y - 80, { steps: 8 });
    await page.mouse.up();
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.waitForTimeout(400);
    expect((await canvasShot(page)).equals(before)).toBe(false);
    await expect(page).toHaveURL(/\/app$/);
    await ctx.close();
  });

  test("on a phone, two fingers pinch to zoom", async ({ browser }, info) => {
    test.skip(wide(info.project.name), "the phone, 380");
    const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce", hasTouch: true });
    const page = await ctx.newPage();
    await map(page);
    await settled(page);
    const before = await canvasShot(page);
    const box = (await page.locator(".starmap-stage canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.68;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", gap: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: cx - gap, y: cy, id: 1 }, { x: cx + gap, y: cy, id: 2 }],
      });
    await touch("touchStart", 30);
    for (let g = 40; g <= 140; g += 20) await touch("touchMove", g);
    await touch("touchEnd", 0);
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.waitForTimeout(400);
    expect((await canvasShot(page)).equals(before), "the pinch changed nothing").toBe(false);
    await page.screenshot({ path: "design/templates/web/app/current-looking-380.png" });
    await ctx.close();
  });

  test("+ and − zoom from the keyboard; R brings the view home", async ({ page }) => {
    await map(page);
    await settled(page);
    await page.keyboard.press("+");
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.keyboard.press("r");
    await expect(stage(page)).toHaveAttribute("data-view", "home");
    await page.keyboard.press("=");
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.keyboard.press("-");
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
  });

  test("thirty seconds of nothing, and the view goes home on its own (not at 29)", async ({ page }) => {
    // fastForward jumps the clock, firing only the timers that fall due. runFor
    // would step through every animation frame in between: about 1,700 WebGL
    // frames rendered in software for 29s, which timed the test out.
    await page.clock.install();
    await map(page);
    await page.keyboard.press("+");
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.clock.fastForward(29_000);
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    // More input restarts the thirty seconds.
    await page.keyboard.press("+");
    await page.clock.fastForward(29_000);
    await expect(stage(page)).toHaveAttribute("data-view", "looking");
    await page.clock.fastForward(1_500);
    await expect(stage(page)).toHaveAttribute("data-view", "home");
  });

  test("capture: zoomed in on the inner system, 1440", async ({ browser }, info) => {
    test.skip(!wide(info.project.name), "1440; the phone's is the pinch's");
    const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await map(page);
    await settled(page);
    const box = (await page.locator(".starmap-stage canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -400);
    await page.waitForTimeout(600);
    await page.screenshot({ path: "design/templates/web/app/current-looking.png" });
    await ctx.close();
  });
});
