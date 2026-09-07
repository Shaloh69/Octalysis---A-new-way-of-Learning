import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * R1 — the solar system, captured and asserted.
 *
 * `design/specs/before-baseline.spec.ts` recorded what `/app` did before this
 * phase and deliberately asserted nothing about it. This file is the other
 * half: now that F-5 is ruled, the degradation ladder is a contract and gets
 * hard assertions rather than annotations.
 *
 * THE LADDER (docs/VISUAL-SYSTEM-3D.md §5, which F-5 made the single owner):
 * 3D is the default on a capable device; reduced motion, a small viewport and
 * absent WebGL each fall back to the flat presentation IN PLACE. Nothing
 * redirects — the DOM layer is already on screen underneath, so nothing has to
 * move. Every case below asserts the URL is unchanged, because a redirect
 * creeping back in is the specific regression this file exists to catch.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

/**
 * Two students from db/demo-seed.sql. Fixture data by construction, so no real
 * name can reach `design/`.
 *
 * `fresh` has nothing unlocked past orientation and `progressing` has seven
 * stages of history — both are captured, because a map where everything is
 * locked and a map where the path has actually been walked are different
 * pictures, and only one of them was ever going to get looked at otherwise.
 */
const STUDENTS = {
  fresh: { sub: "dddddddd-1111-4000-8000-000000000001", studentId: "232129001" },
  progressing: { sub: "dddddddd-1111-4000-8000-000000000006", studentId: "232129006" },
};

function mintDevToken(who: { sub: string; studentId: string }): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: who.sub,
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: who.studentId },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function signIn(page: Page, who: keyof typeof STUDENTS = "fresh"): Promise<void> {
  await page.addInitScript(
    ([token]) => window.localStorage.setItem("octa:dev-token", token as string),
    [mintDevToken(STUDENTS[who])],
  );
}

async function capture(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const file = testInfo.outputPath(`${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

/**
 * Wait for the page to be genuinely ready, not for a fixed number of
 * milliseconds.
 *
 * This was `waitForTimeout(1800)`, which passed serially and failed at eight
 * parallel workers against a single dev server -- the signature of a sleep
 * standing in for a real wait. The act list is the DOM layer and always
 * renders; the canvas is lazy-loaded, so it is waited for only where the
 * degradation ladder says it should exist.
 */
async function settle(page: Page, expectCanvas = false): Promise<void> {
  // The map HEADER, not the act list. On `/app` the list now lives inside a
  // collapsed disclosure so the solar system can be the page, so waiting for it
  // to be VISIBLE would hang forever there while passing on `/app/map`.
  await page.locator(".map-header").waitFor();
  if (expectCanvas) await page.locator("canvas").waitFor();
}

/**
 * Open the stage list if it is folded.
 *
 * On `/app` it is a `<details>`; on `/app/map` it is always open. Everything
 * inside is in the DOM either way — this only makes it visible so assertions
 * about rendered text can run.
 */
async function openStageList(page: Page): Promise<void> {
  // The complete list is its own route now. It used to sit under the map as
  // four columns of paragraphs; `/app/stages` carries the same 19 stages with
  // progress bars, planet marks and every lock reason still printed.
  await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
  await page.locator(".stage-acts").waitFor();
}

test.describe("the solar system renders", () => {
  test("draws a canvas on a capable device, WITHOUT being asked", async ({ page }, testInfo) => {
    // F-5's substance. 3D used to sit behind a localStorage preference that
    // defaulted to off, so a student saw a canvas only if they found the
    // toggle. No document ever sanctioned that.
    test.skip(testInfo.project.name !== "desktop-1440", "3D is flat-by-ladder at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    expect(await page.locator("canvas").count()).toBe(1);
    expect(new URL(page.url()).pathname, "nothing redirects").toBe("/app");
    await capture(page, "solar-fresh", testInfo);
  });

  test("shows a walked path differently from an untouched one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "3D is flat-by-ladder at 380px");

    await signIn(page, "progressing");
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    // The headline is server-derived and is the cheapest proof that this
    // student's state actually reached the page.
    await expect(page.locator(".map-sub")).toContainText(/of 19 subsystems online/);
    await capture(page, "solar-progressing", testInfo);
  });

  test("does not draw two maps at once", async ({ page }, testInfo) => {
    // The flat SVG is the OTHER presentation of the same 19 stages. Drawing it
    // under the solar system put text on orbit lines and two maps on top of
    // each other -- DESIGN-REVIEW-01's D-2 in a new place.
    test.skip(testInfo.project.name !== "desktop-1440", "3D is flat-by-ladder at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    expect(await page.locator("canvas").count()).toBe(1);
    expect(await page.locator("svg.galaxy-svg").count(), "never both at once").toBe(0);
  });

  test("/app/map draws the flat galaxy and NO canvas", async ({ page }, testInfo) => {
    /*
     * The other direction of the same rule, and it was broken.
     *
     * `/app/map` is the flat view asked for BY CHOICE, but the backdrop is
     * mounted in `App.tsx`, a level above the component whose comment forbids
     * two maps -- so the route drew the WebGL solar system AND the flat galaxy
     * on top of it. Survivable while the flat map was a strata DAG that looked
     * nothing like the scene; unmissable now that both draw the same rings from
     * the same layout.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    await signIn(page);
    await page.goto("/app/map", { waitUntil: "networkidle" });
    await settle(page);

    expect(await page.locator("svg.galaxy-svg").count(), "the flat galaxy draws").toBe(1);
    expect(
      await page.locator("canvas").count(),
      "no canvas on the route that exists to avoid one",
    ).toBe(0);
  });

  test("the flat galaxy holds still", async ({ page }, testInfo) => {
    /*
     * Two of the four rungs that send a student here are "this device is
     * struggling" and "this person asked for less motion". Both are answered by
     * holding still, so this surface must not animate -- and must not run a
     * rAF loop even invisibly, which is the cost the slow-device rung exists to
     * avoid.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await signIn(page);
    await page.goto("/app/map", { waitUntil: "networkidle" });
    await settle(page);

    /*
     * Measured RELATIVE to the map's own box, not in page coordinates.
     *
     * The first version compared absolute rects and was flaky under parallel
     * load: any page-level reflow -- a late font, a scrollbar appearing --
     * moved the whole map and read as "the galaxy animated". That is the wrong
     * question. What must hold still is the galaxy's CONTENTS relative to the
     * galaxy, which a reflow cannot disturb and an animation cannot avoid.
     */
    const moving = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          const box = () => document.querySelector(".galaxy-svg")!.getBoundingClientRect();
          const offsets = () => {
            const b = box();
            return [...document.querySelectorAll(".galaxy-sun, .galaxy-planet, .galaxy-moon")].map(
              (el) => {
                const r = el.getBoundingClientRect();
                return [r.x - b.x, r.y - b.y] as const;
              },
            );
          };
          const before = offsets();
          setTimeout(() => {
            const after = offsets();
            res(
              before.reduce(
                (total, [x, y], i) =>
                  total + Math.abs(after[i]![0] - x) + Math.abs(after[i]![1] - y),
                0,
              ),
            );
          }, 1200);
        }),
    );
    expect(moving, "no body on the flat map may move within it").toBe(0);

    // And no animation is declared on any of it, which a static frame alone
    // would not prove -- a slow enough animation looks still for 1.2s.
    const animated = await page.evaluate(() =>
      [...document.querySelectorAll(".galaxy-scroll *")].filter((el) => {
        const cs = getComputedStyle(el);
        return cs.animationName !== "none" && cs.animationDuration !== "0s";
      }).length,
    );
    expect(animated, "no CSS animation may be declared on the flat map").toBe(0);
  });
});

test.describe("the degradation ladder — falls back in place, never redirects", () => {
  test("reduced motion falls back to flat, on the same route", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    expect(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      "media emulation must actually apply, or this test is theatre",
    ).toBe(true);

    expect(await page.locator("canvas").count(), "no canvas under reduced motion").toBe(0);
    expect(new URL(page.url()).pathname, "must NOT redirect").toBe("/app");
    /*
     * The flat map takes over IN PLACE, so the page is still a map -- and it is
     * now the same galaxy, drawn still: same rings, same angles, same moons,
     * from the same `computeSolarLayout` the canvas uses. It used to be a
     * level-strata DAG (`svg.map-svg`), which meant a student sent here by
     * reduced motion had to rebuild their mental model rather than recognise a
     * quieter version of the map they knew.
     */
    expect(await page.locator("svg.galaxy-svg").count(), "the flat galaxy draws").toBe(1);
    expect(await page.locator(".galaxy-ring").count(), "orbits, not strata").toBeGreaterThan(0);
    expect(await page.locator(".galaxy-moon").count(), "moons are drawn here too")
      .toBeGreaterThan(0);
    // Every stage, locked included: this layer never withholds (§1.4b).
    expect(await page.locator(".node-hit").count(), "all 19 remain real controls").toBe(19);
    await capture(page, "solar-reduced-motion", testInfo);
  });

  test("WebGL being unavailable falls back to flat, silently", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    // Break WebGL before any app code runs. This is the check SKILL-TREE-3D.md
    // §4 says to do "by disabling WebGL in the browser, not by hoping" -- and
    // R0 recorded that it used to pass vacuously, because no canvas rendered by
    // default anyway. It only means something now that 3D is on.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
        return (original as unknown as (...a: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    expect(new URL(page.url()).pathname, "must NOT redirect").toBe("/app");
    // No error state, no "your browser is unsupported": nothing is missing.
    // The page renders its map chrome with no canvas behind it, and the
    // complete stage list is one link away on its own route.
    await expect(page.locator(".map-header")).toBeVisible();
    await expect(page.getByRole("link", { name: /All 19 stages/ })).toBeVisible();
    await capture(page, "solar-no-webgl", testInfo);
  });

  test("a remembered too-slow verdict falls back to flat", async ({ page }, testInfo) => {
    // Ladder rung 4's memory. The guard itself only fires on a genuinely slow
    // device, which this machine is not -- so the REMEMBERED verdict is what is
    // testable here, and it is the half that decides what a student sees on
    // their second visit.
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    await signIn(page);
    await page.addInitScript(() =>
      localStorage.setItem("octa:map-too-slow", JSON.stringify({ at: Date.now() })),
    );
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    expect(await page.locator("canvas").count(), "must fall back to flat").toBe(0);
    expect(new URL(page.url()).pathname, "must NOT redirect").toBe("/app");
    // Flat mode renders the list open, so no disclosure to expand.
    await expect(page.locator(".map-header")).toBeVisible();
  });

  test("a STALE too-slow verdict is forgotten, and 3D comes back", async ({ page }, testInfo) => {
    /*
     * The verdict used to be permanent, and that is the whole bug behind "why
     * am I still seeing the 2D map". One bad startup -- a cold shader cache, a
     * busy machine, another tab pinning the GPU -- wrote the flag and nothing
     * ever re-measured. The student had no way back and, because the fallback
     * is deliberately silent, no way to know why.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    await signIn(page);
    const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;
    await page.addInitScript((ms) => {
      localStorage.setItem(
        "octa:map-too-slow",
        JSON.stringify({ at: Date.now() - (ms as number) }),
      );
    }, EIGHT_DAYS);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    expect(await page.locator("canvas").count(), "an expired verdict must not hold").toBe(1);
    // And it is cleared, so the device is re-measured rather than re-judged.
    expect(
      await page.evaluate(() => localStorage.getItem("octa:map-too-slow")),
      "a stale verdict must be forgotten, not merely ignored",
    ).toBeNull();
  });

  test("a browser stuck by the OLD sticky flag is released", async ({ page }, testInfo) => {
    /*
     * The previous format was the bare string "1", with no timestamp, and every
     * browser that ever tripped the old guard still carries it. Those students
     * are stuck in 2D with nothing in the UI to explain it, so the new reader
     * treats the old value as stale rather than migrating it: JSON.parse("1")
     * is a number, not a {at} record.
     *
     * This is the upgrade path, and it is worth a test precisely because it
     * only ever runs once per browser and would otherwise never be exercised.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    await signIn(page);
    await page.addInitScript(() => localStorage.setItem("octa:map-too-slow", "1"));
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    expect(await page.locator("canvas").count(), "the old flag must not strand anyone").toBe(1);
    expect(
      await page.evaluate(() => localStorage.getItem("octa:map-too-slow")),
      "the legacy value must be cleared, not left to be re-read",
    ).toBeNull();
  });

  test("the guard does NOT fire on a machine that can hold 30fps", async ({ page }, testInfo) => {
    // The other half: a fallback that triggers spuriously is worse than none,
    // because it silently removes the default experience. Measured at 47fps
    // under a 6x CPU throttle, so it must stay quiet here.
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    /*
     * Measure what this machine ACTUALLY sustained, rather than assuming it is
     * fast.
     *
     * The first version asserted the guard stays quiet, full stop, and it
     * failed in the parallel harness -- four Chromium instances each rendering
     * WebGL can genuinely sit under 30fps, at which point the guard firing is
     * correct behaviour, not a bug. A test that fails when the feature works is
     * worse than no test.
     *
     * So: only assert the guard stayed quiet if the environment gave it no
     * reason to fire.
     */
    const fps = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          let f = 0;
          const t0 = performance.now();
          const tick = (): void => {
            f++;
            if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
            else res(f / ((performance.now() - t0) / 1000));
          };
          requestAnimationFrame(tick);
        }),
    );

    test.skip(fps < 32, `this run only sustained ${fps.toFixed(1)}fps — the guard is right to fire`);

    expect(await page.locator("canvas").count(), "guard fired when it should not").toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("octa:map-too-slow"))).toBeNull();
  });

  test("a small viewport is flat, and 380px does not scroll sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-380", "this is the 380px case");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    expect(await page.locator("canvas").count(), "no canvas at 380px").toBe(0);
    expect(new URL(page.url()).pathname, "must NOT redirect").toBe("/app");

    // 380px with no horizontal scroll is a hard requirement in the definition
    // of done, not a nice-to-have.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the page scrolls sideways at 380px").toBeLessThanOrEqual(0);

    await capture(page, "solar-380", testInfo);
  });
});

test.describe("loading states — the backdrop moving through them", () => {
  test("the warp fires on hub navigation, not on arrival", async ({ page }, testInfo) => {
    /*
     * BIOME-AND-LOADING-SPEC.md §4.1, as revised for the full-page backdrop:
     * this is the star field ALREADY on screen accelerating, not an overlay.
     * First paint is an arrival, not a navigation — warping on it would greet
     * every student with an animation before they had done anything.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "no backdrop at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    expect(await page.locator(".solar-backdrop.is-warping").count(), "no warp on arrival")
      .toBe(0);

    await page.getByRole("link", { name: "Progress", exact: true }).click();
    await expect(page.locator(".solar-backdrop.is-warping")).toHaveCount(1);

    // And it ends. A loading state that never clears is a stuck page.
    await expect(page.locator(".solar-backdrop.is-warping")).toHaveCount(0, { timeout: 4000 });
  });

  test("reduced motion skips the warp entirely rather than slowing it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no backdrop at 380px");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    // Under reduced motion the backdrop does not render at all (ladder rung 1),
    // so there is nothing to warp -- which is the strongest form of "skipped".
    expect(await page.locator(".solar-backdrop").count()).toBe(0);
    await page.getByRole("link", { name: "Progress", exact: true }).click();
    await page.waitForTimeout(300);
    expect(await page.locator(".solar-backdrop.is-warping").count()).toBe(0);
  });

  test("entering a stage TRAVELS — it does not jump", async ({ page }, testInfo) => {
    /*
     * §4.2: "backdrop recedes -> warp -> biome resolves -> content mounts."
     *
     * This exists because the 3D HUD called `onOpen` directly and jumped, while
     * the flat map went through `warpThen`. The result was backwards -- the
     * accessibility fallback travelled to a planet and every student's DEFAULT
     * surface cut straight from the galaxy to a biome. Both paths compiled,
     * both navigated, both landed on the right stage; the only difference was a
     * feeling, on the one navigation in the app that is meant to feel like
     * going somewhere.
     *
     * IT IS DRIVEN FROM `/app/map`, not from the 3D HUD, and that is a real
     * limit worth stating rather than hiding. The canvas is `aria-hidden` and
     * exposes no per-planet DOM controls -- `.map-hits` is empty there by
     * design, because the accessibility contract from that page is the "All 19
     * stages" link, not 19 invisible buttons. So the HUD's enter button cannot
     * be reached headlessly.
     *
     * What this does cover is `openWithWarp` itself, which is now the single
     * handler BOTH surfaces call. The fix was making the 3D path use it; this
     * asserts the thing it was pointed at actually warps.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await signIn(page);
    await page.goto("/app/map", { waitUntil: "networkidle" });

    /*
     * An UNLOCKED stage. `.first()` is Stage 00, which the demo fixtures leave
     * closed by the instructor, so clicking it waits forever on a disabled
     * button -- a locked planet correctly refusing to be entered.
     */
    const hit = page.locator('.node-hit:not([aria-disabled="true"]), .map-hit:not([aria-disabled="true"])').first();
    await hit.waitFor({ timeout: 15_000 });

    /*
     * Watch for the streaks rather than sampling after the fact: the warp runs
     * ~620ms and then deliberately clears, so a check that runs late sees a
     * settled page and passes for the wrong reason.
     */
    const sawWarp = page
      .locator(".is-warping")
      .waitFor({ state: "attached", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    await hit.click();
    const enter = page.getByRole("button", { name: /enter|open|begin|start/i }).first();
    if (await enter.isVisible().catch(() => false)) await enter.click();

    expect(await sawWarp, "selecting a stage jumped instead of travelling").toBe(true);

    // And it arrives on the other side rather than hanging in the warp.
    await expect(page.locator(".biome")).toHaveCount(1, { timeout: 10_000 });
  });

  test("a content surface has no backdrop, so the warp cannot follow a student in", async ({ page }) => {
    // §4.2's transition owns the way into a stage, not §4.1's. Two loading
    // animations for one navigation would be a bug.
    await signIn(page);
    await page.goto("/app/stage/00", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    expect(await page.locator(".solar-backdrop").count(), "no backdrop on a stage").toBe(0);
    expect(await page.locator(".solar-backdrop.is-warping").count()).toBe(0);
  });
});

test.describe("the map override in settings", () => {
  test("turning the map off falls back to flat, everywhere", async ({ page }, testInfo) => {
    /*
     * VISUAL-SYSTEM-3D.md §5's last line, and the last rung of its ladder to be
     * built. Rungs 1-5 all decide FOR the student; this is the student
     * deciding, and §5 requires it to exist for that reason.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "already flat at 380px");

    await signIn(page);
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: /Flat map only/i }).check();

    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);
    expect(await page.locator("canvas").count(), "the override must be honoured").toBe(0);
    expect(new URL(page.url()).pathname, "and must not redirect").toBe("/app");

    // Reversible, which is the mandate's third test.
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: /Solar system/i }).check();
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);
    expect(await page.locator("canvas").count()).toBe(1);
  });
});

test.describe("the DOM layer stays the accessibility contract", () => {
  test("every stage is a real control, whatever the canvas is doing", async ({ page }) => {
    await signIn(page);
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await settle(page);

    /*
     * The canvas is aria-hidden and carries no semantics at all, so the map
     * page must reach the complete list rather than contain it. That link IS
     * the contract from this page: it is a real control, in text, always
     * present, and it goes somewhere that names all 19.
     */
    await expect(page.getByRole("link", { name: /All 19 stages/ })).toBeVisible();

    await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await page.locator(".stage-acts").waitFor();
    expect(
      await page.locator(".stage-row-btn").count(),
      "all 19 are real focusable controls",
    ).toBeGreaterThanOrEqual(19);
  });

  test("every planet has a real control positioned over it", async ({ page }, testInfo) => {
    // SKILL-TREE-3D.md §4's two-layer architecture, which R1 deferred and R3
    // built: "every click, focus and screen-reader announcement is handled by
    // real DOM elements positioned over their 3D counterparts."
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);
    await page.locator(".map-hit").first().waitFor();

    const state = await page.evaluate(() => {
      const hits = [...document.querySelectorAll<HTMLElement>(".map-hit")];
      return {
        total: hits.length,
        placed: hits.filter((el) => el.style.opacity === "1").length,
        // Distinct positions: if the projection silently failed, every button
        // would stack at the same point and still "exist".
        distinct: new Set(hits.map((el) => el.style.transform)).size,
        order: hits.map((el) => el.querySelector(".map-hit-id")?.textContent ?? ""),
      };
    });

    /*
     * Not 19 any more, and that is deliberate: progressive reveal (§1.4b) means
     * only reached planets have a body, and a planet with no body must have no
     * hit target either — an invisible clickable control is worse than none.
     * The COMPLETE list is the act list, asserted separately.
     */
    expect(state.total, "at least the reached planets have controls").toBeGreaterThan(0);
    expect(state.total, "and never more than the whole syllabus").toBeLessThanOrEqual(19);
    expect(state.placed, "every drawn planet is projected on screen").toBe(state.total);
    expect(new Set(state.order).size, "two controls claim the same stage id")
      .toBe(state.total);
    /*
     * The stacking check, which the message above USED to claim while actually
     * comparing ids. `distinct` was computed for exactly this and then never
     * asserted, so a projection collapsing every button onto one point would
     * have passed: the ids stay unique no matter where the elements land.
     */
    expect(state.distinct, "every control sits at its own point -- else the projection collapsed")
      .toBe(state.total);

    // Focus order is CURRICULUM order, never screen position. A student
    // tabbing the map walks the syllabus, over whatever subset is revealed.
    expect(state.order).toEqual([...state.order].sort());
  });

  test("progressive reveal draws only reached planets, and the flat map still shows all 19", async ({ page }, testInfo) => {
    /*
     * SOLAR-SYSTEM-SPEC.md §1.4b, both halves — and the second half is the one
     * that matters most. The 3D layer may withhold for effect; the accessible
     * layer never does, because a student planning a semester needs the whole
     * syllabus shape.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page, "progressing");
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    const hits = await page.locator(".map-hit").count();

    // Fewer planets drawn than stages exist -- that IS the reveal.
    expect(hits, "3D layer should draw only reached planets").toBeLessThan(19);
    expect(hits, "but it must draw the ones the student has reached").toBeGreaterThan(0);

    /*
     * The exact number, taken from the server rather than hard-coded.
     *
     * "fewer than 19 and more than 0" passes with 1 planet or 18, so it would
     * not notice the reveal predicate drifting away from `state !== "locked"`.
     * Hard rule 4 says the client never decides a lock; this asserts it never
     * decides a REVEAL either -- the count must equal the number of non-locked
     * nodes in the payload, whatever the fixture happens to contain.
     */
    const flat = await page.context().newPage();
    await flat.addInitScript(
      ([token]) => window.localStorage.setItem("octa:dev-token", token as string),
      [mintDevToken(STUDENTS.progressing)],
    );
    await flat.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await flat.locator(".stage-acts").waitFor();
    const unlocked =
      (await flat.locator(".stage-row").count()) -
      (await flat.locator(".stage-row-locked").count());
    await flat.close();

    expect(hits, "one control per non-locked stage, exactly").toBe(unlocked);

    // No invisible clickable targets: every hit target has a body behind it.
    expect(
      await page.locator('.map-hit[aria-disabled="true"]').count(),
      "a locked planet has no body, so it must have no hit target either",
    ).toBe(0);

    // The DOM layer is complete regardless -- on its own route now.
    await openStageList(page);
    expect(await page.locator(".stage-row").count(), "the list must carry all 19").toBe(19);
    await expect(page.locator(".stage-acts")).toContainText(/Unlocks when Stage \d+/);
  });

  test("the stage list shows every stage, locked included, whatever the scene withholds", async ({ page }) => {
    await signIn(page, "progressing");
    await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await page.locator(".stage-acts").waitFor();

    expect(await page.locator(".stage-row").count()).toBe(19);
    expect(
      await page.locator(".stage-row-locked").count(),
      "locked stages must be visible here, in text",
    ).toBeGreaterThan(0);
    await expect(page.locator(".stage-acts")).toContainText(/Unlocks when Stage \d+/);
    await expect(page.locator(".stage-acts")).toContainText(/You're at \d+%/);
  });

  test("a locked planet's control still announces why", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    /*
     * Locked planets no longer have hit targets — they have no body to sit on
     * under progressive reveal. So the "why is this locked" announcement is the
     * ACT LIST's job, which is where it always had to work anyway: the canvas
     * is aria-hidden and carries no semantics at all.
     */
    await openStageList(page);
    const lockedItem = page.locator(".stage-row-locked").first();
    await expect(lockedItem).toContainText(/Unlocks when Stage \d+/);
    await expect(lockedItem).toContainText(/You're at \d+%/);
    expect(
      await page.locator('.map-hit[aria-disabled="true"]').count(),
      "an unreachable planet must not leave a clickable ghost behind",
    ).toBe(0);
  });

  test("clicking a planet opens the HUD and does NOT navigate", async ({ page }, testInfo) => {
    /*
     * SOLAR-SYSTEM-SPEC.md §2. This interaction did not exist until it was
     * asserted: `onOpen` was wired straight to `nav('/app/stage/:id')`, so a
     * click went to the destination and skipped the dialog entirely. The hit
     * layer had landed, which made it look built — clicking did *something*.
     *
     * `force: true` because the buttons track a drifting camera and never
     * satisfy Playwright's stability check. That is the projection working, not
     * a fault; a real pointer has no such requirement.
     */
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    /*
     * The PROGRESSING student, necessarily. A fresh account has exactly one
     * revealed planet — stage 00 — because progressive reveal draws only what
     * has been reached. That is the feature working, and it means a fresh
     * account cannot exercise a planet with subtopics.
     */
    await signIn(page, "progressing");
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    /*
     * Any drawn planet EXCEPT 00. Locked ones have no hit target under
     * progressive reveal, and stage 00 genuinely has zero objectives — it is
     * the one stage with no subtopic dots, which is real data, not a bug. The
     * first version of this test clicked it and then asserted dots > 0.
     */
    await page.locator('.map-hit:not(:has(.map-hit-id:text-is("00")))').first()
      .click({ force: true });
    const hud = page.locator(".hud");
    await hud.waitFor();

    // The click must NOT have navigated. That is the whole bug this catches.
    expect(new URL(page.url()).pathname).toBe("/app");

    /*
     * A SIDEBAR, not a modal. It docks right, the map stays live behind it, and
     * it deliberately does NOT trap focus or claim `aria-modal` -- the panel
     * does not own the screen, and saying it does would misreport what is
     * reachable to a screen reader.
     */
    await expect(hud).toHaveAttribute("role", "complementary");
    expect(await hud.getAttribute("aria-modal"), "a sidebar must not claim modality").toBeNull();

    /*
     * Docked to the right edge, full height — measured AFTER the slide-in.
     *
     * This raced the animation and intermittently read 1442 against a 1440
     * viewport: the panel enters by translating in from the right, so measuring
     * mid-flight catches it still outside. The page was never wrong; the
     * measurement was early. Waiting on the element's own animations is exact,
     * where a tolerance would have hidden a genuine 2px overflow if one ever
     * appeared.
     */
    await hud.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))),
    );

    const box = await hud.boundingBox();
    expect(box, "the panel must be on screen").not.toBeNull();
    const layoutWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.round(box!.x + box!.width), "docked to the right edge").toBe(layoutWidth);

    // Every §2 element that has real data behind it.
    await expect(hud.locator(".hud-act")).toBeVisible();          // Act chip
    await expect(hud.locator(".hud-glyph")).toBeVisible();        // state icon
    await expect(hud.locator(".hud-state")).toContainText(
      /Available|In progress|Mastered/,
    );
    // One selectable moon per objective. Real data: the count comes from the
    // map payload, and §5's focused tier makes them individually pickable.
    const moons = hud.locator(".hud-moon");
    expect(await moons.count()).toBeGreaterThan(0);

    /*
     * Each moon is NAMED. This list rendered "05.1 L0" six times over before
     * the map payload carried `description` -- ids and ring numbers name
     * nothing, and an unreadable selection control fails the mandate's
     * legibility test however well it behaves.
     */
    const first = (await moons.first().innerText()).trim();
    expect(first.length, "a moon must carry its objective's sentence").toBeGreaterThan(12);
    expect(first, "not just an id and a level").not.toMatch(/^\d{2}\.\d+\s*L\d$/);

    // Selecting highlights it, and selecting again clears -- the control is its
    // own undo, which is the mandate's reversibility test satisfied in place.
    await moons.first().click();
    await expect(hud.locator(".hud-moon.is-on")).toHaveCount(1);
    await moons.first().click();
    await expect(hud.locator(".hud-moon.is-on")).toHaveCount(0);

    // A reachable planet offers the one action. `Enter` is what navigates --
    // the click on the planet is not, which was the whole bug.
    await expect(hud.locator(".hud-enter")).toBeVisible();

    await capture(page, "hud-locked", testInfo);
  });

  test("focus moves into the sidebar but is NOT trapped, and Escape closes it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    await page.locator(".map-hit").first().click({ force: true });
    await page.locator(".hud").waitFor();

    /*
     * This test was called "the HUD traps focus" and never tested trapping --
     * it asserted focus PLACEMENT and stopped. The title outlived the design:
     * the panel is a sidebar now, and it deliberately does not trap. Both
     * halves are asserted below so the name and the behaviour cannot drift
     * apart again.
     */
    expect(
      await page.evaluate(() => document.querySelector(".hud")?.contains(document.activeElement)),
      "focus must move into the panel on open, so a keyboard user lands in it",
    ).toBe(true);

    // Tabbing to the end must LEAVE. A panel that does not own the screen must
    // not tell a screen-reader user that nothing else is reachable.
    const escaped = await page.evaluate(async () => {
      const hud = document.querySelector(".hud")!;
      const focusables = [...hud.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")];
      focusables[focusables.length - 1]?.focus();
      return hud.contains(document.activeElement);
    });
    expect(escaped, "sanity: focus is on the panel's last control").toBe(true);
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.querySelector(".hud")?.contains(document.activeElement)),
      "Tab past the last control must leave the panel -- no focus trap",
    ).toBe(false);

    await page.keyboard.press("Escape");
    await expect(page.locator(".hud")).toHaveCount(0);
    expect(new URL(page.url()).pathname, "Escape must not navigate either").toBe("/app");
  });

  test("an unlocked planet's HUD offers Enter, which is what navigates", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page, "progressing");
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    await page.locator('.map-hit:not([aria-disabled="true"])').first().click({ force: true });
    const hud = page.locator(".hud");
    await hud.waitFor();
    await expect(hud.locator(".hud-enter")).toBeVisible();

    await hud.locator(".hud-enter").click();
    // GAME-DESIGN.md §2: the dialog OFFERS "Enter stage". The button is the
    // step that navigates -- the click on the planet is not.
    await expect(page).toHaveURL(/\/app\/stage\/\d{2}/);
  });

  test("a locked stage still says why, in words, with the distance", async ({ page }) => {
    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);
    await openStageList(page);

    // The design mandate calls a lock with no visible reason "the single most
    // demotivating UI element in ed-tech". It is printed text, never a tooltip.
    await expect(page.locator(".stage-acts")).toContainText(/Unlocks when Stage \d+/);
    await expect(page.locator(".stage-acts")).toContainText(/You're at \d+%/);
  });
});

test.describe("the stages page carries the act grouping", () => {
  test("groups all 19 into the four NAMED grading periods", async ({ page }) => {
    await signIn(page, "progressing");
    await openStageList(page);

    const acts = page.locator(".stage-act");
    expect(await acts.count(), "four grading periods").toBe(4);
    expect(await page.locator(".stage-row").count(), "all 19 still present").toBe(19);

    /*
     * NAMED, as of the instructor's ruling (2 Sep 2026). This test previously
     * asserted the OPPOSITE -- that no name is ever printed -- because three
     * sources gave three groupings and printing "Prelim" over a group holding
     * chapter 05 would have misled a student into revising the wrong chapters.
     * The ruling settled the ranges, `db/schema.sql` was corrected to match,
     * and so this now guards the ruling rather than the silence.
     */
    const text = await page.locator(".stage-acts").innerText();
    for (const name of ["Prelim", "Midterm", "Semi-finals", "Finals"]) {
      expect(text, `${name} must be named`).toContain(name);
    }

    /*
     * The Finals is CUMULATIVE and must say so. It is the one period whose name
     * does not describe its scope -- it draws on the whole course, not only
     * chapters 13-17 -- and a student who reads the heading and revises only
     * its own chapters has been misled by a label we chose.
     */
    expect(text, "the Finals' scope cannot be left implicit").toMatch(/cumulative/i);

    // The range stays printed beside each name, so the grouping is checkable
    // rather than something a student has to take on trust.
    await expect(page.locator(".act-head").first()).toContainText(/Stages \d{2}–\d{2}/);

    // Grouping is presentational: focus order still walks the syllabus.
    const ids = await page.locator(".stage-row-id").allInnerTexts();
    expect(ids, "curriculum order, never screen position").toEqual([...ids].sort());
  });

  test("the periods match the ruled chapter ranges", async ({ page }) => {
    /*
     * The ranges themselves, asserted from the rendered page.
     *
     * Prelim 1-4, Midterm 5-8, Semi-finals 9-12, Finals 13-17 (+18, the open
     * edge). The seed carried a one-stage drift until this ruling, and because
     * the examination blueprints scope by `by_act` that drift meant every paper
     * sampled a chapter from beyond its own grading period. This is the
     * assertion that would catch it coming back.
     */
    await signIn(page, "progressing");
    await openStageList(page);

    const heads = await page.locator(".act-head").allInnerTexts();
    expect(heads[0], "Prelim covers chapters 1-4, after orientation").toMatch(/Stages 00–04/);
    expect(heads[1], "Midterm covers chapters 5-8").toMatch(/Stages 05–08/);
    expect(heads[2], "Semi-finals covers chapters 9-12").toMatch(/Stages 09–12/);
    expect(heads[3], "Finals covers 13-17, plus chapter 18").toMatch(/Stages 13–18/);
  });
});

test.describe("R3 gate — the flat map's text key", () => {
  test("names every ring and every moon, whatever Stage 11 says", async ({ page }) => {
    /*
     * `DESIGN-MANDATE-V2.md` §5's solar-system gate, verbatim:
     *
     *   > The flat map names every ring, planet, and moon in text, INDEPENDENT
     *   > of whether Stage 11 has been reached [...] the withholding is allowed
     *   > to be cosmetic, it is not allowed to be an accessibility gap.
     *
     * It WAS a gap. A screen-reader user on this route got 19 stage buttons and
     * nothing else: rings unnamed, and the moons not mentioned at all, because
     * both lived only inside an aria-hidden SVG.
     */
    await signIn(page, "fresh"); // Stage 11 nowhere near reached
    await page.goto("/app/map", { waitUntil: "domcontentloaded" });
    await page.locator(".galaxy-svg").waitFor();

    const key = page.locator('[aria-label="Map key"]');
    await expect(key).toBeAttached();
    const text = await key.innerText();

    // All seven rings, named, for a student ten weeks from the reveal.
    for (const name of [
      "Digital Logic",
      "Control",
      "Machine / ISA",
      "System Software",
      "Assembly Language",
      "High-Level Language",
      "User",
    ]) {
      expect(text, `ring "${name}" must be named in text`).toContain(name);
    }

    // Every stage's moons, by their real authored descriptions -- not a count.
    expect(text, "each stage's subtopics are listed").toContain("Differentiate DRAM and SRAM");
    expect(
      (text.match(/moons?:/g) ?? []).length,
      "every one of the 19 stages carries its moon list",
    ).toBe(19);

    // An empty orbit is stated rather than omitted: the L4/L5 gap is a fact
    // about the syllabus, and silence would read as a rendering failure.
    expect(text, "an empty orbit says so").toMatch(/No stages sit on this orbit/);
  });

  test("but the picture still withholds the ring names — the reveal survives", async ({ page }) => {
    /*
     * The other half, and the reason this is `sr-only` rather than visible.
     * Stage 11 names the rings for a sighted user watching the map; printing
     * them on screen in week one would spend that reveal on the very person it
     * is for. Giving them to assistive tech costs the reveal nothing.
     */
    await signIn(page, "fresh");
    await page.goto("/app/map", { waitUntil: "domcontentloaded" });
    await page.locator(".galaxy-svg").waitFor();

    expect(
      await page.locator(".galaxy-ring-label").count(),
      "the drawing must not name rings before Stage 11",
    ).toBe(0);

    // And the key is genuinely off-screen rather than merely small.
    const box = await page.locator('[aria-label="Map key"]').boundingBox();
    expect(box === null || box.height <= 2, "the key must not be visible").toBe(true);
  });
});

test.describe("the first-run explanation, and getting it back", () => {
  test("shows once, says it is a placeholder, and stays gone once dismissed", async ({ page }) => {
    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    const panel = page.locator(".first-run");
    await expect(panel).toBeVisible();

    /*
     * `DESIGN-MANDATE.md` §2: a 30-second first-run, "never a tour, never a
     * modal carousel". So it must NOT be a dialog and must not trap focus —
     * asserted here because "make it a modal" is the change that would feel
     * natural to anyone touching this later.
     */
    await expect(panel).toHaveAttribute("role", "note");
    expect(await panel.getAttribute("aria-modal")).toBeNull();

    // The copy is scaffolding and says so on screen, not only in a comment.
    // Hard rule 5 — this text was written by nobody who teaches the course.
    await expect(panel.locator(".first-run-placeholder")).toContainText(/not real course content/i);

    // Leaving is available on the first frame, before reading anything.
    await panel.locator(".first-run-skip").click();
    await expect(panel).toBeHidden();

    await page.reload({ waitUntil: "networkidle" });
    await settle(page);
    await expect(page.locator(".first-run")).toBeHidden();
  });

  test("the ? button replays it, from the beginning, without un-dismissing it", async ({ page }) => {
    await signIn(page);
    await page.addInitScript(() => window.localStorage.setItem("octa:first-run-map", "1"));
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    await expect(page.locator(".first-run")).toBeHidden();

    /*
     * This is what makes "Skip" honest. Without a way back, a student who does
     * not want the tutorial now has to read it anyway, because leaving costs
     * them the explanation permanently.
     */
    const replay = page.locator(".first-run-replay");
    await expect(replay).toBeVisible();

    // A `?` is a glyph, not a name. The accessible name has to be a sentence.
    await expect(replay).toHaveAttribute("aria-label", /again/i);

    // It is the smallest control on the map and gets reached for on a phone.
    const box = await replay.boundingBox();
    expect(Math.min(box!.width, box!.height), "44px touch target").toBeGreaterThanOrEqual(44);

    await replay.click();
    const panel = page.locator(".first-run");
    await expect(panel).toBeVisible();
    // From step one, never wherever the student happened to stop.
    await expect(panel.locator(".first-run-step")).toContainText("1 /");

    // Dismissing returns the button rather than nothing.
    await panel.locator(".first-run-skip").click();
    await expect(replay).toBeVisible();

    // Replaying is "show me once more", not "greet me again next visit".
    await page.reload({ waitUntil: "networkidle" });
    await settle(page);
    await expect(page.locator(".first-run")).toBeHidden();
    await expect(page.locator(".first-run-replay")).toBeVisible();
  });
});
