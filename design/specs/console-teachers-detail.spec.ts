import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { ADMIN_ID, TEACHERS } from "./_teachers-fixture";

/**
 * `/teachers/:key`: the admin's page for one teacher (T1, 7 Oct 2026).
 * `design/templates/console/teachers-detail/SPEC.md` owns the decisions.
 * Served from the fixture, every write answered here; the API half is
 * `services/api/test/teachers-api.spec.ts`.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function token(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub, email: `${role}@fixture.test`, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role } });
  return `${header}.${payload}.${createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}

const ADMIN = token(ADMIN_ID, "admin");
const TEACHER = token("dddddddd-0000-4000-8000-000000000001", "teacher");
const wide = () => test.info().project.name === "desktop-1440";

const OSMENA = TEACHERS.teachers[1]!;
const UNCLAIMED = TEACHERS.teachers[2]!;
const ENDED = {
  id: "c1a00000-0000-4000-8000-000000000004", sectionId: TEACHERS.sections[2]!.id, sectionCode: "BSCPE-4A", subjectCode: "CPE 412",
  term: "2025-2", bookId: "b00c0000-0000-4000-8000-000000000010",
  bookLabel: "Computer Organization and Architecture: Designing for Performance, 10th ed.", students: 40, endedAt: "2026-05-30T00:00:00.000Z",
};

function detailOf(key: string) {
  if (key === encodeURIComponent(OSMENA.key) || key === OSMENA.key) {
    return {
      teacher: { ...OSMENA, classes: [...OSMENA.classes, ENDED] },
      stats: { classes: 2, students: 74, tokensThisMonth: 48210, costThisMonth: 0.42 },
      usage: [
        { month: "2026-09", engine: "groq", tokensIn: 120400, tokensOut: 30210, costUsd: 0 },
        { month: "2026-10", engine: "claude_api", tokensIn: 30100, tokensOut: 9110, costUsd: 0.42 },
        { month: "2026-10", engine: "groq", tokensIn: 7000, tokensOut: 2000, costUsd: 0 },
      ],
      sections: TEACHERS.sections, subjects: TEACHERS.subjects,
    };
  }
  if (decodeURIComponent(key) === UNCLAIMED.key) {
    return { teacher: UNCLAIMED, stats: { classes: 0, students: 0, tokensThisMonth: 0, costThisMonth: 0 }, usage: [], sections: TEACHERS.sections, subjects: TEACHERS.subjects };
  }
  return null;
}

interface Writes { classes: Array<{ id: string; body: Record<string, unknown> }>; status: Array<Record<string, unknown>> }

async function openDetail(page: Page, key: string, as = ADMIN): Promise<Writes> {
  const writes: Writes = { classes: [], status: [] };
  await page.route("**/api/v1/console/teachers/**", async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1/console/teachers/", "");
    if (req.method() === "GET") {
      const d = detailOf(path);
      return route.fulfill(d
        ? { status: 200, contentType: "application/json", body: JSON.stringify(d) }
        : { status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "That teacher does not exist." } }) });
    }
    writes.status.push(req.postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/v1/console/classes**", async (route: Route) => {
    writes.classes.push({ id: new URL(route.request().url()).pathname.split("/").pop()!, body: route.request().postDataJSON() as Record<string, unknown> });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "x" }) });
  });
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), as);
  await page.goto(`${CONSOLE_URL}/teachers/${encodeURIComponent(key)}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 20_000 });
  return writes;
}

async function openEnd(page: Page) {
  await page.getByRole("button", { name: "Actions for BSCPE-2A · CPE 412, 2026-1" }).click();
  await page.getByRole("menuitem", { name: /end class/i }).click();
  await page.getByRole("dialog").waitFor();
}

test.describe("/teachers/:key — SPEC.md", () => {
  test("a teacher is told it is the admin's", async ({ page }) => {
    await openDetail(page, OSMENA.key, TEACHER);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/admin's/i);
  });

  test("the record: header, four numbers, live classes before ended ones, AI use by month", async ({ page }) => {
    await openDetail(page, OSMENA.key);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fixture Teacher Osmeña");
    await expect(page.locator("[data-teacher-header]")).toContainText("EMP-0102");
    await expect(page.getByRole("region", { name: "At a glance" })).toContainText("48,210");
    const rows = page.locator("[data-class]");
    await expect(rows).toHaveCount(3);
    await expect(rows.last()).toHaveAttribute("data-ended", "");
    await expect(rows.last()).toContainText(/ended/);
    // A table at sm and up, a list below: whichever is shown carries the totals.
    const usage = page.getByRole(wide() ? "table" : "list", { name: wide() ? undefined : "AI use by month" });
    await expect(usage).toContainText("claude_api");
    await expect(usage).toContainText("$0.42");
  });

  test("an unclaimed roster row: no classes, no AI use, said in words", async ({ page }) => {
    await openDetail(page, UNCLAIMED.key);
    await expect(page.locator("main")).toContainText(/once they claim their account/);
    await expect(page.locator("[data-usage-empty]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Assign class" })).toHaveCount(0);
  });

  test("an unknown key is 'No such teacher', with the way back", async ({ page }) => {
    await openDetail(page, "employee:NOPE-1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No such teacher");
    await expect(page.getByRole("link", { name: "Back to Teachers" })).toHaveAttribute("href", "/teachers");
  });

  test("ending a class needs a reason and sends ended: true", async ({ page }) => {
    const writes = await openDetail(page, OSMENA.key);
    await openEnd(page);
    const d = page.getByRole("dialog");
    await expect(d.getByRole("button", { name: "End class" })).toBeDisabled();
    await d.getByLabel("Reason (required)").fill("Section merged");
    await d.getByRole("button", { name: "End class" }).click();
    await expect(d).toBeHidden();
    expect(writes.classes).toEqual([{ id: "c1a00000-0000-4000-8000-000000000002", body: { reason: "Section merged", ended: true } }]);
  });

  test("capture: current, current-380 and the end dialog, then opened", async ({ page }) => {
    const s = wide() ? "" : "-380";
    const dir = "design/templates/console/teachers-detail";
    await page.setViewportSize({ width: wide() ? 1440 : 380, height: wide() ? 1100 : 844 });
    await openDetail(page, OSMENA.key);
    await page.screenshot({ path: `${dir}/current${s}.png`, fullPage: true });
    await openEnd(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-end${s}.png` });
    const p2 = await page.context().newPage();
    await p2.setViewportSize({ width: wide() ? 1440 : 380, height: wide() ? 900 : 844 });
    await openDetail(p2, UNCLAIMED.key);
    await p2.screenshot({ path: `${dir}/current-unclaimed${s}.png` });
    await p2.close();
  });
});

type Screen = [string, (page: Page) => Promise<unknown>];
const SCREENS: Screen[] = [
  ["record", (p) => openDetail(p, OSMENA.key)],
  ["end dialog", async (p) => { await openDetail(p, OSMENA.key); await openEnd(p); }],
  ["unclaimed", (p) => openDetail(p, UNCLAIMED.key)],
  ["unknown", (p) => openDetail(p, "employee:NOPE-1")],
  ["forbidden", (p) => openDetail(p, OSMENA.key, TEACHER)],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, /teachers/:key", () => {
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
    await openDetail(page, OSMENA.key);
    expect(await unreachableByKeyboard(page, "main"), "record").toEqual([]);
    await openEnd(page);
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "end dialog").toEqual([]);
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
    await recordMotion(page);
    await openDetail(page, OSMENA.key);
    await openEnd(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms >= 100).length, "a dialog should ease in").toBeGreaterThan(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDetail(page, OSMENA.key);
    await openEnd(page);
    await page.waitForTimeout(600);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "detail").toEqual([]);
  });
});
