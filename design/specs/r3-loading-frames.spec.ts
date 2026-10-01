import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";

/**
 * R3.4: "Both [loading screens] captured as short frame sequences per
 * REDESIGN-CLAUDE.md §2, not single stills" — the two transitions a student
 * sees while a place loads, as they are since the remake (WEB-REMAKE.md §5):
 *
 *   1. the realm warp, both ways (`RealmWarp`, `--dur-warp`, 1.1s since 2 Oct
 *      2026): star -> biome when a planet is entered (and the arrival screen
 *      after it), biome -> star when it is left
 *   2. the biome arrival (`StageReader`'s loading branch): the planet's biome
 *      at once, layout-shaped skeletons after 400ms, words after 3s, then the
 *      reading
 *
 * The warp's frames are EXACT, not raced: its Web Animations are paused and
 * sought to fixed times, so frame t is the same picture on every run. The
 * arrival's frames are taken with the stage request held open, since a fast
 * fetch never shows it. Frames land in `design/templates/web/loading/`, and
 * each is asserted to show what its time should show. Reduced motion is
 * asserted elsewhere (`web-shell.spec.ts`, `arrival.spec.ts`).
 */

const DIR = "design/templates/web/loading";
const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
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
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const TOKEN = token();
const suffix = (name: string) => (name.includes("380") ? "-380" : "");

test.use({ contextOptions: { reducedMotion: "no-preference" } });
test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

async function signIn(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
}

/**
 * Pause the warp's animations the instant it mounts, from inside the page: a
 * warp is over before a round trip from the test could catch it.
 */
async function armWarpHold(page: Page): Promise<void> {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const w = document.querySelector(".realm-warp") as (Element & { held?: boolean }) | null;
      if (!w || w.held) return;
      w.held = true;
      for (const a of document.getAnimations()) {
        const t = (a.effect as KeyframeEffect | null)?.target;
        if (t instanceof Element && t.closest(".realm-warp")) a.pause();
      }
    }).observe(document, { subtree: true, childList: true });
  });
}

async function heldWarp(page: Page): Promise<number> {
  await page.locator(".realm-warp").waitFor({ state: "attached", timeout: 5000 });
  return page.evaluate(
    () =>
      document.getAnimations().filter((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target;
        return t instanceof Element && !!t.closest(".realm-warp") && a.playState === "paused";
      }).length,
  );
}

async function seekWarp(page: Page, ms: number): Promise<void> {
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      const el = (a.effect as KeyframeEffect | null)?.target;
      if (el instanceof Element && el.closest(".realm-warp")) a.currentTime = t;
    }
  }, ms);
}

// The warp is --dur-warp, 1.1s since 2 Oct 2026. The last frame stops short of
// the end: seeking a paused animation to its end fires animationend, and the
// warp removes itself mid-capture.
const TIMES = [0, 180, 360, 540, 720, 900, 1080];

async function warpFrames(page: Page, dir: "in" | "out", s: string): Promise<number[]> {
  await expect(page.locator(".realm-warp")).toHaveAttribute("data-warp", dir);
  expect(await heldWarp(page), "the warp's two animations, held").toBeGreaterThanOrEqual(2);
  const cover: number[] = [];
  for (const t of TIMES) {
    await seekWarp(page, t);
    cover.push(await page.locator(".realm-warp").evaluate((el) => Number(getComputedStyle(el).opacity)));
    await page.screenshot({ path: `${DIR}/warp-${dir}-${String(t).padStart(4, "0")}${s}.png` });
  }
  // Let it finish: a loading state that never clears is a stuck page.
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await expect(page.locator(".realm-warp")).toHaveCount(0, { timeout: 3000 });
  return cover;
}

test("the realm warp, both ways, as frames", async ({ page }, info) => {
  test.setTimeout(60_000);
  const s = suffix(info.project.name);
  await signIn(page);
  await armWarpHold(page);
  await page.goto("/app?stage=01", { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-body h2").waitFor();
  await page.waitForTimeout(1500); // the map's textures land
  await page.locator(".starmap-body").getByRole("link", { name: "Enter journey" }).click();
  const inCover = await warpFrames(page, "in", s);
  expect(inCover[0], "the first frame of the new realm is under the warp's full cover").toBeGreaterThan(0.9);
  expect(inCover[inCover.length - 1], "and the last has cleared").toBeLessThan(0.1);

  await page.locator("[data-reader]").first().waitFor();
  // The arrival screen follows the warp in (2 Oct 2026): its frame, then a key clears it.
  await page.locator(".arrival-facts li").first().waitFor();
  await page.screenshot({ path: `${DIR}/warp-in-arrival${s}.png` });
  await page.keyboard.press("Enter");
  await expect(page.locator(".arrival")).toHaveCount(0);
  await page.getByRole("link", { name: "Leave planet" }).click();
  const outCover = await warpFrames(page, "out", s);
  expect(outCover[0]).toBeGreaterThan(0.9);
  expect(outCover[outCover.length - 1]).toBeLessThan(0.1);
});

test("the biome arrival, as frames: biome at once, skeleton at 400ms, words at 3s, then the reading", async ({ page }, info) => {
  test.setTimeout(60_000);
  const s = suffix(info.project.name);
  await signIn(page);
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/stages/01", async (route) => {
    await released;
    await route.continue();
  });
  await page.goto("/app/stage/01", { waitUntil: "domcontentloaded" });
  // Timed from the reader's mount, where its 400ms and 3s clocks start, not
  // from goto: the app's own boot can take longer than 400ms.
  await page.locator('[data-reader="loading"]').waitFor({ state: "attached" });
  const t0 = Date.now();
  const at = async (ms: number) => {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
  };
  const reader = page.locator("[data-reader]").first();

  await at(100);
  await expect(page.locator("html")).toHaveAttribute("data-realm", "biome");
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  await page.screenshot({ path: `${DIR}/arrival-0100${s}.png` });

  await at(700);
  await expect(reader).toHaveAttribute("data-reader", "loading");
  await expect(reader).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("[data-skeleton]")).toBeVisible();
  await page.screenshot({ path: `${DIR}/arrival-0700${s}.png` });

  await at(3300);
  await expect(page.locator(".rd-slow")).toBeVisible();
  await page.screenshot({ path: `${DIR}/arrival-3300${s}.png` });

  release();
  await expect(reader).toHaveAttribute("data-reader", "reading", { timeout: 10_000 });
  await expect(page.locator(".rd-slow")).toHaveCount(0);
  await page.screenshot({ path: `${DIR}/arrival-landed${s}.png` });
});
