import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * R3.0's opening move: capture every BUILT route, at both widths, before
 * judging any of them.
 *
 * `DESIGN-REVIEW-01` established why this comes first — 291 tests, a type
 * checker, a palette scanner and a contrast gate were all green while the
 * console rendered 96-pixel text inputs, because nobody had loaded the page.
 * A design pass that starts from opinions instead of captures repeats that.
 *
 * Route lists come from `R3-page-templates-and-redesign.md` §R3.1–R3.3, which
 * were themselves verified against `App.tsx` rather than copied from
 * `PAGE-SPECS.md`'s aspirational list. Anything absent from here is in §R3.6's
 * backlog, not forgotten.
 *
 * FIXTURE DATA ONLY. The console pages show names, and every one of them comes
 * from `db/demo-seed.sql`. Nothing here may run against a real class — see
 * `docs/redesign/FOLDER-STRUCTURE.md` on what may live under `design/`.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function token(sub: string, role: "student" | "teacher", studentId?: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub,
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = token("dddddddd-1111-4000-8000-000000000006", "student", "232129006");
const STAFF = token("dddddddd-0000-4000-8000-000000000001", "teacher");

/** Built student + public routes (§R3.1, §R3.2). */
const WEB_ROUTES: Array<[string, string]> = [
  ["/app", "app-solar-system"],
  ["/app/map", "app-flat-map"],
  ["/app/stage/00", "app-stage-reader"],
  ["/app/progress", "app-progress"],
  ["/app/settings", "app-settings"],
  ["/app/work", "app-work"],
  ["/login", "public-login"],
  ["/register", "public-register"],
  ["/maintenance", "public-maintenance"],
  ["/nope", "public-404"],
];

/** Built console routes (§R3.3). Paths have no /console prefix — own origin. */
const CONSOLE_ROUTES: Array<[string, string]> = [
  ["/locks", "console-locks"],
  ["/students", "console-roster"],
  ["/items", "console-items"],
  ["/assessments", "console-assessments"],
  ["/content", "console-content"],
  ["/gradebook", "console-gradebook"],
  ["/submissions", "console-submissions"],
  ["/audit", "console-audit"],
  ["/feedback", "console-feedback"],
  ["/live", "console-live"],
  ["/system", "console-system"],
];

async function shoot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const file = testInfo.outputPath(`${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test.describe("R3 inventory — every built route, both widths", () => {
  for (const [route, name] of WEB_ROUTES) {
    test(`web ${route}`, async ({ page }, testInfo) => {
      await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STUDENT);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator("main, .boot, body").first().waitFor();
      await page.waitForTimeout(900); // lazy chunks + canvas mount

      await shoot(page, name, testInfo);

      // A page that throws is a finding regardless of how it looks, and this
      // is the cheapest place to catch it across every route at once.
      expect(errors, `${route} threw: ${errors.join(" | ")}`).toEqual([]);

      // 380px with no sideways scroll is in the definition of done, so it is
      // asserted on every route rather than spot-checked on one.
      if (testInfo.project.name === "mobile-380") {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} scrolls sideways at 380px`).toBeLessThanOrEqual(0);
      }
    });
  }

  for (const [route, name] of CONSOLE_ROUTES) {
    test(`console ${route}`, async ({ page }, testInfo) => {
      await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

      /*
       * `domcontentloaded`, not `networkidle`.
       *
       * `/live` is Lecture Mode and holds an open request to
       * `/api/v1/console/live` for as long as it is on screen, so networkidle
       * never fires there — the page renders perfectly and the wait times out.
       * That is the live connection working, not a hang, and the fix belongs in
       * the harness rather than the page.
       */
      await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "domcontentloaded" });
      await page.locator("main, body").first().waitFor();
      await page.waitForTimeout(900);

      await shoot(page, name, testInfo);
      expect(errors, `${route} threw: ${errors.join(" | ")}`).toEqual([]);

      if (testInfo.project.name === "mobile-380") {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} scrolls sideways at 380px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
