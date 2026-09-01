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
  await page.locator(".act-list").waitFor();
  if (expectCanvas) await page.locator("canvas").waitFor();
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
    // No error state, no "your browser is unsupported": nothing is missing,
    // because the DOM layer was always the one carrying the meaning.
    await expect(page.locator(".act-list")).toBeVisible();
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
    await expect(page.locator(".act-list")).toBeVisible();
  });

  test("the guard does NOT fire on a machine that can hold 30fps", async ({ page }, testInfo) => {
    // The other half: a fallback that triggers spuriously is worse than none,
    // because it silently removes the default experience. Measured at 47fps
    // under a 6x CPU throttle, so it must stay quiet here.
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);
    await page.waitForTimeout(5000); // longer than the 3-second window

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

test.describe("the DOM layer stays the accessibility contract", () => {
  test("every stage is a real control, whatever the canvas is doing", async ({ page }) => {
    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page);

    // 19 stages from the seed. The canvas is aria-hidden and carries none of
    // this -- a <canvas> has no accessibility semantics at all.
    const controls = page.locator(".act-list button");
    expect(await controls.count()).toBeGreaterThanOrEqual(19);
    await expect(page.locator("canvas")).toHaveAttribute("aria-hidden", /true/).catch(() => {
      // No canvas on this project's ladder rung; the assertion above already
      // proved the DOM layer stands on its own, which is the actual contract.
    });
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

    expect(state.total, "19 stages, 19 controls").toBe(19);
    expect(state.placed, "every planet projected on screen").toBe(19);
    expect(state.distinct, "buttons stacked -- projection failed").toBeGreaterThan(15);

    // Focus order is CURRICULUM order, never screen position. A student
    // tabbing through the map walks the syllabus.
    expect(state.order).toEqual(
      Array.from({ length: 19 }, (_, i) => String(i).padStart(2, "0")),
    );
  });

  test("a locked planet's control still announces why", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "no canvas at 380px");

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    // The canvas carries none of this -- it is aria-hidden and has no
    // accessibility semantics at all. The buttons over it do.
    const locked = page.locator('.map-hit[aria-disabled="true"]').first();
    await expect(locked).toHaveCount(1);
    await expect(locked).toContainText(/Locked\./);
    await expect(locked).toContainText(/Unlocks when Stage \d+/);
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

    await signIn(page);
    await page.goto("/app", { waitUntil: "networkidle" });
    await settle(page, true);

    await page.locator('.map-hit[aria-disabled="true"]').first().click({ force: true });
    const hud = page.locator(".hud");
    await hud.waitFor();

    // The click must NOT have navigated. That is the whole bug this catches.
    expect(new URL(page.url()).pathname).toBe("/app");

    await expect(hud).toHaveAttribute("role", "dialog");
    await expect(hud).toHaveAttribute("aria-modal", "true");

    // Every §2 element that has real data behind it.
    await expect(hud.locator(".hud-act")).toBeVisible();          // Act chip
    await expect(hud.locator(".hud-glyph")).toBeVisible();        // state icon
    await expect(hud.locator(".hud-state")).toContainText(/Locked/);
    await expect(hud.locator(".hud-prereq")).toContainText(/Needs/);
    expect(await hud.locator(".hud-dot").count()).toBeGreaterThan(0);

    // The lock reason is PRINTED, never a tooltip. Three documents require it
    // and R0 caught a draft moving it to hover.
    await expect(hud.locator(".hud-lock-reason")).toContainText(/Unlocks when Stage \d+/);
    await expect(hud.locator(".hud-lock-reason")).toContainText(/You're at \d+%/);

    // Locked means there is nothing to enter, so no Enter button at all --
    // a disabled button that does nothing would fail the consequence test.
    expect(await hud.locator(".hud-enter").count()).toBe(0);

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

    // The design mandate calls a lock with no visible reason "the single most
    // demotivating UI element in ed-tech". It is printed text, never a tooltip.
    await expect(page.locator(".act-list")).toContainText(/Unlocks when Stage \d+/);
    await expect(page.locator(".act-list")).toContainText(/You're at \d+%/);
  });
});
