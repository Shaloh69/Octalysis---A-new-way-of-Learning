import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

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
