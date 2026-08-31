import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * R0.3 -- the "before" capture. The map as it actually stands, at both widths
 * and in both motion states, taken before any solar-system code exists so R1
 * has something honest to diff against.
 *
 * This proves the pipeline works end to end. It is deliberately NOT a
 * `toHaveScreenshot` assertion: a committed baseline now would lock in the
 * galaxy, and R1 replaces it on purpose. These are captures, not gates. What
 * IS asserted is structure -- that a map rendered, that every stage is a real
 * control -- which is what makes a green run mean anything.
 *
 * BOTH MOTION STATES, on purpose. An earlier draft of this file forced
 * reduced-motion globally for stable pixels, which quietly made every capture a
 * reduced-motion capture -- hiding the "View in 3D" control, which only renders
 * when motion is allowed. `DESIGN-MANDATE-V2.md` §5 requires the frozen state
 * to be as legible as the moving one, "verified by actually toggling the OS
 * setting, not assumed", so both are captured and neither is the default.
 *
 * Auth: with no VITE_SUPABASE_URL set, both apps read a JWT from localStorage
 * under `octa:dev-token` (DESIGN-REVIEW-01.md, "How to reproduce this setup").
 * Minted here with the same HS256 secret the local API boots with. The student
 * comes from db/demo-seed.sql -- fixture data by construction, so no real name
 * can reach design/.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

/** First student in db/demo-seed.sql. Fixture, not a real person. */
const DEMO_STUDENT = {
  sub: "dddddddd-1111-4000-8000-000000000001",
  studentId: "232129001",
};

function mintDevToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: DEMO_STUDENT.sub,
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: DEMO_STUDENT.studentId },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function signIn(page: Page): Promise<void> {
  // The token has to exist before the app's first render, not after it.
  await page.addInitScript(
    ([token]) => window.localStorage.setItem("octa:dev-token", token as string),
    [mintDevToken()],
  );
}

async function capture(page: Page, name: string, testInfo: import("@playwright/test").TestInfo) {
  const file = testInfo.outputPath(`${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

for (const motion of ["no-preference", "reduce"] as const) {
  test.describe(`motion: ${motion}`, () => {
    /*
     * `page.emulateMedia`, NOT `test.use({ reducedMotion })`.
     *
     * The `test.use` form was tried first and silently did nothing here: a
     * one-off diagnostic spec that only read
     * `matchMedia("(prefers-reduced-motion: reduce)")` reported `false` under
     * BOTH declared values, so the whole "reduce" half of this matrix was
     * running unreduced and reporting green. A capture matrix that quietly
     * tests one state twice is worse than one that tests a single state
     * honestly, because it reads as coverage. Verified working via the
     * assertion in the hub test below, which now fails if emulation is lost.
     */
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
    });

    /**
     * `/app/map` is the accessibility contract and the surface that must
     * survive every redesign, so it is asserted hardest.
     */
    test("flat map renders every stage as a real control", async ({ page }, testInfo) => {
      await signIn(page);
      await page.goto("/app/map", { waitUntil: "networkidle" });

      // 19 stages from the seed, each a real focusable control. If the map ever
      // invents or forgets one, INV-32 has regressed and it should fail loudly
      // here rather than be noticed in a screenshot months later.
      const stageControls = page.locator(".act-item button, .map-hit button, button.node-hit");
      await expect(stageControls.first()).toBeVisible();
      expect(await stageControls.count()).toBeGreaterThanOrEqual(19);

      await capture(page, "app-map", testInfo);
    });

    /**
     * `/app` is the map's hub route, and after R1 it is the solar system.
     * What this records for R1 to diff against: which path it lands on, and
     * whether a WebGL canvas exists at all.
     */
    test("hub records its landing path and canvas presence", async ({ page }, testInfo) => {
      await signIn(page);
      await page.goto("/app", { waitUntil: "networkidle" });
      await page.waitForTimeout(500); // let any redirect settle

      // Guard the guard: if media emulation ever stops applying, this matrix
      // becomes two identical runs wearing different names. Fail instead.
      expect(
        await page.evaluate(
          () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(motion === "reduce");

      const landed = new URL(page.url()).pathname;
      const canvases = await page.locator("canvas").count();
      // Target the control itself, not anything whose label mentions the flat
      // map -- a name-based role query also matches the "Show the flat map"
      // link at the foot of the page, which made an earlier version of this
      // report 1 under reduced motion where the toggle is correctly absent.
      const toggle = await page.locator("button.mode-toggle").count();

      await capture(page, "app-hub", testInfo);

      // Recorded, not asserted. R0's job is to capture current behaviour
      // truthfully; R1 turns these into hard assertions once the solar system's
      // own redirect and default rules are settled. See docs/PROGRESS.md,
      // finding F-5 -- what the code does here and what four documents say it
      // does are not the same thing, and that is a ruling, not a bug fix.
      testInfo.annotations.push(
        { type: "landed-on", description: landed },
        { type: "canvas-count", description: String(canvases) },
        { type: "mode-toggle-present", description: String(toggle) },
      );
      console.log(
        `[${testInfo.project.name} · ${motion}] /app -> ${landed}  canvas=${canvases}  toggle=${toggle}`,
      );
    });
  });
}
