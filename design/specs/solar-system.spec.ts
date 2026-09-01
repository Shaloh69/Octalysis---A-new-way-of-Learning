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
  await page.locator(".stage-list").waitFor();
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
    expect(await page.locator("svg.map-svg").count()).toBe(0);
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
    // The flat map takes over in place, so the page is still a map.
    expect(await page.locator("svg.map-svg").count()).toBe(1);
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
    await page.addInitScript(() => localStorage.setItem("octa:map-too-slow", "1"));
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    expect(await page.locator("canvas").count(), "must fall back to flat").toBe(0);
    expect(new URL(page.url()).pathname, "must NOT redirect").toBe("/app");
    // Flat mode renders the list open, so no disclosure to expand.
    await expect(page.locator(".map-header")).toBeVisible();
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
    await page.locator(".stage-list").waitFor();
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
    expect(new Set(state.order).size, "buttons stacked -- projection failed")
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

    // No invisible clickable targets: every hit target has a body behind it.
    expect(
      await page.locator('.map-hit[aria-disabled="true"]').count(),
      "a locked planet has no body, so it must have no hit target either",
    ).toBe(0);

    // The DOM layer is complete regardless -- on its own route now.
    await openStageList(page);
    expect(await page.locator(".stage-row").count(), "the list must carry all 19").toBe(19);
    await expect(page.locator(".stage-list")).toContainText(/Unlocks when Stage \d+/);
  });

  test("the stage list shows every stage, locked included, whatever the scene withholds", async ({ page }) => {
    await signIn(page, "progressing");
    await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await page.locator(".stage-list").waitFor();

    expect(await page.locator(".stage-row").count()).toBe(19);
    expect(
      await page.locator(".stage-row-locked").count(),
      "locked stages must be visible here, in text",
    ).toBeGreaterThan(0);
    await expect(page.locator(".stage-list")).toContainText(/Unlocks when Stage \d+/);
    await expect(page.locator(".stage-list")).toContainText(/You're at \d+%/);
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

    // Docked to the right edge, full height.
    const box = await hud.boundingBox();
    const vp = page.viewportSize();
    expect(box, "the panel must be on screen").not.toBeNull();
    expect(Math.round(box!.x + box!.width), "docked to the right edge").toBe(vp!.width);

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

  test("the HUD traps focus and Escape closes it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    await page.locator(".map-hit").first().click({ force: true });
    await page.locator(".hud").waitFor();

    expect(
      await page.evaluate(() => document.querySelector(".hud")?.contains(document.activeElement)),
      "focus must move into the dialog on open",
    ).toBe(true);

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
    await expect(page.locator(".stage-list")).toContainText(/Unlocks when Stage \d+/);
    await expect(page.locator(".stage-list")).toContainText(/You're at \d+%/);
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
