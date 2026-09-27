import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, PASTE, patch, type Roster } from "./_students-fixture";

/**
 * `/students`: the roster.
 *
 * `design/templates/console/students/SPEC.md` owns the decisions; this file
 * holds the six-assertion gate (`CONSOLE-REVAMP.md` §2) and the route's own
 * claims from `PAGE-SPECS.md` §/console/roster.
 *
 * EVERY ROSTER WRITE IS INTERCEPTED, NEVER SENT. An import, a deactivation and
 * a section move each change who can sign in or what they can open. A spec
 * that proves a layout by deactivating a seeded student breaks every spec that
 * signs in as one.
 *
 * The one thing that DOES reach the API is the import's dry run, because it
 * writes nothing (`services/api/test/console.spec.ts` proves that) and because
 * the preview is only worth testing against the real plan. The apply, the
 * deactivate, the reactivate and the move are answered here.
 *
 * The roster is the REAL local response, patched (`_students-fixture.ts`) with
 * a deactivated student and a second section. Seeded fixture names only.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function staffToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STAFF = staffToken();
type Body = Record<string, unknown>;
interface Writes { apply: Body[]; status: Body[]; section: Body[]; dryRuns: number }

const wide = () => test.info().project.name === "desktop-1440";

/**
 * Open `/students` on the patched roster, with every write captured and
 * answered without reaching the API.
 */
async function openRoster(page: Page, opts: { failWrites?: boolean } = {}): Promise<{ writes: Writes; roster: Roster }> {
  const writes: Writes = { apply: [], status: [], section: [], dryRuns: 0 };
  let roster: Roster | null = null;
  const fail = {
    status: 500, contentType: "application/json",
    body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }),
  };

  await page.route("**/api/v1/console/roster**", async (route: Route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "GET") {
      try {
        const res = await route.fetch();
        roster = patch((await res.json()) as Roster);
        await route.fulfill({ response: res, json: roster });
      } catch {
        /* the page or the test went away while the roster was in flight */
      }
      return;
    }
    const body = req.postDataJSON() as Body;
    if (url.endsWith("/import")) {
      if (body.apply !== true) {
        writes.dryRuns += 1;
        await route.continue(); // a dry run writes nothing: the real plan
        return;
      }
      writes.apply.push(body);
      await route.fulfill(opts.failWrites ? fail : {
        status: 200, contentType: "application/json",
        body: JSON.stringify({ dryRun: false, summary: { insert: 1, update: 1, unchanged: 1, conflict: 3 } }),
      });
      return;
    }
    if (url.endsWith("/status")) {
      writes.status.push(body);
      await route.fulfill(opts.failWrites ? fail : {
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, active: body.active, fullName: "", registered: true }),
      });
      return;
    }
    if (url.endsWith("/section")) {
      writes.section.push(body);
      await route.fulfill(opts.failWrites ? fail : {
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, moved: (body.studentIds as unknown[]).length, sectionCode: FIX.section.code,
        }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto(`${CONSOLE_URL}/students`, { waitUntil: "domcontentloaded" });
  // WAIT FOR THE PAGE TO DECIDE (NEXT-SESSION §0a.2): rows, not <main>.
  await page.locator("[data-student]").first().waitFor({ timeout: 20_000 });
  return { writes, roster: roster! };
}

const rowOf = (page: Page, studentId: string) => page.locator(`[data-student="${studentId}"]`);
const nameOf = (r: Roster, studentId: string) => r.students.find((s) => s.studentId === studentId)!.fullName;

async function openMenu(page: Page, r: Roster, studentId: string): Promise<void> {
  await page.getByRole("button", { name: `Actions for ${nameOf(r, studentId)}` }).click();
  await page.getByRole("menu").waitFor();
}

async function openDeactivate(page: Page, r: Roster, studentId = FIX.active): Promise<void> {
  await openMenu(page, r, studentId);
  await page.getByRole("menuitem", { name: /deactivate/i }).click();
  await page.getByRole("dialog").waitFor();
}

async function openPreview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Import roster" }).first().click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Roster", { exact: true }).fill(PASTE);
  await d.getByRole("button", { name: "Preview" }).click();
  await d.locator("[data-plan-row]").first().waitFor();
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
});

/* ======================================================================
 * THE GATE: CONSOLE-REVAMP.md §2, at 1440 and 380
 * ==================================================================== */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: roster, import preview, deactivate dialog", async ({ page }) => {
    const { roster } = await openRoster(page);
    expect(await clippedElements(page), "on the roster").toEqual([]);
    await openPreview(page);
    expect(await clippedElements(page), "in the import preview").toEqual([]);
    await closeDialog(page);
    await openDeactivate(page, roster);
    expect(await clippedElements(page), "in the deactivate dialog").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    const { roster } = await openRoster(page);
    expect(await horizontalOverflow(page), "the roster").toBeLessThanOrEqual(0);
    await openPreview(page);
    expect(await horizontalOverflow(page), "with the preview open").toBeLessThanOrEqual(0);
    await closeDialog(page);
    await openDeactivate(page, roster);
    expect(await horizontalOverflow(page), "with the deactivate dialog open").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    test.setTimeout(240_000);
    const { roster } = await openRoster(page);
    expect(await unreachableByKeyboard(page, "main"), "on the roster").toEqual([]);

    // The row menu, WITHOUT the mouse: open it, walk to Deactivate, and when the
    // dialog closes focus must come back to the menu button, not to <body>.
    const trigger = page.getByRole("button", { name: `Actions for ${nameOf(roster, FIX.active)}` });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: /deactivate/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    // Make the confirm button enabled so it is counted.
    await page.getByLabel("Reason (required)").fill("Dropped the course");
    await page.getByLabel(/type the student id/i).fill(FIX.active);
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the deactivate dialog").toEqual([]);
    await closeDialog(page);
    await expect(trigger, "focus came home to the row's menu button").toBeFocused();

    await openPreview(page);
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the import preview").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(180_000);
    const { roster } = await openRoster(page);
    const failures: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} roster: ${f}`));
    }
    await openPreview(page);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} preview: ${f}`));
    }
    await closeDialog(page);
    await openDeactivate(page, roster);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} deactivate: ${f}`));
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    const { roster } = await openRoster(page);
    expect(await offTokenStyles(page), "on the roster").toEqual([]);
    await openPreview(page);
    expect(await offTokenStyles(page), "in the import preview").toEqual([]);
    await closeDialog(page);
    await openDeactivate(page, roster);
    expect(await offTokenStyles(page), "in the deactivate dialog").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST: with motion allowed, the deactivate dialog must
     * ease in. Without this the test passes on a page with no motion at all.
     */
    await recordMotion(page);
    const { roster } = await openRoster(page);
    await openDeactivate(page, roster);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("dialog") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the dialog should ease in").toBeGreaterThan(0);
    await closeDialog(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const again = await openRoster(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openDeactivate(page, again.roster);
    await page.keyboard.press("Escape");
    await openPreview(page);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * THE ROUTE'S OWN CLAIMS: PAGE-SPECS.md §/console/roster
 * ==================================================================== */

test.describe("claim status per row, in words", () => {
  test("the header counts who has registered, and every row says its state", async ({ page }) => {
    const { roster } = await openRoster(page);
    const n = roster.students.length;
    await expect(page.locator("[data-roster-counts]")).toContainText(`${n} on the roster`);
    await expect(page.locator("[data-roster-counts]")).toContainText("20 registered");
    await expect(page.locator("[data-roster-counts]")).toContainText("3 not registered");
    await expect(page.locator("[data-roster-counts]")).toContainText("1 deactivated");
    await expect(rowOf(page, FIX.deactivated)).toContainText("Deactivated");
    await expect(rowOf(page, FIX.unregistered)).toContainText("Not registered");
    await expect(rowOf(page, FIX.active)).toContainText("Registered");
    await expect(page.locator("[data-student]")).toHaveCount(n);
  });

  test("a name links to the student's record only once they have registered", async ({ page }) => {
    const { roster } = await openRoster(page);
    const active = roster.students.find((s) => s.studentId === FIX.active)!;
    await expect(rowOf(page, FIX.active).getByRole("link", { name: active.fullName }))
      .toHaveAttribute("href", `/students/${active.userId}`);
    await expect(rowOf(page, FIX.unregistered).getByRole("link")).toHaveCount(0);
  });

  test("registration filters are pressed buttons with counts, and they filter", async ({ page }) => {
    await openRoster(page);
    const notYet = page.getByRole("button", { name: /^Not registered/ });
    await expect(notYet).toContainText("3");
    await notYet.click();
    await expect(notYet).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-student]")).toHaveCount(3);
    await page.getByRole("button", { name: /^Deactivated/ }).click();
    await expect(page.locator("[data-student]")).toHaveCount(1);
    await page.getByRole("button", { name: /^All/ }).click();
    await page.getByLabel("Search the roster").fill("zzzz-nobody");
    await expect(page.locator("main")).toContainText("No student matches");
  });

  test("at 380 the table becomes a list, with every student in it", async ({ page }) => {
    test.skip(wide(), "the 380 layout");
    const { roster } = await openRoster(page);
    await expect(page.locator("main table"), "seven columns do not fit in 348px").toHaveCount(0);
    await expect(page.locator("li[data-student]")).toHaveCount(roster.students.length);
  });
});

test.describe("import: a preview of every row before anything is written", () => {
  test("names each row's outcome in words, from the real dry run", async ({ page }) => {
    const { writes } = await openRoster(page);
    await openPreview(page);
    expect(writes.dryRuns, "the preview came from the API's plan").toBe(1);
    expect(writes.apply, "a preview wrote something").toHaveLength(0);

    const d = page.getByRole("dialog");
    const row = (id: string) => d.locator(`[data-plan-row="${id}"]`);
    await expect(row("232129099")).toHaveAttribute("data-action", "insert");
    await expect(row("232129099"), "Dela Cruz, Juan Miguel is one name").toContainText("Dela Cruz, Juan Miguel");
    await expect(row("232129099")).toContainText("New");
    await expect(row("232129022")).toHaveAttribute("data-action", "update");
    await expect(row("232129022")).toContainText("Andrea Nicole Osmeña");
    await expect(row("232129022")).toContainText("Osmeña, Andrea Nicole");
    await expect(row("232129001")).toContainText(/registered/i);
    await expect(row("232129001")).toContainText(/move to section/i);
    await expect(row("232129002")).toContainText("Unchanged");
    await expect(row("232129023")).toHaveCount(2);
    await expect(row("232129023").first()).toContainText(/twice/i);
    await expect(d.getByRole("button", { name: "Import 2 rows" })).toBeEnabled();
  });

  test("'only rows that need a look' hides the new and unchanged ones", async ({ page }) => {
    await openRoster(page);
    await openPreview(page);
    const d = page.getByRole("dialog");
    const look = d.getByRole("button", { name: /only rows that need a look/i });
    await look.click();
    await expect(look).toHaveAttribute("aria-pressed", "true");
    await expect(d.locator("[data-plan-row]")).toHaveCount(4); // 1 will change + 3 not imported
  });

  test("importing sends the rows it previewed, and says what happened", async ({ page }) => {
    const { writes } = await openRoster(page);
    await openPreview(page);
    await page.getByRole("button", { name: "Import 2 rows" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.apply).toHaveLength(1);
    expect(writes.apply[0]).toMatchObject({ apply: true, sectionCode: "BSCPE - 4" });
    expect((writes.apply[0]!.rows as unknown[]).length).toBe(6);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("1 added and 1 updated");
  });

  test("Back keeps what was pasted", async ({ page }) => {
    await openRoster(page);
    await openPreview(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("dialog").getByLabel("Roster", { exact: true })).toHaveValue(PASTE);
  });
});

test.describe("deactivate: hard to do by accident, and undoable", () => {
  test("says what happens, needs a reason AND the typed ID, then confirms itself", async ({ page }) => {
    const { roster, writes } = await openRoster(page);
    const name = nameOf(roster, FIX.active);
    await openDeactivate(page, roster);
    const d = page.getByRole("dialog");
    await expect(d).toContainText(/by student ID or by email/i);
    await expect(d).toContainText(/attempts, answers and grades are kept/i);
    const go = d.getByRole("button", { name: `Deactivate ${name}` });
    await expect(go, "nothing filled in").toBeDisabled();
    await d.getByLabel("Reason (required)").fill("Dropped the course on 20 September");
    await expect(go, "a reason but no typed ID").toBeDisabled();
    await d.getByLabel(/type the student id/i).fill("232129004");
    await expect(go, "the wrong ID").toBeDisabled();
    await d.getByLabel(/type the student id/i).fill(FIX.active);
    await expect(go).toBeEnabled();
    await go.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.status).toEqual([
      { studentId: FIX.active, active: false, reason: "Dropped the course on 20 September" },
    ]);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText(`${name} deactivated`);
  });

  test("an unregistered row says its ID can no longer be used to register", async ({ page }) => {
    const { roster } = await openRoster(page);
    await openDeactivate(page, roster, FIX.unregistered);
    await expect(page.getByRole("dialog")).toContainText(/can no longer be used to register/i);
  });

  test("is never offered in bulk", async ({ page }) => {
    const { roster } = await openRoster(page);
    await page.getByRole("checkbox", { name: `Select ${nameOf(roster, FIX.active)}` }).check();
    const bar = page.getByRole("region", { name: "Bulk change" });
    await expect(bar).toContainText("1 selected");
    await expect(bar.getByRole("button", { name: /deactivate/i })).toHaveCount(0);
  });

  test("a deactivated student is reactivated from the same menu, with a reason", async ({ page }) => {
    const { roster, writes } = await openRoster(page);
    await openMenu(page, roster, FIX.deactivated);
    await expect(page.getByRole("menuitem", { name: /^deactivate/i })).toHaveCount(0);
    await page.getByRole("menuitem", { name: /reactivate/i }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Reason (required)").fill("Re-enrolled after the drop was reversed");
    await d.getByRole("button", { name: `Reactivate ${nameOf(roster, FIX.deactivated)}` }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.status[0]).toMatchObject({ studentId: FIX.deactivated, active: true });
  });

  test("a failed deactivation keeps the dialog and says so until dismissed", async ({ page }) => {
    test.setTimeout(60_000);
    const { roster } = await openRoster(page, { failWrites: true });
    await openDeactivate(page, roster);
    const d = page.getByRole("dialog");
    await d.getByLabel("Reason (required)").fill("Dropped the course");
    await d.getByLabel(/type the student id/i).fill(FIX.active);
    await d.getByRole("button", { name: /^deactivate/i }).click();
    await expect(d.getByRole("alert")).toContainText("did not answer");
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toContainText(/not deactivated/i);
    await page.waitForTimeout(5_000);
    await expect(alert, "a failure never vanishes on a timer").toBeVisible();
  });
});

test.describe("bulk section move", () => {
  test("tick students, pick a section, say why: one request, and it says what happened", async ({ page }) => {
    const { roster, writes } = await openRoster(page);
    const a = roster.students[0]!;
    const b = roster.students[1]!;
    await page.getByRole("checkbox", { name: `Select ${a.fullName}` }).check();
    await page.getByRole("checkbox", { name: `Select ${b.fullName}` }).check();
    const bar = page.getByRole("region", { name: "Bulk change" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: /move to section/i }).click();

    const d = page.getByRole("dialog");
    await expect(d).toContainText(a.fullName);
    await expect(d).toContainText(/locks and assessment windows follow the student/i);
    const go = d.getByRole("button", { name: "Move 2 students" });
    await d.getByLabel("Move to").selectOption({ label: FIX.section.code });
    await expect(go, "no reason, no move").toBeDisabled();
    await d.getByLabel("Reason (required)").fill("Section split for the lab schedule");
    await go.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes.section).toEqual([
      { studentIds: [a.studentId, b.studentId], sectionId: FIX.section.id, reason: "Section split for the lab schedule" },
    ]);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText(`2 students moved to ${FIX.section.code}`);
    await expect(bar, "the selection clears after the move").toHaveCount(0);
  });

  test("the header checkbox selects every student shown, and Escape clears it", async ({ page }) => {
    await openRoster(page);
    await page.getByRole("button", { name: /^Not registered/ }).click();
    await page.getByRole("checkbox", { name: "Select every student shown" }).check();
    await expect(page.getByRole("region", { name: "Bulk change" })).toContainText("3 selected");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Bulk change" })).toHaveCount(0);
  });
});

test.describe("loading and failure — design.md", () => {
  test("a slow roster shows a skeleton shaped like the table, never a blank", async ({ page }) => {
    test.skip(!wide(), "the skeleton's shape is a desktop claim");
    await page.route("**/api/v1/console/roster", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(`${CONSOLE_URL}/students`, { waitUntil: "domcontentloaded" });
    const skeleton = page.locator("[data-skeleton]");
    await expect(skeleton).toBeVisible({ timeout: 1_400 });
    expect(Number(await skeleton.getAttribute("data-cols")), "a column per table column").toBe(8);
    await page.locator("[data-student]").first().waitFor();
    await expect(skeleton).toHaveCount(0);
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/console/roster", async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500, contentType: "application/json",
          body: JSON.stringify({ error: { code: "internal", message: "The roster could not be read." } }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto(`${CONSOLE_URL}/students`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main [role=alert]")).toContainText("could not be read");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.locator("[data-student]").first().waitFor();
  });
});
