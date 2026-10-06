import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/app`'s cost, measured rather than assumed (R5.3; GAME-DESIGN §10.2,
 * SKILL-TREE-3D §6): draw calls per frame with the whole system rendering
 * (planets, moons, rings, bands, the frost line, every population, the Trojans
 * and the field), and the frame rate on a throttled profile.
 *
 * DRAW CALLS ARE COUNTED AT THE GL, not read from the app: an init script wraps
 * every WebGL draw entry point and a requestAnimationFrame loop banks the count
 * once per frame. Nothing in the production bundle exposes the renderer, and
 * nothing needs to. `renderer.info.render.calls` counts the same thing.
 */

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

/**
 * A hardware GPU where the machine has one (ANGLE on D3D11). Headless
 * Chromium's default is SwiftShader, a software renderer; the frame-rate test
 * below explains why that matters. Draw calls are counted at the GL either way.
 */
test.use({ launchOptions: { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] } });

/** The draw-call budget (SKILL-TREE-3D §6, R5.3). */
const BUDGET = 50;

function counter(): void {
  type W = Window & { __dc: { now: number; frames: number[]; times: number[] } };
  const w = window as unknown as W;
  w.__dc = { now: 0, frames: [], times: [] };
  const names = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements"];
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext] as Array<{ prototype: Record<string, unknown> }>) {
    for (const n of names) {
      const f = C.prototype[n] as ((...a: unknown[]) => unknown) | undefined;
      if (typeof f !== "function") continue;
      C.prototype[n] = function (this: unknown, ...a: unknown[]) {
        w.__dc.now += 1;
        return f.apply(this, a);
      };
    }
  }
  const tick = (t: number) => {
    // A frame counts only if it drew: the times of DRAWN frames give the frame rate.
    if (w.__dc.now > 0) {
      w.__dc.frames.push(w.__dc.now);
      w.__dc.times.push(t);
    }
    w.__dc.now = 0;
    if (w.__dc.frames.length > 400) w.__dc.frames.shift();
    if (w.__dc.times.length > 2000) w.__dc.times.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function open(page: Page, path: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
  await page.addInitScript(counter);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-stage canvas").waitFor();
  await page.waitForTimeout(6000); // textures, and the frame-rate guard's one switch
}

/** The last frames' draw calls: the most any frame drew, and the median. */
async function drawCalls(page: Page): Promise<{ max: number; median: number; frames: number }> {
  await page.evaluate(() => ((window as unknown as { __dc: { frames: number[] } }).__dc.frames.length = 0));
  await page.waitForTimeout(1500);
  const f = await page.evaluate(() => [...(window as unknown as { __dc: { frames: number[] } }).__dc.frames]);
  const s = [...f].sort((a, b) => a - b);
  return { max: s.at(-1) ?? 0, median: s[Math.floor(s.length / 2)] ?? 0, frames: s.length };
}

test.describe("/app — what the full system costs (R5.3)", () => {
  for (const [label, path] of [
    ["the whole system", "/app"],
    ["a giant chosen, its moons drawn", "/app?stage=06"],
    ["the most crowded planet chosen (eleven moons)", "/app?stage=03"],
  ] as const) {
    test(`draw calls stay within ${BUDGET} per frame: ${label}`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await open(page, path);
      const dc = await drawCalls(page);
      info.annotations.push({ type: "draw calls", description: `${label}: max ${dc.max}, median ${dc.median}, over ${dc.frames} frames` });
      console.log(`[${info.project.name}] ${label}: draw calls max ${dc.max}, median ${dc.median} (${dc.frames} frames)`);
      expect(dc.frames, "no frame was drawn: is the canvas rendering?").toBeGreaterThan(5);
      expect(dc.max).toBeLessThanOrEqual(BUDGET);
    });
  }
});

/** The 30 fps floor (SKILL-TREE-3D §6; VISUAL-SYSTEM-3D §5 rung 4). */
const FLOOR = 30;
/** Chrome's 4x CPU slowdown: Lighthouse's "mid-tier mobile" setting. OCTA_THROTTLE overrides it to probe the margin
 *  (7 Oct 2026, RTX 3050: 60 fps at 4x, 57.5 at 8x, 24.1 at 16x with the guard's lower quality on, which
 *  cuts GPU cost and cannot rescue a CPU-bound device). */
const THROTTLE = Number(process.env.OCTA_THROTTLE ?? 4);

test.describe("/app — the 30 fps floor on a throttled profile (R5.3)", () => {
  /*
   * The whole system (rings, bands, planets, moons, populations, the field)
   * rendering on a 4x-slowed CPU. The guard may drop the picture's quality
   * (rung 4: never the map) after 3 slow seconds; what must hold is that the
   * map then draws at 30 fps or better. Frames are counted at the GL, so a
   * frame that drew nothing (an idle demand loop) never counts.
   *
   * ON A HARDWARE GPU. Headless Chromium's default WebGL is SwiftShader, a
   * software renderer that measured ~27 fps here with NO slowdown at all
   * (7 Oct 2026), so it measures the renderer, not the map. ANGLE on D3D11
   * reaches the machine's GPU; where none exists the test skips and says so
   * rather than pass or fail on a number that means nothing. The renderer is
   * written into the result.
   */
  for (const [label, path] of [
    ["the whole system", "/app"],
    ["the most crowded planet chosen (eleven moons)", "/app?stage=03"],
  ] as const) {
    test(`draws at ${FLOOR} fps or better, 4x CPU slowdown: ${label}`, async ({ page }, info) => {
      test.setTimeout(90_000);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
      await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
      await page.addInitScript(counter);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.locator(".starmap-stage canvas").waitFor({ timeout: 45_000 });
      const renderer = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
      });
      test.skip(/SwiftShader|llvmpipe|unknown/i.test(renderer), `no hardware GPU here (${renderer}): the frame rate would measure a software renderer`);
      // 4 s unjudged + 3 slow seconds for the guard, and margin for textures.
      await page.waitForTimeout(12_000);
      await page.evaluate(() => ((window as unknown as { __dc: { times: number[] } }).__dc.times.length = 0));
      await page.waitForTimeout(5_000);
      const times = await page.evaluate(() => [...(window as unknown as { __dc: { times: number[] } }).__dc.times]);
      const lowered = await page.evaluate(() => localStorage.getItem("octa:map-quality") !== null);
      const fps = times.length > 1 ? ((times.length - 1) * 1000) / (times.at(-1)! - times[0]!) : 0;
      const note = `${label}: ${fps.toFixed(1)} fps over ${times.length} drawn frames, quality ${lowered ? "lowered by the guard" : "full"}, on ${renderer}`;
      info.annotations.push({ type: "frame rate", description: note });
      console.log(`[${info.project.name}] ${note}`);
      expect(times.length, "no frame was drawn: is the canvas rendering?").toBeGreaterThan(5);
      expect(fps).toBeGreaterThanOrEqual(FLOOR);
    });
  }
});
