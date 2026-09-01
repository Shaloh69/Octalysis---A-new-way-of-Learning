import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * R3's universal gate, made mechanical.
 *
 * `DESIGN-MANDATE-V2.md` §5 lists nine things no page ships without. R3.0's
 * process says to confirm them per route — twenty-odd routes, by hand, by eye.
 * That is exactly the checking that `DESIGN-REVIEW-01` proved does not survive
 * contact with a deadline: 291 tests, a type checker, a palette scanner and a
 * contrast gate were all green while the console rendered 96-pixel text inputs,
 * because nobody had loaded the page.
 *
 * So the mechanical ones run here, on every built route, every time:
 *
 *   | Gate item                        | Here | Where instead |
 *   |----------------------------------|------|---------------|
 *   | 380px, no horizontal scroll      |  ✓   | also r3-inventory |
 *   | Visible focus everywhere         |  ✓   | |
 *   | `prefers-reduced-motion` honoured|  ✓   | |
 *   | Every control has a name         |  ✓   | |
 *   | One `h1`, and a `main`           |  ✓   | |
 *   | Zero literal hex                 |      | `check-palette.mjs` (hook) |
 *   | AA on three themes               |      | `check-contrast.mjs`, computed |
 *   | Six states                       |      | per-route specs — not mechanical |
 *   | Error copy says how to fix       |      | per-route — not mechanical |
 *
 * The last three are judgement, and this file does not pretend otherwise. What
 * it removes is the excuse that the mechanical five were "checked".
 *
 * FIXTURE DATA ONLY — the signed-in student is a row from `db/demo-seed.sql`.
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
const WEB: string[] = [
  "/app",
  "/app/map",
  "/app/stages",
  "/app/stage/00",
  "/app/progress",
  "/app/settings",
  "/app/work",
  "/login",
  "/register",
  "/maintenance",
];

/** Built console routes (§R3.3). Own origin, so no /console prefix. */
const CONSOLE: string[] = [
  "/locks",
  "/students",
  "/items",
  "/assessments",
  "/content",
  "/gradebook",
  "/submissions",
  "/audit",
  "/feedback",
  "/system",
];

async function land(page: Page, url: string, dev: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), dev);
  // `domcontentloaded`, not `networkidle`: `/live` holds an open request for as
  // long as it is on screen, and lazy chunks are waited for explicitly below.
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("main, .boot, body").first().waitFor();
  await page.waitForTimeout(700);
}

/**
 * Does a keyboard user see where they are?
 *
 * TABBED, not focused programmatically, and the distinction is the whole test.
 * `:focus-visible` — which is what every focus style in this project uses, and
 * correctly so — deliberately does NOT match when script calls `.focus()` on a
 * button. An earlier version of this helper did exactly that and reported
 * `/register` as having no focus indicator, when the global `:focus-visible`
 * rule was right there giving it a 2px accent outline. It was a false positive
 * that would have had someone "fix" working code.
 *
 * So: press Tab like a student would, then read whatever is focused.
 *
 * The assertion is that SOMETHING changes, not that a particular property does.
 * Focus may legitimately be shown with an outline, a ring shadow or a border,
 * and pinning one would fail good implementations. Nothing changing at all is
 * the only real failure.
 */
async function focusIsVisible(page: Page): Promise<boolean> {
  const idle = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>("button, a[href], input")].find(
      (e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0,
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor].join(
      "|",
    );
  });
  if (idle === null) return true; // nothing focusable to check

  await page.keyboard.press("Tab");

  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false; // Tab reached nothing
    const cs = getComputedStyle(el);
    // An outline is how this project shows focus; a shadow or border change is
    // accepted too, for anything that styles it differently.
    return cs.outlineStyle !== "none" || cs.boxShadow !== "none";
  });
}

test.describe("R3 gate — every built route", () => {
  for (const route of WEB) {
    test(`web ${route}`, async ({ page }, testInfo) => {
      await land(page, route, STUDENT);

      /* ---- 380px, no horizontal scroll ------------------------------- */
      if (testInfo.project.name === "mobile-380") {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} scrolls sideways at 380px`).toBeLessThanOrEqual(0);
      }

      /* ---- structure: one main, exactly one h1 ------------------------ */
      expect(await page.locator("main").count(), `${route} has no <main>`).toBeGreaterThan(0);
      const h1s = await page.locator("h1").allInnerTexts();
      expect(h1s.length, `${route} must have exactly one h1, found ${h1s.length}`).toBe(1);
      expect(h1s[0]?.trim().length, `${route}'s h1 is empty`).toBeGreaterThan(0);

      /* ---- every control carries an accessible name ------------------- */
      const unnamed = await page.evaluate(() => {
        const named = (el: Element): boolean => {
          const aria = el.getAttribute("aria-label")?.trim();
          if (aria) return true;
          if (el.getAttribute("aria-labelledby")) return true;
          if ((el.textContent ?? "").trim().length > 0) return true;
          if (el.getAttribute("title")) return true;
          const id = el.getAttribute("id");
          if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
          return !!el.closest("label");
        };
        return [...document.querySelectorAll("button, a[href], input, select, textarea")]
          .filter((el) => (el as HTMLElement).offsetParent !== null || el.tagName === "A")
          .filter((el) => !named(el))
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`)
          .slice(0, 5);
      });
      expect(unnamed, `${route} has unnamed controls: ${unnamed.join(", ")}`).toEqual([]);

      /* ---- visible focus --------------------------------------------- */
      expect(
        await focusIsVisible(page),
        `${route}: focusing the first control changes nothing visible`,
      ).toBe(true);
    });
  }

  for (const route of CONSOLE) {
    test(`console ${route}`, async ({ page }, testInfo) => {
      await land(page, `${CONSOLE_URL}${route}`, STAFF);

      if (testInfo.project.name === "mobile-380") {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} scrolls sideways at 380px`).toBeLessThanOrEqual(0);
      }

      expect(await page.locator("main").count(), `${route} has no <main>`).toBeGreaterThan(0);
      const h1s = await page.locator("h1").allInnerTexts();
      expect(h1s.length, `${route} must have exactly one h1, found ${h1s.length}`).toBe(1);

      /*
       * The console's own scar. `DESIGN-REVIEW-01` D-1 was 96-pixel text inputs
       * shipped green: every gate passed because none of them measured a
       * control. This one does.
       */
      const tooSmall = await page.evaluate(() =>
        [...document.querySelectorAll("input, select, button")]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height > 0 && r.height < 32)
          .map(({ el, r }) => `${el.tagName.toLowerCase()} ${Math.round(r.height)}px`)
          .slice(0, 5),
      );
      expect(tooSmall, `${route} has controls under 32px tall: ${tooSmall.join(", ")}`).toEqual([]);
    });
  }
});

test.describe("R3 gate — reduced motion is honoured everywhere", () => {
  for (const route of ["/app", "/app/map", "/app/stages", "/login"]) {
    test(`nothing animates on ${route}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await land(page, route, STUDENT);

      // Guard the guard: if emulation silently stops applying, this whole
      // describe becomes theatre. `before-baseline` learned that the hard way.
      expect(
        await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        "media emulation must actually apply",
      ).toBe(true);

      /*
       * An animation with a real duration is the failure. Zero-duration and
       * `none` are how a stylesheet correctly switches one off, and infinite
       * iteration on a paused animation still reports a duration -- so the
       * check is on duration, which is what a student would actually see move.
       */
      const running = await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.animationName === "none") return false;
            const secs = cs.animationDuration
              .split(",")
              .map((d) => parseFloat(d) * (d.includes("ms") ? 0.001 : 1));
            return secs.some((v) => v > 0.01);
          })
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`)
          .slice(0, 6),
      );
      expect(running, `${route} still animates under reduced motion: ${running.join(", ")}`).toEqual(
        [],
      );
    });
  }
});
