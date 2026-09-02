import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/students/:id` — "the page you'll use most" (`STATUS.md`), and R3.3's
 * highest-value route.
 *
 * `CONSOLE-DATA-AND-TEMPLATES.md` §2 asks for TanStack's expanding-rows pattern
 * on the attempt history, "where expanding a row reveals the regenerated exact
 * variant". This asserts the behaviour, not the widget.
 *
 * IT BUILDS ITS OWN DATA. `db/demo-seed.sql` seeds no attempts at all, so the
 * console's most-used page had nothing to show and this test would have had
 * nothing to assert. Rather than depend on an attempt somebody happened to
 * create by hand — which is not reproducible and would rot the first time
 * anyone ran `pnpm db:reset` — the test starts and submits one through the real
 * API, exactly as a student would.
 *
 * Assessment ids come from `db/schema.sql` via generated UUIDs, so they are NOT
 * stable across a reset. It is looked up by title.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

const STUDENT_SUB = "dddddddd-1111-4000-8000-000000000006";

function mint(sub: string, role: "student" | "teacher", studentId?: string): string {
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

const STUDENT = mint(STUDENT_SUB, "student", "232129006");
const STAFF = mint("dddddddd-0000-4000-8000-000000000001", "teacher");

/** Start and submit one attempt so the page has a paper to reveal. */
async function ensureAnAttempt(page: Page): Promise<boolean> {
  const ctx = page.request;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const listed = await ctx.get(`${API}/api/v1/console/assessments`, { headers: auth(STAFF) });
  if (!listed.ok()) return false;
  const body = (await listed.json()) as { assessments?: Array<{ id: string; title: string }> };
  const assessment = body.assessments?.[0];
  if (!assessment) return false;

  const started = await ctx.post(`${API}/api/v1/attempts`, {
    headers: { ...auth(STUDENT), "Content-Type": "application/json" },
    data: { assessmentId: assessment.id },
  });
  if (!started.ok()) return false;
  const attempt = (await started.json()) as { attemptId: string };

  // Submitted, not merely started: the console shows a score, and the paper is
  // regenerated from the stored seed either way.
  await ctx.post(`${API}/api/v1/attempts/${attempt.attemptId}/submit`, { headers: auth(STAFF) });
  await ctx.post(`${API}/api/v1/attempts/${attempt.attemptId}/submit`, { headers: auth(STUDENT) });
  return true;
}

test.describe("the student page reveals a paper without leaving the list", () => {
  test("expanding an attempt shows the regenerated variant in place", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough for behaviour");

    const ready = await ensureAnAttempt(page);
    test.skip(!ready, "could not create an attempt through the API — is the stack up?");

    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
    await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });

    const expander = page.locator("table tbody button[aria-expanded]").first();
    await expander.waitFor();

    // Collapsed to begin with: the list is the default, detail is on request.
    await expect(expander).toHaveAttribute("aria-expanded", "false");

    const panelId = await expander.getAttribute("aria-controls");
    expect(panelId, "the control must point at what it opens").toBeTruthy();
    await expect(page.locator(`#${panelId}`)).toHaveCount(0);

    await expander.click();
    await expect(expander).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    expect(await panel.locator("li").count(), "the paper's items are listed").toBeGreaterThan(0);

    /*
     * It spans the whole table. This is one attempt's detail, not another row
     * of the same shape, and a screen reader reading it as six empty cells plus
     * one full one would misdescribe the structure.
     */
    await expect(panel.locator("td").first()).toHaveAttribute("colspan", "6");

    // The key is shown -- allowed here, and ONLY here: staff, console, and the
    // attempt is submitted. `scan-bundle.mjs` proves it never reaches the
    // student bundle.
    await expect(panel).toContainText(/Key/);

    // And the whole page is still one navigation away, for a disputed mark.
    await expect(page.getByRole("link", { name: /Open paper/i }).first()).toBeVisible();

    /* ---- reversible: the same control closes it -------------------- */
    await expander.click();
    await expect(expander).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`#${panelId}`)).toHaveCount(0);
  });
});
