import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * T2: a teacher holds their own classes (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5; the states are in
 * `design/templates/console/class-scope/SPEC.md`). The DATA half is `services/api/test/class-scope-*.spec.ts`
 * (1,000-odd denial tests, through RLS and through the API). This file holds the PAGE half, against the real
 * local API and the demo database (`db/demo-seed.sql`):
 *
 *   teacher  the demo teacher, who holds BSCPE - 4 and sees it whole
 *   none     a teacher who holds NO class: every page about students says so, and is never blank
 *   admin    the admin, who holds nothing here and so reads BSCPE - 4 and changes none of it
 *
 * Nothing is written: every check reads, or presses a control to see that it is refused on the page.
 * The six assertions of the gate run on the two NEW states (no class; read-only) at 1440 and 380.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

const WHO = {
  teacher: "dddddddd-0000-4000-8000-000000000001",
  none: "eeeeeeee-0000-4000-8000-000000000001",
  admin: "eeeeeeee-0000-4000-8000-000000000002",
} as const;
type Persona = keyof typeof WHO;
/** Kristine Joy Montebon, a demo student of BSCPE - 4. */
const STUDENT = "dddddddd-1111-4000-8000-000000000006";

function token(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, email: "demo@example.com", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role } });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

async function open(page: Page, who: Persona, route: string, ready: string): Promise<void> {
  const t = token(WHO[who], who === "admin" ? "admin" : "teacher");
  await page.addInitScript((v) => localStorage.setItem("octa:dev-token", v), t);
  await page.goto(`${CONSOLE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.locator(ready).first().waitFor({ timeout: 20_000 });
}

/** The states the gate walks: where each is, and the element that says the page has decided. */
const STATES: Array<{ name: string; who: Persona; route: string; ready: string }> = [
  { name: "no class: Students", who: "none", route: "/students", ready: "[data-no-class]" },
  { name: "no class: Locks", who: "none", route: "/locks", ready: "[data-no-class]" },
  { name: "no class: Gradebook", who: "none", route: "/gradebook", ready: "[data-no-class]" },
  { name: "no class: Submissions", who: "none", route: "/submissions", ready: "[data-no-class]" },
  { name: "read-only: Students (admin)", who: "admin", route: "/students", ready: "[data-read-only]" },
  { name: "read-only: a record (admin)", who: "admin", route: `/students/${STUDENT}`, ready: "[data-record-facts]" },
  { name: "read-only: Assessments (teacher)", who: "teacher", route: "/assessments", ready: "[data-counts]" },
];

test.describe("the gate, on the two states T2 adds", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    test.setTimeout(240_000);
    for (const s of STATES) {
      await open(page, s.who, s.route, s.ready);
      expect(await clippedElements(page), s.name).toEqual([]);
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    test.setTimeout(240_000);
    for (const s of STATES) {
      await open(page, s.who, s.route, s.ready);
      expect(await horizontalOverflow(page), s.name).toBeLessThanOrEqual(0);
    }
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    test.setTimeout(300_000);
    for (const s of STATES) {
      await open(page, s.who, s.route, s.ready);
      expect(await unreachableByKeyboard(page, "main"), s.name).toEqual([]);
    }
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(420_000);
    const failures: string[] = [];
    for (const s of STATES) {
      await open(page, s.who, s.route, s.ready);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} ${s.name}: ${f}`));
      }
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    test.setTimeout(240_000);
    for (const s of STATES) {
      await open(page, s.who, s.route, s.ready);
      expect(await offTokenStyles(page), s.name).toEqual([]);
    }
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const s of STATES) {
      await recordMotion(page).catch(() => undefined);
      await open(page, s.who, s.route, s.ready);
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      const moving = (await recordedMotion(page)).filter((m) => m.ms > 1);
      expect(moving, `${s.name}: under reduced motion nothing may animate`).toEqual([]);
    }
  });
});

test.describe("a teacher who holds no class: a clear empty state, never a blank page", () => {
  for (const [route, what] of [
    ["/students", "Your students"],
    ["/locks", "The lock matrix of your students"],
    ["/gradebook", "Your students' grades"],
    ["/submissions", "The labs, project and participation"],
  ] as const) {
    test(`${route} says so, and offers the way to get one`, async ({ page }) => {
      await open(page, "none", route, "[data-no-class]");
      const panel = page.locator("[data-no-class]");
      await expect(panel).toContainText("You don't hold a class yet");
      await expect(panel).toContainText(what);
      await expect(panel.getByRole("button", { name: "Import roster" }).or(panel.getByRole("link", { name: "Go to Students" })).first()).toBeVisible();
    });
  }

  test("/live cannot start a question, and says why", async ({ page }) => {
    await open(page, "none", "/live", "[data-question]");
    await expect(page.locator("[data-question-action]")).toBeDisabled();
    await expect(page.locator("[data-no-class]")).toContainText("You don't hold a class");
  });

  test("/assessments: New assessment is unavailable until they hold a class, with the reason", async ({ page }) => {
    await open(page, "none", "/assessments", "[data-counts]");
    const make = page.getByRole("button", { name: "New assessment" });
    await expect(make).toHaveAttribute("aria-disabled", "true");
    await expect(make).toHaveAttribute("title", /hold none yet/);
  });
});

test.describe("a class that can be read and not changed says so, and its controls are unavailable", () => {
  test("the admin reads BSCPE - 4: a padlock on every row, and Move is off while Deactivate (recovery) stays on", async ({ page }) => {
    await open(page, "admin", "/students", "[data-read-only]");
    const rows = page.locator("[data-student]");
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await page.locator("[data-student] [data-read-only]").count(), "every row of another teacher's class is marked").toBe(await rows.count());
    await page.getByRole("button", { name: /^Actions for / }).first().click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /move to section/i })).toHaveAttribute("data-disabled", "");
    await expect(menu.getByRole("menuitem", { name: /deactivate/i })).not.toHaveAttribute("data-disabled", "");
    await expect(menu).toContainText("Another teacher holds this class");
  });

  test("the admin's record of a student in another teacher's class: Read-only, Move off, Reset password on", async ({ page }) => {
    await open(page, "admin", `/students/${STUDENT}`, "[data-record-facts]");
    await expect(page.locator("[data-record-facts] [data-read-only]")).toContainText("Read-only");
    await page.getByRole("button", { name: /^Actions for / }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /move to section/i })).toHaveAttribute("data-disabled", "");
    await expect(menu.getByRole("menuitem", { name: /reset password/i })).not.toHaveAttribute("data-disabled", "");
  });

  test("the teacher's own roster has no read-only mark at all", async ({ page }) => {
    await open(page, "teacher", "/students", "[data-student]");
    expect(await page.locator("[data-student] [data-read-only]").count()).toBe(0);
  });

  test("the admin's lock matrix: cells are shown and not pressable", async ({ page }) => {
    await open(page, "admin", "/locks", "[data-lock]");
    const cell = page.locator("button[data-lock][data-read-only]").first();
    await expect(cell).toHaveAttribute("aria-disabled", "true");
    await cell.click({ force: true });
    await expect(page.getByRole("dialog"), "a read-only cell opened the change dialog").toHaveCount(0);
  });

  test("the course's papers: a teacher reads them and cannot set their window; the admin can", async ({ page }) => {
    await open(page, "teacher", "/assessments", "[data-counts]");
    const setWindow = page.getByRole("button", { name: "Set window" }).first();
    await expect(setWindow).toHaveAttribute("aria-disabled", "true");
    await setWindow.click({ force: true });
    await expect(page.getByRole("dialog"), "a teacher opened the window dialog on the course's paper").toHaveCount(0);
    await open(page, "admin", "/assessments", "[data-counts]");
    await expect(page.getByRole("button", { name: "Set window" }).first()).not.toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("no lock for everyone: a teacher locks their own classes", () => {
  test("the add-an-override form offers the classes held, never 'Every student'", async ({ page }) => {
    await open(page, "teacher", "/locks", "[data-lock]");
    await page.getByRole("tab", { name: /Sections & schedules/ }).click();
    const to = page.getByLabel("Applies to");
    await expect(to).toBeVisible();
    const options = await to.locator("option").allTextContents();
    expect(options.join("|")).not.toMatch(/every student/i);
    expect(options).toContain("BSCPE - 4");
  });
});
