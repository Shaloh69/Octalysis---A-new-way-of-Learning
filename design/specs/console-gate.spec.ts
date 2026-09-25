import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * `/signin` — the console gate. **Nothing past it renders without a staff
 * account.**
 *
 * ## Why most of this file talks to the API and not the page
 *
 * `AppShell`'s guard says so itself: *"It decides what to RENDER, and nothing
 * more."* A redirect is presentation. A student who deletes that component from
 * the bundle in devtools still must get nothing, and the only things that make
 * that true are `requireStaff()` on every console route and RLS beneath it.
 *
 * Hard rule 8: test authorization by testing denial. So the client half is
 * checked because a teacher deserves a sensible screen, and the SERVER half is
 * checked because that is the part that is actually security. If only one of
 * these could exist it would be the server one.
 *
 * ## The three identities
 *
 * - **nobody** — no token at all
 * - **a student** — a VALID token, correctly signed, for a real account. This
 *   is the interesting one: authenticated is not authorised, and a bug that
 *   confuses the two lets every student read the gradebook.
 * - **a teacher** — the control. Without it, every denial below could pass for
 *   the boring reason that the endpoint is broken for everyone.
 *
 * FIXTURE DATA ONLY: student `232129006` and teacher
 * `dddddddd-0000-4000-8000-000000000001`, both from `db/demo-seed.sql`.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const API_URL = process.env.OCTA_API_URL ?? "http://localhost:8090";

function token(sub: string, role: "student" | "teacher", studentId?: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub,
    email: `${studentId ?? role}@example.com`,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = token("dddddddd-1111-4000-8000-000000000006", "student", "232129006");
const TEACHER = token("dddddddd-0000-4000-8000-000000000001", "teacher");

/** Every console route behind the shell. `/signin` is deliberately not here. */
const GUARDED = [
  "/locks",
  "/live",
  "/students",
  "/gradebook",
  "/assessments",
  "/items",
  "/submissions",
  "/content",
  "/audit",
  "/system",
  "/feedback",
];

/** Console API endpoints that must refuse a non-staff caller. */
const STAFF_ENDPOINTS = [
  "/api/v1/console/roster",
  "/api/v1/console/locks",
  "/api/v1/console/content",
  "/api/v1/console/audit",
  "/api/v1/console/audit/system",
];

async function asConsole(page: Page, tok: string | null): Promise<void> {
  await page.addInitScript((t) => {
    if (t === null) localStorage.removeItem("octa:dev-token");
    else localStorage.setItem("octa:dev-token", t as string);
  }, tok);
}

test.describe("the console gate — the server half", () => {
  /*
   * These do not open a page at all. They are the boundary itself.
   */
  test("a STUDENT token is refused by every console endpoint", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "not a viewport concern");

    for (const path of STAFF_ENDPOINTS) {
      const res = await request.get(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${STUDENT}` },
      });
      expect(
        res.status(),
        `${path} served a student — authenticated was mistaken for authorised`,
      ).toBeGreaterThanOrEqual(400);
      expect(res.status(), `${path} should refuse, not fail`).toBeLessThan(500);

      // And it must not leak the data it refused to serve.
      const body = await res.text();
      expect(body.length, `${path} returned a large body with a ${res.status()}`).toBeLessThan(2000);
    }
  });

  test("no token at all is refused too", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "not a viewport concern");

    for (const path of STAFF_ENDPOINTS) {
      const res = await request.get(`${API_URL}${path}`);
      expect(res.status(), `${path} served an anonymous caller`).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    }
  });

  test("CONTROL: a teacher token is served, so the denials above mean something", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "not a viewport concern");

    /*
     * Without this, every assertion above would pass just as happily if the
     * console API were broken for everybody — which is the classic way a
     * denial suite becomes decorative.
     */
    let served = 0;
    for (const path of STAFF_ENDPOINTS) {
      const res = await request.get(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${TEACHER}` },
      });
      if (res.ok()) served += 1;
    }
    expect(
      served,
      "no console endpoint served a TEACHER either — the denials above prove nothing",
    ).toBeGreaterThan(0);
  });
});

test.describe("the console gate — the screen a person sees", () => {
  test("nobody signed in: every guarded route lands on /signin", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await asConsole(page, null);
    for (const route of GUARDED) {
      await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "domcontentloaded" });
      await expect(
        page,
        `${route} did not send an anonymous visitor to the gate`,
      ).toHaveURL(/\/signin/, { timeout: 10_000 });
    }
  });

  test("signed in as a student: told why, and given both ways out", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * A different situation from "not signed in" and deliberately a different
     * screen: there is nothing to retry here. What helps is the app they
     * actually wanted, and a way OUT of the session so a teacher sharing the
     * machine can sign in.
     */
    await asConsole(page, STUDENT);
    await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: /teacher console/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("body")).toContainText(/student account/i);

    // Both exits, not one.
    await expect(page.getByRole("link", { name: /student app/i })).toBeVisible();
    expect(
      // "Sign in as someone else" -- matched by intent, not by the exact
      // wording, because the copy is allowed to change and the exit is not.
      await page
        .getByRole("button", { name: /sign (out|in as)|switch|someone else|another account/i })
        .count(),
      "a shared machine needs a way OUT, not just a way onward",
    ).toBeGreaterThan(0);

    // And none of the page it was guarding.
    const text = await page.locator("body").innerText();
    expect(text, "the locks matrix rendered for a student").not.toMatch(/lock matrix|unlock all/i);
  });

  test("/signin is reachable, has one h1, and works at 380px", async ({ page }, testInfo: TestInfo) => {
    await asConsole(page, null);
    await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "networkidle" });

    expect(await page.locator("h1").count(), "the gate needs exactly one h1").toBe(1);
    expect(
      await page.locator('input[type="email"], input[type="password"], input[type="text"]').count(),
      "a sign-in page with no field is a dead end",
    ).toBeGreaterThan(0);

    if (testInfo.project.name === "mobile-380") {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "the sign-in page scrolls sideways at 380px").toBeLessThanOrEqual(1);
    }
  });
});

/* ======================================================================
 * THE SIX-ASSERTION GATE — `CONSOLE-REVAMP.md` §2, at 1440 AND 380.
 *
 * Two screens are measured here, because both are the gate:
 *
 *   - `/signin` itself, fresh AND with a failed attempt on it. The failure
 *     state is the one a teacher is most likely to be staring at, and the one
 *     a template never shows.
 *   - the student-account screen ("This is the teacher console"), which
 *     `AppShell` renders at whatever guarded URL was asked for.
 *
 * The credential-change screen is the third, and is gated in
 * `console-bootstrap-credentials.spec.ts` beside the tests that own it.
 *
 * LOCALLY THERE IS NO SUPABASE AUTH. The console is built without
 * `VITE_SUPABASE_URL`, so every submit takes the "built without its Supabase
 * settings" branch. That is still a real failure through the real code path,
 * and it is the one this spec can drive; the three credential-failure
 * sentences are unit-tested in `apps/console/test/console.spec.ts`
 * (`signInFailureMessage`), where no network is needed to reach them.
 * ==================================================================== */

async function openSignIn(page: Page): Promise<void> {
  await asConsole(page, null);
  await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
}

/** A failed sign-in, left on screen. */
async function failSignIn(page: Page): Promise<void> {
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("alert").filter({ hasText: /\S/ }).first().waitFor({ timeout: 10_000 });
}

async function openStudentScreen(page: Page): Promise<void> {
  await asConsole(page, STUDENT);
  await page.goto(`${CONSOLE_URL}/locks`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /teacher console/i }).waitFor({ timeout: 15_000 });
}

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped — sign-in, its failure, the student screen", async ({ page }) => {
    await openSignIn(page);
    expect(await clippedElements(page), "sign-in").toEqual([]);
    await failSignIn(page);
    expect(await clippedElements(page), "sign-in, failed").toEqual([]);
    await openStudentScreen(page);
    expect(await clippedElements(page), "student screen").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openSignIn(page);
    expect(await horizontalOverflow(page), "sign-in").toBeLessThanOrEqual(0);
    await failSignIn(page);
    expect(await horizontalOverflow(page), "sign-in, failed").toBeLessThanOrEqual(0);
    await openStudentScreen(page);
    expect(await horizontalOverflow(page), "student screen").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openSignIn(page);
    expect(await unreachableByKeyboard(page, "main"), "sign-in").toEqual([]);

    /*
     * And the whole sign-in can be DONE from the keyboard: type, Tab, type,
     * Enter, and the failure arrives without a mouse ever moving. Tab from the
     * email field lands on the password -- the show-password toggle comes
     * AFTER its field, never between the two.
     */
    await page.getByLabel("Email").focus();
    await page.keyboard.type("nobody@example.com");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.keyboard.type("not-the-password");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();

    await openStudentScreen(page);
    expect(await unreachableByKeyboard(page, "main"), "student screen").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(90_000);
    const failures: string[] = [];
    await openSignIn(page);
    await failSignIn(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} sign-in: ${f}`));
    }
    await openStudentScreen(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} student: ${f}`));
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    await openSignIn(page);
    await failSignIn(page);
    expect(await offTokenStyles(page), "sign-in, failed").toEqual([]);
    await openStudentScreen(page);
    expect(await offTokenStyles(page), "student screen").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST: with motion allowed, the POST readout must
     * visibly count up (DESIGN-REFERENCES.md §7.1). Without this the test
     * passes on a page with no motion at all.
     */
    await recordMotion(page);
    await openSignIn(page);
    await page.waitForTimeout(1_200); // the whole sequence is under a second
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the POST readout should count up").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSignIn(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await failSignIn(page);
    await page.waitForTimeout(600);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);

    // Skipped, not shortened: every readout line is there on the first frame.
    const waiting = await page.evaluate(
      () =>
        [...document.querySelectorAll("main dl > div")].filter((d) => getComputedStyle(d).opacity !== "1")
          .length,
    );
    expect(waiting, "a readout line was still waiting to appear under reduced motion").toBe(0);
  });
});

/* ======================================================================
 * THE TEMPLATE'S STRUCTURE, and the failure state it does not have.
 * `design/templates/console/signin/SPEC.md`.
 * ==================================================================== */

test.describe("the sign-in — SPEC.md", () => {
  test("split at 1440, one column at 380 with the form first", async ({ page }, testInfo) => {
    await openSignIn(page);
    const form = await page.locator("main form").boundingBox();
    const readout = await page.locator("main dl").first().boundingBox();
    expect(form && readout, "the form and the POST readout both render").toBeTruthy();
    if (testInfo.project.name === "desktop-1440") {
      expect(readout!.x, "at 1440 the readout sits in the right half").toBeGreaterThanOrEqual(720);
      expect(form!.x + form!.width, "at 1440 the form stays in the left half").toBeLessThanOrEqual(720);
    } else {
      expect(readout!.y, "at 380 the form comes first and the readout below it").toBeGreaterThan(
        form!.y + form!.height,
      );
      const vh = page.viewportSize()!.height;
      const button = await page.getByRole("button", { name: /^sign in$/i }).boundingBox();
      expect(button!.y + button!.height, "at 380 the sign-in button is above the fold").toBeLessThanOrEqual(vh);
    }
  });

  test("a failed sign-in says so, and it does not vanish", async ({ page }) => {
    await openSignIn(page);
    await failSignIn(page);
    const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
    await expect(alert).toContainText(/did not match|did not answer|too many|cannot sign anyone in/i);

    // Not on a timer, and not on the first keystroke either.
    await page.waitForTimeout(5_000);
    await expect(alert, "the failure vanished on a timer").toBeVisible();
    await page.getByLabel("Password", { exact: true }).press("End");
    await page.getByLabel("Password", { exact: true }).pressSequentially("x");
    await expect(alert, "the failure vanished when the teacher started to correct it").toBeVisible();

    // What was typed is kept, and the button is usable again.
    await expect(page.getByLabel("Email")).toHaveValue("nobody@example.com");
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  test("the password can be shown and hidden, and the control says which", async ({ page }) => {
    await openSignIn(page);
    const field = page.getByLabel("Password", { exact: true });
    await field.fill("visible-now");
    await expect(field).toHaveAttribute("type", "password");
    // A fixed label, with the state in aria-pressed -- never both changing at once.
    const toggle = page.getByRole("button", { name: "Show password" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(field).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(field, "and hidden again, from the keyboard").toHaveAttribute("type", "password");
  });

  test("no dead ends: no sign-up, a reset link that goes somewhere, a way to the student app", async ({ page }) => {
    await openSignIn(page);
    // The template's controls that would go nowhere here must not have been copied.
    await expect(page.getByRole("link", { name: /sign up|terms|privacy/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /github|facebook|google/i })).toHaveCount(0);
    /*
     * "Forgot password?" was left out on 25 Sep because there was nowhere for
     * it to go. The instructor approved a self-service reset the same day, so
     * it is back, and it must lead to a real page (console-password-reset.spec).
     */
    await expect(page.getByRole("link", { name: /forgot your password/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    // And a student at the wrong door has a door.
    await expect(page.getByRole("link", { name: /student app/i })).toBeVisible();
  });

  /*
   * THE API IS WOKEN WHILE THE TEACHER TYPES. Approved 25 Sep 2026.
   *
   * Render's free tier sleeps and takes ~50s to wake, and signing in goes to
   * Supabase, not the API -- so without this, a teacher signs in quickly and
   * then sits on /locks waiting for a server nobody asked to start. The page
   * asks `GET /healthz` (no database, no auth) on arrival, and says so in the
   * readout and, past 3s, in words.
   */
  test("the API is woken on arrival, and a slow wake is said in words", async ({ page }) => {
    let asked = 0;
    await page.route("**/healthz", async (route) => {
      asked += 1;
      await new Promise((r) => setTimeout(r, 4_500));
      await route.continue();
    });
    await asConsole(page, null);
    await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main dl")).toContainText(/SERVER\s*WAKING/);
    const line = page.getByRole("status").filter({ hasText: /starting up/i });
    await expect(line, "past 3s the wake must be said in words").toBeVisible({ timeout: 4_000 });
    // And it carries on without blocking anything: the form works throughout.
    await expect(page.getByLabel("Email")).toBeEditable();
    await expect(page.locator("main dl")).toContainText(/SERVER\s*ONLINE/, { timeout: 8_000 });
    await expect(line, "the words go once the server answers").toHaveCount(0);
    expect(asked, "one wake per visit, not one per render").toBe(1);
  });

  test("a server that never answers is said plainly, and sign-in still works", async ({ page }) => {
    await page.route("**/healthz", (route) => route.abort("connectionrefused"));
    await asConsole(page, null);
    await page.goto(`${CONSOLE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main dl")).toContainText(/SERVER\s*NO ANSWER/, { timeout: 8_000 });
    await expect(page.getByRole("status").filter({ hasText: /did not answer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  test("a fast server says nothing at all", async ({ page }) => {
    await openSignIn(page);
    await expect(page.locator("main dl")).toContainText(/SERVER\s*ONLINE/, { timeout: 8_000 });
    await expect(page.getByRole("status").filter({ hasText: /starting up|did not answer/i })).toHaveCount(0);
  });

  test("no text sits on a bus trace", async ({ page }) => {
    /*
     * Found by LOOKING at the first rebuild, not by the gate: a trace ran
     * straight through the caption under the readout, like a strikethrough.
     * The contrast assertion cannot see it -- the backdrop is a sibling of the
     * text, not an ancestor, so it is never "the background". `backdrop.css`
     * has always said text must never sit directly on a trace; this holds it.
     */
    const onTrace = async () =>
      page.evaluate(() => {
        const traceEls = [...document.querySelectorAll(".octa-trace")];
        const traces = traceEls.map((t) => t.getBoundingClientRect());
        /*
         * Text inside an opaque box that does NOT also contain the backdrop
         * (the notched readout frame) is painted over the trace, not on it.
         * A shared ancestor paints beneath both, so it covers nothing.
         */
        const covered = (el: Element) => {
          for (let a: Element | null = el; a && a.tagName !== "MAIN"; a = a.parentElement) {
            if (traceEls.some((t) => a!.contains(t))) return false;
            const bg = getComputedStyle(a).backgroundColor;
            if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return true;
          }
          return false;
        };
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("main *")) {
          const text = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
          );
          if (!text || covered(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 1 || r.height <= 1) continue;
          for (const t of traces) {
            if (t.width > 0 && t.bottom >= r.top && t.top <= r.bottom && t.right >= r.left && t.left <= r.right) {
              out.push(`"${(el.textContent ?? "").trim().slice(0, 40)}" at y=${Math.round(r.top)} crosses a trace at y=${Math.round(t.top)}`);
            }
          }
        }
        return out;
      });
    await openSignIn(page);
    expect(await onTrace(), "sign-in").toEqual([]);
    await openStudentScreen(page);
    expect(await onTrace(), "student screen").toEqual([]);
  });

  test("the toaster reaches this page — it lives at the app root, not in the shell", async ({ page }) => {
    await openSignIn(page);
    await expect(page.locator("[data-toaster]")).toHaveCount(1);
  });
});
