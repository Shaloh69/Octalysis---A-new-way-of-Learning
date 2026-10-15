import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * T2 5.10: a class's own window on a shared stage check (instructor, 15 Oct 2026: "Build it now"; moon checks
 * follow; only the class's own teacher). The DATA half is `services/api/test/class-windows-*.spec.ts`. This is
 * the page half of `/assessments`, against the real local API and the demo database:
 *
 *   teacher  the demo teacher, who holds BSCPE - 4: a stage check offers "Set for my class"
 *   admin    the T2 admin, who holds nothing: reads the class windows, sets none
 *
 * Every write is INTERCEPTED (the PUT is answered here), so nothing touches the database. The list is the
 * API's own, with one stage check given a class window where a test needs the "has its own" state.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const WHO = { teacher: "dddddddd-0000-4000-8000-000000000001", admin: "eeeeeeee-0000-4000-8000-000000000002" } as const;
type Persona = keyof typeof WHO;

function token(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, email: "demo@example.com", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role } });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

interface Opts { own?: boolean; fail?: boolean }
interface Served { puts: Array<{ url: string; body: Record<string, unknown> }> }

/** Open /assessments as a persona, with the list patched as asked and every PUT answered here. */
async function open(page: Page, who: Persona, opts: Opts = {}): Promise<Served> {
  const served: Served = { puts: [] };
  await page.route("**/api/v1/console/assessments", async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const res = await route.fetch();
    const list = await res.json();
    if (opts.own) {
      const stage = list.assessments.find((a: { scope: string; sectionId: string | null }) => a.scope === "stage" && a.sectionId === null);
      const mine = list.classes.find((c: { canSetWindow: boolean }) => c.canSetWindow) ?? list.classes[0];
      if (stage && mine) {
        stage.classWindows = [{ classId: mine.id, opensAt: null, closesAt: new Date(Date.now() + 20 * 86_400_000).toISOString(), attemptsAllowed: 7, setAt: new Date().toISOString() }];
      }
    }
    return route.fulfill({ response: res, json: list });
  });
  await page.route("**/api/v1/console/assessments/*/classes/*/window", async (route: Route) => {
    served.puts.push({ url: route.request().url(), body: route.request().postDataJSON() });
    if (opts.fail) return route.fulfill({ status: 400, json: { error: { code: "bad_request", message: "A student in BSCPE - 4 has already sat attempt 3. The limit cannot go below that." } } });
    return route.fulfill({ status: 200, json: { ok: true, cleared: false } });
  });
  await page.addInitScript((v) => localStorage.setItem("octa:dev-token", v), token(WHO[who], who === "admin" ? "admin" : "teacher"));
  await page.goto(`${CONSOLE_URL}/assessments`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-counts]").first().waitFor({ timeout: 20_000 });
  return served;
}

/** The first shared stage check's row: the table's <tr> at 1440, the list's <li> at 380. */
function stageRow(page: Page) {
  return page.locator("[data-assessment]").filter({ hasText: /Stage \d\d Check/ }).filter({ hasText: "every section" }).first();
}

async function openForMyClass(page: Page) {
  await stageRow(page).getByRole("button", { name: "Set for my class" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

async function openAsAdmin(page: Page) {
  const row = stageRow(page);
  await row.getByRole("button", { name: /^More for / }).click();
  await page.getByRole("menuitem", { name: "Class windows…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

test.describe("a teacher sets their own class's window on a shared stage check", () => {
  test("a stage check offers Set for my class; an exam stays the course's, read-only", async ({ page }) => {
    await open(page, "teacher");
    await expect(stageRow(page).getByRole("button", { name: "Set for my class" })).toBeVisible();
    const exam = page.locator("[data-assessment]").filter({ hasText: /Examination/ }).first();
    await expect(exam.getByRole("button", { name: "Set window" })).toHaveAttribute("aria-disabled", "true");
    await expect(exam.getByRole("button", { name: "Set for my class" })).toHaveCount(0);
  });

  test("the dialog says what each class has, needs a reason, and sends an empty field as the course's", async ({ page }) => {
    const served = await open(page, "teacher");
    const dialog = await openForMyClass(page);
    await expect(dialog).toContainText("moon checks follow it");
    await expect(dialog.locator("[data-class-row]").first()).toContainText("the course's");
    const save = dialog.getByRole("button", { name: "Save for this class" });
    await expect(save).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Use the course's" }), "nothing to clear yet").toBeDisabled();
    await dialog.getByLabel("Closes").fill("2026-11-20T17:00");
    await dialog.getByLabel("Reason").fill("Our class meets on Thursdays");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole("status").filter({ hasText: /window saved for/ })).toBeVisible();
    expect(served.puts).toHaveLength(1);
    const b = served.puts[0]!.body;
    expect(b.opensAt).toBeNull();
    expect(b.attemptsAllowed).toBeNull();
    expect(typeof b.closesAt).toBe("string");
    expect(b.reason).toBe("Our class meets on Thursdays");
  });

  test("a class with its own window says so on the row, and Use the course's clears all three", async ({ page }) => {
    const served = await open(page, "teacher", { own: true });
    await expect(stageRow(page).locator("[data-class-windows]")).toContainText("1 class has its own");
    const dialog = await openForMyClass(page);
    await expect(dialog.getByLabel("Attempts allowed")).toHaveValue("7");
    await expect(dialog.locator("[data-class-row]").first()).toContainText("own:");
    await dialog.getByLabel("Reason").fill("back to the course's dates");
    await dialog.getByRole("button", { name: "Use the course's" }).click();
    await expect(page.getByRole("status").filter({ hasText: /back on the course's window/ })).toBeVisible();
    expect(served.puts[0]!.body).toMatchObject({ opensAt: null, closesAt: null, attemptsAllowed: null });
  });

  test("a refusal keeps the dialog open with the server's sentence and the reason", async ({ page }) => {
    await open(page, "teacher", { fail: true });
    const dialog = await openForMyClass(page);
    await dialog.getByLabel("Attempts allowed").fill("2");
    await dialog.getByLabel("Reason").fill("fewer tries");
    await dialog.getByRole("button", { name: "Save for this class" }).click();
    await expect(dialog.getByRole("alert")).toContainText("cannot go below");
    await expect(dialog.getByLabel("Reason")).toHaveValue("fewer tries");
  });
});

test.describe("the admin reads the class windows and sets none (instructor, 15 Oct 2026)", () => {
  test("Class windows… opens the list read-only, with no Save", async ({ page }) => {
    await open(page, "admin");
    const dialog = await openAsAdmin(page);
    await expect(dialog.locator("[data-class-window-readonly]")).toContainText("own teacher");
    await expect(dialog.getByRole("button", { name: "Save for this class" })).toHaveCount(0);
  });
});

/* ===================================================== the six assertions */

const STATES: Array<{ name: string; who: Persona; opts: Opts; dialog: "none" | "teacher" | "admin" }> = [
  { name: "teacher, a class with its own window", who: "teacher", opts: { own: true }, dialog: "none" },
  { name: "teacher, the class window dialog", who: "teacher", opts: { own: true }, dialog: "teacher" },
  { name: "admin, read-only class windows", who: "admin", opts: {}, dialog: "admin" },
];

async function reach(page: Page, s: (typeof STATES)[number]): Promise<string> {
  await open(page, s.who, s.opts);
  if (s.dialog === "teacher") await openForMyClass(page);
  if (s.dialog === "admin") await openAsAdmin(page);
  return s.dialog === "none" ? "main" : "[role=dialog]";
}

test.describe("the gate, on the states 5.10 adds", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    for (const s of STATES) {
      await reach(page, s);
      expect(await clippedElements(page), s.name).toEqual([]);
    }
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const s of STATES) {
      await reach(page, s);
      expect(await horizontalOverflow(page), s.name).toBeLessThanOrEqual(0);
    }
  });
  test("3 · every control is reachable from the keyboard alone, and focus comes home", async ({ page }) => {
    test.setTimeout(180_000);
    for (const s of STATES) {
      const scope = await reach(page, s);
      expect(await unreachableByKeyboard(page, scope), s.name).toEqual([]);
    }
    await open(page, "teacher");
    const button = stageRow(page).getByRole("button", { name: "Set for my class" });
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await expect(button, "focus came home to Set for my class").toBeFocused();
  });
  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    const failures: string[] = [];
    for (const s of STATES) {
      await reach(page, s);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${s.name}: ${f}`));
      }
    }
    expect(failures).toEqual([]);
  });
  test("5 · the token system is what actually rendered", async ({ page }) => {
    for (const s of STATES) {
      await reach(page, s);
      expect(await offTokenStyles(page), s.name).toEqual([]);
    }
  });
  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const s of STATES) {
      await recordMotion(page).catch(() => undefined);
      await reach(page, s);
      const moving = (await recordedMotion(page)).filter((m) => m.ms > 1);
      expect(moving, `${s.name}: under reduced motion nothing may animate`).toEqual([]);
    }
  });
  test("captures: the row note and both dialogs, at this width", async ({ page }, info) => {
    const w = info.project.name.includes("380") ? "-380" : "";
    for (const [s, file] of [[STATES[0]!, "current-class-note"], [STATES[1]!, "current-class-window"], [STATES[2]!, "current-class-readonly"]] as const) {
      await reach(page, s);
      if (s.dialog === "none") await stageRow(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `design/templates/console/assessments/${file}${w}.png` });
    }
    // The footer is reached by scrolling the dialog (max-h 85vh), never cut off.
    await reach(page, STATES[1]!);
    const save = page.getByRole("dialog").getByRole("button", { name: "Save for this class" });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await page.screenshot({ path: `design/templates/console/assessments/current-class-window-foot${w}.png` });
  });
});
