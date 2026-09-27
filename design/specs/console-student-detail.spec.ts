import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import {
  ATTEMPT, papersFrom, patchDetail, realItems, SECOND_SECTION, STUDENT_ID,
  type DetailAttempt, type Paper, type StudentDetail,
} from "./_student-detail-fixture";

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
    /*
     * Skips whenever the engine cannot fill a paper, which LOCALLY IS ALWAYS
     * (27 Sep 2026: all act-1 items at `review`, 0 live, and Start answers 500).
     * The fixture-backed tests below cover this route meanwhile; this one comes
     * back to life once items are live.
     */
    test.skip(!ready, "could not create an attempt through the API: no live items to fill a paper, or the stack is down");

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

/* ======================================================================
 * THE REBUILD, 27 Sep 2026: design/templates/console/students-detail/SPEC.md
 *
 * Everything below runs on the fixture (`_student-detail-fixture.ts`): the
 * REAL student response, patched with four attempts, and papers assembled from
 * REAL bank items resolved by the real engine. The test above still drives a
 * real attempt when the stack can make one; locally it cannot (0 live items),
 * so without the fixture this route would have no running test at all.
 *
 * EVERY WRITE IS INTERCEPTED, NEVER SENT: a deactivation or a section move on
 * a seeded student would break every spec that signs in as one.
 * ==================================================================== */

type Body = Record<string, unknown>;
interface Writes { status: Body[]; section: Body[] }

const wide = () => test.info().project.name === "desktop-1440";

async function openRecord(
  page: Page,
  opts: { deactivated?: boolean; attempts?: DetailAttempt[]; failWrites?: boolean } = {},
): Promise<{ writes: Writes; detail: StudentDetail; papers: Record<string, Paper> }> {
  const writes: Writes = { status: [], section: [] };
  const papers = papersFrom(await realItems(page.request, API, STAFF));
  let detail: StudentDetail | null = null;
  const fail = {
    status: 500, contentType: "application/json",
    body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }),
  };

  await page.route(`**/api/v1/console/students/${STUDENT_SUB}`, async (route: Route) => {
    try {
      const res = await route.fetch();
      detail = patchDetail((await res.json()) as StudentDetail, opts);
      await route.fulfill({ response: res, json: detail });
    } catch {
      /* the page or the test went away while the record was in flight */
    }
  });
  await page.route("**/api/v1/console/attempts/*", async (route: Route) => {
    const id = route.request().url().split("/").pop()!;
    const paper = papers[id];
    if (paper) await route.fulfill({ json: paper });
    else await route.continue();
  });
  await page.route("**/api/v1/console/roster/**", async (route: Route) => {
    const req = route.request();
    const body = req.postDataJSON() as Body;
    if (req.url().endsWith("/status")) {
      writes.status.push(body);
      await route.fulfill(opts.failWrites ? fail : { json: { ok: true, active: body.active, fullName: "", registered: true } });
      return;
    }
    if (req.url().endsWith("/section")) {
      writes.section.push(body);
      await route.fulfill(opts.failWrites ? fail : { json: { ok: true, moved: 1, sectionCode: SECOND_SECTION.code } });
      return;
    }
    await route.abort();
  });

  await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });
  // WAIT FOR THE PAGE TO DECIDE (NEXT-SESSION §0a.2): attempts, not <main>.
  await page.locator("[data-attempt]").first().waitFor({ timeout: 20_000 });
  return { writes, detail: detail!, papers };
}

const attemptOf = (page: Page, id: string) => page.locator(`[data-attempt="${id}"]`);
const toggleOf = (page: Page, id: string) => attemptOf(page, id).locator("button[aria-expanded]");

async function expand(page: Page, id: string): Promise<void> {
  await toggleOf(page, id).click();
  await expect(toggleOf(page, id)).toHaveAttribute("aria-expanded", "true");
  await page.locator(`#paper-${id} [data-item]`).first().waitFor();
}

async function openActions(page: Page, d: StudentDetail): Promise<void> {
  await page.getByRole("button", { name: `Actions for ${d.student.fullName}` }).click();
  await page.getByRole("menu").waitFor();
}

async function openDeactivate(page: Page, d: StudentDetail): Promise<void> {
  await openActions(page, d);
  await page.getByRole("menuitem", { name: /deactivate/i }).click();
  await page.getByRole("dialog").waitFor();
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("the rebuilt record", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  /* --------------------------------------------------------------------
   * THE GATE: CONSOLE-REVAMP.md §2, at 1440 and 380
   * ------------------------------------------------------------------ */

  test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
    test("1 · nothing is clipped: the record, an open paper, the deactivate dialog", async ({ page }) => {
      const { detail } = await openRecord(page);
      expect(await clippedElements(page), "the record").toEqual([]);
      await expand(page, ATTEMPT.submitted);
      expect(await clippedElements(page), "with a paper open").toEqual([]);
      await openDeactivate(page, detail);
      expect(await clippedElements(page), "in the deactivate dialog").toEqual([]);
    });

    test("2 · no horizontal page scroll", async ({ page }) => {
      const { detail } = await openRecord(page);
      expect(await horizontalOverflow(page), "the record").toBeLessThanOrEqual(0);
      await expand(page, ATTEMPT.submitted);
      expect(await horizontalOverflow(page), "with a paper open").toBeLessThanOrEqual(0);
      await openDeactivate(page, detail);
      expect(await horizontalOverflow(page), "with the dialog open").toBeLessThanOrEqual(0);
    });

    test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
      test.setTimeout(240_000);
      const { detail } = await openRecord(page);
      expect(await unreachableByKeyboard(page, "main"), "the record").toEqual([]);
      await expand(page, ATTEMPT.submitted);
      expect(await unreachableByKeyboard(page, "main"), "with a paper open").toEqual([]);

      // The Actions menu WITHOUT the mouse, and focus comes home when the dialog closes.
      const trigger = page.getByRole("button", { name: `Actions for ${detail.student.fullName}` });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menu").waitFor();
      await page.keyboard.press("End");
      await expect(page.getByRole("menuitem", { name: /deactivate/i })).toBeFocused();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.getByLabel("Reason (required)").fill("Dropped the course");
      await page.getByLabel(/type the student id/i).fill(STUDENT_ID);
      expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the deactivate dialog").toEqual([]);
      await closeDialog(page);
      await expect(trigger, "focus came home to the Actions button").toBeFocused();
    });

    test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
      test.setTimeout(180_000);
      const { detail } = await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      const failures: string[] = [];
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} record: ${f}`));
      }
      await expand(page, ATTEMPT.inProgress);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} in progress: ${f}`));
      }
      await openDeactivate(page, detail);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} deactivate: ${f}`));
      }
      expect(failures).toEqual([]);
    });

    test("5 · the token system is what actually rendered", async ({ page }) => {
      const { detail } = await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      expect(await offTokenStyles(page), "the record with a paper open").toEqual([]);
      await openDeactivate(page, detail);
      expect(await offTokenStyles(page), "in the deactivate dialog").toEqual([]);
    });

    test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
      /*
       * POSITIVE CONTROL FIRST: with motion allowed, the paper must ease open.
       * Without this the test passes on a page with no motion at all.
       */
      await recordMotion(page);
      await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("main") && m.ms >= 100);
      expect(moving.length, "with motion allowed, the paper should ease open").toBeGreaterThan(0);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.unrouteAll({ behavior: "ignoreErrors" });
      const again = await openRecord(page);
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      await expand(page, ATTEMPT.submitted);
      await openDeactivate(page, again.detail);
      const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
      expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
    });
  });

  /* --------------------------------------------------------------------
   * THE ROUTE'S OWN CLAIMS: PAGE-SPECS.md §/console/students/:id
   * ------------------------------------------------------------------ */

  test.describe("the record header: who, section, registration, state", () => {
    test("names the student, their ID, section and when they registered", async ({ page }) => {
      const { detail } = await openRecord(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(detail.student.fullName);
      const facts = page.locator("[data-record-facts]");
      await expect(facts).toContainText(STUDENT_ID);
      await expect(facts).toContainText(detail.student.sectionCode!);
      await expect(facts).toContainText(/registered \d{1,2} \w{3} 2026/i);
      await expect(page.locator("[data-record-state]")).toHaveText("Registered");
      await expect(page.getByRole("link", { name: /students/i }).first()).toHaveAttribute("href", "/students");
    });

    test("a deactivated student says so in a word, and offers Reactivate instead", async ({ page }) => {
      const { detail } = await openRecord(page, { deactivated: true });
      await expect(page.locator("[data-record-state]")).toHaveText("Deactivated");
      await openActions(page, detail);
      await expect(page.getByRole("menuitem", { name: /^deactivate/i })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: /reactivate/i })).toBeVisible();
    });
  });

  test.describe("every attempt, and the exact paper under it", () => {
    test("lists every attempt, newest first, with its status in words", async ({ page }) => {
      await openRecord(page);
      const ids = await page.locator("[data-attempt]").evaluateAll((els) => els.map((e) => e.getAttribute("data-attempt")));
      expect(ids.slice(0, 4)).toEqual([ATTEMPT.inProgress, ATTEMPT.submitted, ATTEMPT.voided, ATTEMPT.abandoned]);
      await expect(attemptOf(page, ATTEMPT.submitted)).toContainText("Submitted");
      await expect(attemptOf(page, ATTEMPT.submitted)).toContainText("5/8");
      await expect(attemptOf(page, ATTEMPT.submitted)).toContainText("14 min 32 s");
      await expect(attemptOf(page, ATTEMPT.inProgress)).toContainText("In progress");
      await expect(attemptOf(page, ATTEMPT.voided)).toContainText("Voided");
      await expect(attemptOf(page, ATTEMPT.abandoned)).toContainText("Abandoned");
    });

    test("a submitted paper: their options in their order, their answer, the key, the rationale, the time", async ({ page }) => {
      const { papers } = await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      const paper = papers[ATTEMPT.submitted]!;
      const panel = page.locator(`#paper-${ATTEMPT.submitted}`);
      await expect(panel.locator("[data-item]")).toHaveCount(paper.items.length);

      for (const item of paper.items) {
        const li = panel.locator(`[data-item="${item.ordinal}"]`);
        await expect(li).toContainText(item.stem);
        // Their options, in THEIR order: the order is the claim, not the set.
        const shown = await li.locator("[data-option]").evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
        expect(shown, `item ${item.ordinal}'s options in the order the student saw`).toEqual(item.options);
        if (item.rationale) await expect(li.locator("[data-rationale]")).toContainText(item.rationale.slice(0, 40));
        // The verdict in words, never colour alone.
        await expect(li.locator("[data-verdict]")).toHaveText(
          item.isCorrect === null ? "Not answered" : item.isCorrect ? "Correct" : "Not correct",
        );
        if (item.timeMs !== null) await expect(li.locator("[data-time]")).toHaveText(/\d+ s$/);
      }

      // An ordering item: the keyed order, numbered.
      const g = paper.items.find((i) => i.type === "G");
      if (g) {
        const key = await panel.locator(`[data-item="${g.ordinal}"] [data-key-sequence] li`).allTextContents();
        expect(key.map((t) => t.trim())).toEqual(g.correctValue.split(" | "));
      }
      // A choice item answered wrongly: the key and their answer, marked in words.
      const s = paper.items.find((i) => i.type !== "G" && i.isCorrect === false)!;
      const li = panel.locator(`[data-item="${s.ordinal}"]`);
      await expect(li.locator(`[data-option="${s.correctValue}"]`)).toContainText("Key");
      await expect(li.locator(`[data-option="${s.studentAnswer}"]`)).toContainText("Their answer");

      await expect(panel.getByRole("link", { name: /open paper/i })).toHaveAttribute("href", `/attempts/${ATTEMPT.submitted}`);
    });

    test("options are lettered, sequences numbered, and a computed value is mono", async ({ page }) => {
      /*
       * Found by screenshot, 27 Sep 2026: Tailwind's preflight strips
       * `list-style` from every <ol>, so `type="A"` drew no letters at all, and
       * a computed item's options (machine values) rendered in Inter.
       */
      const { papers } = await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      const panel = page.locator(`#paper-${ATTEMPT.submitted}`);
      const style = (sel: string, prop: string) =>
        panel.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
      expect(await style("[data-option]", "list-style-type"), "options are lettered A, B, C").toBe("upper-alpha");
      expect(await style("[data-key-sequence] li", "list-style-type"), "the keyed order is numbered").toBe("decimal");
      const p = papers[ATTEMPT.submitted]!.items.find((i) => i.type === "P")!;
      const font = await panel
        .locator(`[data-item="${p.ordinal}"] [data-option] .record-option-text`).first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
      expect(font, "a computed value is what the machine produced: mono").toMatch(/mono/i);
    });

    test("an in-progress paper shows no key, no verdict and no rationale (instructor, 27 Sep)", async ({ page }) => {
      const { papers } = await openRecord(page);
      await expand(page, ATTEMPT.inProgress);
      const panel = page.locator(`#paper-${ATTEMPT.inProgress}`);
      await expect(panel).toContainText(/key appears here once .* submitted/i);
      await expect(panel.locator("[data-key], [data-key-sequence], [data-verdict], [data-rationale]")).toHaveCount(0);
      for (const item of papers[ATTEMPT.inProgress]!.items) {
        if (item.rationale) await expect(panel).not.toContainText(item.rationale.slice(0, 40));
      }
      // Their answers so far ARE shown: that is what a teacher checking on a sitting student needs.
      await expect(panel.locator("[data-answered]").first()).toBeVisible();
    });

    test("an abandoned paper is withheld the same way; a voided one shows everything", async ({ page }) => {
      await openRecord(page);
      await expand(page, ATTEMPT.abandoned);
      await expect(page.locator(`#paper-${ATTEMPT.abandoned}`).locator("[data-key], [data-verdict]")).toHaveCount(0);
      await expand(page, ATTEMPT.voided);
      await expect(page.locator(`#paper-${ATTEMPT.voided} [data-verdict]`).first()).toBeVisible();
      await expect(page.locator(`#paper-${ATTEMPT.voided}`)).toContainText(/voided/i);
    });

    test("one paper open at a time, and the same control closes it", async ({ page }) => {
      await openRecord(page);
      await expand(page, ATTEMPT.submitted);
      await expand(page, ATTEMPT.voided);
      await expect(toggleOf(page, ATTEMPT.submitted)).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(`#paper-${ATTEMPT.submitted}`)).toHaveCount(0);
      await toggleOf(page, ATTEMPT.voided).click();
      await expect(page.locator(`#paper-${ATTEMPT.voided}`)).toHaveCount(0);
    });

    test("at 1440 a table whose paper spans every column; at 380 a list", async ({ page }) => {
      await openRecord(page);
      if (wide()) {
        await expand(page, ATTEMPT.submitted);
        const cols = await page.locator("[data-attempts] thead th").count();
        await expect(page.locator(`#paper-${ATTEMPT.submitted} > td`)).toHaveAttribute("colspan", String(cols));
      } else {
        await expect(page.locator("[data-attempts] table")).toHaveCount(0);
        await expand(page, ATTEMPT.submitted);
      }
    });
  });

  test.describe("the roster's actions, from the record", () => {
    test("deactivate: reason and the typed ID, one request, and a toast", async ({ page }) => {
      const { writes, detail } = await openRecord(page);
      const name = detail.student.fullName;
      await openDeactivate(page, detail);
      const d = page.getByRole("dialog");
      const go = d.getByRole("button", { name: `Deactivate ${name}` });
      await d.getByLabel("Reason (required)").fill("Dropped the course on 20 September");
      await expect(go, "a reason but no typed ID").toBeDisabled();
      await d.getByLabel(/type the student id/i).fill(STUDENT_ID);
      await go.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes.status).toEqual([{ studentId: STUDENT_ID, active: false, reason: "Dropped the course on 20 September" }]);
      await expect(page.locator("[data-toaster] [role=status]")).toContainText(`${name} deactivated`);
    });

    test("move to section: pick, say why, one request", async ({ page }) => {
      const { writes, detail } = await openRecord(page);
      await openActions(page, detail);
      await page.getByRole("menuitem", { name: /move to section/i }).click();
      const d = page.getByRole("dialog");
      await expect(d).toContainText(detail.student.fullName);
      await d.getByLabel("Move to").selectOption({ label: SECOND_SECTION.code });
      await d.getByLabel("Reason (required)").fill("Section split for the lab schedule");
      await d.getByRole("button", { name: "Move 1 student" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes.section).toEqual([{ studentIds: [STUDENT_ID], sectionId: SECOND_SECTION.id, reason: "Section split for the lab schedule" }]);
      await expect(page.locator("[data-toaster] [role=status]")).toContainText(`moved to ${SECOND_SECTION.code}`);
    });
  });

  test.describe("loading and failure — design.md", () => {
    test("a slow record shows a skeleton shaped like the page, never a blank", async ({ page }) => {
      await page.route(`**/api/v1/console/students/${STUDENT_SUB}`, async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });
      const skeleton = page.locator("[data-skeleton]");
      await expect(skeleton).toBeVisible({ timeout: 1_400 });
      await page.getByRole("heading", { level: 1 }).waitFor();
      await expect(skeleton).toHaveCount(0);
    });

    test("a failed fetch says so and offers a retry", async ({ page }) => {
      let fail = true;
      await page.route(`**/api/v1/console/students/${STUDENT_SUB}`, async (route) => {
        if (fail) {
          await route.fulfill({ status: 500, json: { error: { code: "internal", message: "The record could not be read." } } });
        } else {
          await route.continue();
        }
      });
      await page.goto(`${CONSOLE_URL}/students/${STUDENT_SUB}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main [role=alert]")).toContainText("could not be read");
      fail = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await page.getByRole("heading", { level: 1 }).waitFor();
    });

    test("a paper that will not load says so in its row, and the list stays", async ({ page }) => {
      await openRecord(page);
      await page.route(`**/api/v1/console/attempts/${ATTEMPT.voided}`, (route) =>
        route.fulfill({ status: 500, json: { error: { code: "internal", message: "x" } } }),
      );
      await toggleOf(page, ATTEMPT.voided).click();
      await expect(page.locator(`#paper-${ATTEMPT.voided} [role=alert]`)).toContainText(/could not be loaded/i);
      await expect(page.locator("[data-attempt]")).toHaveCount(4);
    });
  });
});
