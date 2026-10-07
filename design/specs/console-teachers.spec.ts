import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { ADMIN_ID, PASTE, PLAN, TEACHERS } from "./_teachers-fixture";

/**
 * `/teachers`: the admin's page of every teacher (T1, 7 Oct 2026).
 * `design/templates/console/teachers/SPEC.md` owns the decisions.
 *
 * THE LIST IS THE FIXTURE AND EVERY WRITE IS ANSWERED HERE. The local seed has
 * no teacher roster, and a spec must not disable a teacher or assign a class
 * for real. The API half (who may call each route, what each write does) is
 * `services/api/test/teachers-api.spec.ts`, against the real database.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function token(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub, email: `${role}@fixture.test`, aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role },
  });
  return `${header}.${payload}.${createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}

const ADMIN = token(ADMIN_ID, "admin");
const TEACHER = token("dddddddd-0000-4000-8000-000000000001", "teacher");
const wide = () => test.info().project.name === "desktop-1440";

type Body = Record<string, unknown>;
interface Writes { imports: Body[]; status: Body[]; classes: Body[] }

async function openTeachers(page: Page, opts: { as?: string; failWrites?: boolean } = {}): Promise<Writes> {
  const writes: Writes = { imports: [], status: [], classes: [] };
  const fail = { status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }) };
  const ok = (json: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(json) });

  await page.route("**/api/v1/console/teachers**", async (route: Route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "GET") return route.fulfill(ok(TEACHERS));
    const body = req.postDataJSON() as Body;
    if (url.endsWith("/import")) {
      writes.imports.push(body);
      return route.fulfill(opts.failWrites && body.apply ? fail : ok(body.apply ? { ...PLAN, dryRun: false } : PLAN));
    }
    if (url.endsWith("/status")) {
      writes.status.push(body);
      return route.fulfill(opts.failWrites ? fail : ok({ ok: true, active: body.active }));
    }
    return route.abort();
  });
  await page.route("**/api/v1/console/classes**", async (route: Route) => {
    writes.classes.push(route.request().postDataJSON() as Body);
    return route.fulfill(opts.failWrites ? fail : { status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, id: "c1a00000-0000-4000-8000-0000000000ff" }) });
  });

  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), opts.as ?? ADMIN);
  await page.goto(`${CONSOLE_URL}/teachers`, { waitUntil: "domcontentloaded" });
  if ((opts.as ?? ADMIN) === ADMIN) await page.locator("[data-teacher]").first().waitFor({ timeout: 20_000 });
  else await page.getByRole("heading", { name: /admin's/i }).waitFor({ timeout: 20_000 });
  return writes;
}

const nav = async (page: Page) => {
  if (!wide()) await page.getByRole("button", { name: "Open menu" }).click();
  return page.getByRole("navigation", { name: "Console sections" });
};

async function openMenuFor(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menu").waitFor();
}

async function openDisable(page: Page): Promise<void> {
  await openMenuFor(page, "Fixture Teacher Osmeña");
  await page.getByRole("menuitem", { name: /disable/i }).click();
  await page.getByRole("dialog").waitFor();
}

async function openPreview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Import roster" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Teachers", { exact: true }).fill(PASTE);
  await d.getByRole("button", { name: "Preview" }).click();
  await d.locator("[data-plan-row]").first().waitFor();
}

async function openAssign(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Assign BSCPE-2B · CPE 412, 2026-2/ }).click();
  await page.getByRole("dialog").waitFor();
}

test.describe("/teachers — SPEC.md", () => {
  test("a teacher is told it is the admin's, and the nav does not offer it", async ({ page }) => {
    await openTeachers(page, { as: TEACHER });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/admin's/i);
    await expect(page.locator("[data-teacher]")).toHaveCount(0);
    await expect((await nav(page)).getByRole("link", { name: "Teachers" })).toHaveCount(0);
  });

  test("the admin sees every teacher, the counts, their own row, and the nav item", async ({ page }) => {
    await openTeachers(page);
    await expect((await nav(page)).getByRole("link", { name: "Teachers" })).toHaveAttribute("href", "/teachers");
    if (!wide()) await page.keyboard.press("Escape");
    await expect(page.locator("[data-teacher-counts]")).toHaveText("5 teachers · 3 active · 1 not yet claimed · 1 disabled");
    await expect(page.locator("[data-teacher]")).toHaveCount(5);
    await expect(page.locator(`[data-teacher="${ADMIN_ID}"]`)).toContainText("Admin");
    await expect(page.locator(`[data-teacher="${ADMIN_ID}"]`)).toContainText("BSCPE-4A · CPE 412");
    await expect(page.getByRole("heading", { name: "Classes nobody holds yet" })).toBeVisible();
  });

  test("the filters narrow the list, with counts on the buttons", async ({ page }) => {
    await openTeachers(page);
    await page.getByRole("button", { name: /Not yet claimed/ }).click();
    await expect(page.locator("[data-teacher]")).toHaveCount(1);
    await page.getByRole("button", { name: /^All/ }).click();
    await page.getByLabel("Search the teachers").fill("osmena");
    await expect(page.locator("[data-teacher]")).toHaveCount(1);
  });

  test("an admin's row and your own offer no Disable", async ({ page }) => {
    await openTeachers(page);
    await openMenuFor(page, "Fixture Admin");
    await expect(page.getByRole("menuitem", { name: /disable/i })).toHaveCount(0);
  });

  test("disable needs a reason and the employee ID typed back, and sends exactly that", async ({ page }) => {
    const writes = await openTeachers(page);
    await openDisable(page);
    const d = page.getByRole("dialog");
    const go = d.getByRole("button", { name: /^Disable Fixture Teacher Osmeña/ });
    await expect(go).toBeDisabled();
    await d.getByLabel("Reason (required)").fill("Left the department");
    await expect(go).toBeDisabled();
    await d.getByLabel(/Type the employee ID/).fill("EMP-0102");
    await expect(go).toBeEnabled();
    await go.click();
    await expect(d).toBeHidden();
    expect(writes.status).toEqual([{ active: false, reason: "Left the department", confirm: "EMP-0102" }]);
  });

  test("the import previews the plan, row by row, before anything is written", async ({ page }) => {
    const writes = await openTeachers(page);
    await openPreview(page);
    const d = page.getByRole("dialog");
    await expect(d.locator("[data-plan-summary]")).toHaveText("1 new · 0 will change · 0 unchanged · 3 not imported");
    await expect(d.locator('[data-plan-row="EMP-0102"]')).toContainText(/never overwritten/);
    expect(writes.imports.map((w) => w.apply)).toEqual([false]);
    await d.getByRole("button", { name: "Import 1 row" }).click();
    await expect(d).toBeHidden();
    expect(writes.imports.map((w) => w.apply)).toEqual([false, true]);
  });

  test("an unassigned class opens the assign dialog preset, and sends its section and term", async ({ page }) => {
    const writes = await openTeachers(page);
    await openAssign(page);
    const d = page.getByRole("dialog");
    await expect(d.getByLabel("Section")).toHaveValue("5ec7f1a0-0000-4000-8000-00000000002b");
    await expect(d.getByLabel("Term")).toHaveValue("2026-2");
    await d.getByLabel("Teacher").selectOption({ label: "Fixture Teacher Osmeña" });
    await d.getByLabel("Book").selectOption("b00c0000-0000-4000-8000-000000000010"); // the 10th edition
    await d.getByLabel("Reason (required)").fill("Second semester load");
    await d.getByRole("button", { name: "Assign class" }).click();
    await expect(d).toBeHidden();
    expect(writes.classes[0]).toMatchObject({
      sectionId: "5ec7f1a0-0000-4000-8000-00000000002b", subjectCode: "CPE 412", term: "2026-2",
      teacherId: "bbbbbbbb-0000-4000-8000-0000000000b1", bookId: "b00c0000-0000-4000-8000-000000000010",
    });
  });

  test("a write that fails says so and keeps the dialog open", async ({ page }) => {
    await openTeachers(page, { failWrites: true });
    await openDisable(page);
    const d = page.getByRole("dialog");
    await d.getByLabel("Reason (required)").fill("Left the department");
    await d.getByLabel(/Type the employee ID/).fill("EMP-0102");
    await d.getByRole("button", { name: /^Disable/ }).click();
    await expect(d.getByRole("alert")).toContainText(/not saved/i);
    await expect(d).toBeVisible();
  });

  test("capture: current, current-380 and every dialog, then opened", async ({ page }) => {
    const s = wide() ? "" : "-380";
    const dir = "design/templates/console/teachers";
    await page.setViewportSize({ width: wide() ? 1440 : 380, height: wide() ? 1100 : 844 });
    await openTeachers(page);
    await page.screenshot({ path: `${dir}/current${s}.png`, fullPage: true });
    await openMenuFor(page, "Fixture Teacher Osmeña");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/current-menu${s}.png` });
    await page.keyboard.press("Escape");
    await openPreview(page);
    await page.waitForTimeout(500); // past the dialog's ease-in: a capture mid-fade looks translucent
    await page.screenshot({ path: `${dir}/current-import${s}.png` });
    await page.keyboard.press("Escape");
    await openDisable(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-disable${s}.png` });
    await page.keyboard.press("Escape");
    await openAssign(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-assign${s}.png` });
    await page.keyboard.press("Escape");
    const p2 = await page.context().newPage();
    await openTeachers(p2, { as: TEACHER });
    await p2.screenshot({ path: `${dir}/current-forbidden${s}.png` });
    await p2.close();
  });
});

type Screen = [string, (page: Page) => Promise<unknown>];
const SCREENS: Screen[] = [
  ["list", (p) => openTeachers(p)],
  ["import preview", async (p) => { await openTeachers(p); await openPreview(p); }],
  ["disable", async (p) => { await openTeachers(p); await openDisable(p); }],
  ["assign", async (p) => { await openTeachers(p); await openAssign(p); }],
  ["forbidden", (p) => openTeachers(p, { as: TEACHER })],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, /teachers", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await clippedElements(page), name).toEqual([]);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await horizontalOverflow(page), name).toBeLessThanOrEqual(0);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openTeachers(page);
    expect(await unreachableByKeyboard(page, "main"), "list").toEqual([]);
    await openDisable(page);
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "disable").toEqual([]);
    await page.keyboard.press("Escape");
    await openAssign(page);
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "assign").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(180_000);
    const failures: string[] = [];
    for (const [name, open] of SCREENS) {
      await open(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${name}: ${f}`));
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    for (const [name, open] of SCREENS) {
      await open(page);
      expect(await offTokenStyles(page), name).toEqual([]);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // Positive control: with motion allowed, opening a dialog animates.
    await recordMotion(page);
    await openTeachers(page);
    await openDisable(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms >= 100).length, "a dialog should ease in").toBeGreaterThan(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTeachers(page);
    await openDisable(page);
    await page.keyboard.press("Escape");
    await openPreview(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "teachers").toEqual([]);
  });
});
