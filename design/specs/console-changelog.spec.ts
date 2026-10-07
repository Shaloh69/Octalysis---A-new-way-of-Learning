import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * `/changelog` (console): what changed, day by day, and how far the whole
 * system is (instructor, 7 Oct 2026, night). `design/templates/console/changelog/SPEC.md`.
 *
 * The build-time half is the committed `apps/console/src/generated/changelog.json`
 * (`pnpm changelog`), read here too so the page is held to it. The live half,
 * course readiness, is answered by fixtures: one with a condition failing,
 * one with every measured condition holding, and one that fails to load.
 * `services/api/test/progress.spec.ts` holds the route itself.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const DATA = JSON.parse(readFileSync("apps/console/src/generated/changelog.json", "utf8")) as {
  madeAt: { commit: string };
  updates: Array<{ date: string; commits: unknown[] }>;
  phases: { done: number; total: number; pct: number; redesign: Array<{ id: string }>; build: Array<{ id: string }> };
  roadmap: { next: Array<{ id: string }>; owed: string[] };
};

function token(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub, email: `${role}@fixture.test`, aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role },
  });
  return `${header}.${payload}.${createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}
const TEACHER = token("dddddddd-0000-4000-8000-000000000002", "teacher");
const wide = () => test.info().project.name === "desktop-1440";

const cond = (id: string, how: string, ok: boolean | null, label: string, detail: string) => ({ id, how, ok, label, detail });
const progress = (ready: boolean) => ({
  checkedAt: "2026-10-07T12:00:00.000Z",
  prelim: {
    stages: ["00", "01", "02", "03", "04"].map((id) => ({ id, title: `Stage ${id}`, authoring: "authored" })),
    act1: ready ? { live: 96, bank: 96, review: 0, draft: 0 } : { live: 13, bank: 96, review: 83, draft: 0 },
    invariants: { failures: 0, warnings: 3 },
    conditions: [
      cond("stages", "measured", true, "Stages 00-04 authored and readable", "5 of 5 authored"),
      cond("items", "measured", ready, "Act 1's questions approved to live", ready ? "96 of 96 live; 0 at review, 0 draft" : "13 of 96 live; 83 at review, 0 draft"),
      cond("fill", "test", ready, "The Prelim and the four stage checks fill", ready ? "the authored bank is live" : "not until act 1's bank is live"),
      cond("student", "person", null, "A real student reads a stage, sits its check, and sees the next unlock", "checked by a person on the deployment; not measured here"),
      cond("invariants", "measured", true, "The database's invariants are clean", "0 failures, 3 warnings"),
    ],
    measuredOk: ready,
  },
});
const CONTENT = {
  stages: [],
  summary: {
    total: 19, authored: 8, planned: 11, empty: 0, objectives: 120, liveItems: 13, itemTarget: 720, consoleEdited: 0,
    chapters: { draft: 6, approved: 0, sentBack: 0 }, figures: { waiting: 17, approved: 0 },
    summaries: { draft: 19, approved: 0, sentBack: 0, none: 0 },
  },
};

async function openChangelog(page: Page, opts: { ready?: boolean; fail?: boolean } = {}): Promise<void> {
  const ok = (json: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/v1/console/progress", (r: Route) =>
    r.fulfill(opts.fail
      ? { status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "The database did not answer." } }) }
      : ok(progress(opts.ready ?? false))));
  await page.route("**/api/v1/console/content", (r: Route) => r.fulfill(ok(CONTENT)));
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  await page.goto(`${CONSOLE_URL}/changelog`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Changelog", level: 1 }).waitFor({ timeout: 20_000 });
  if (opts.fail) await page.getByRole("alert").waitFor();
  else await page.locator("[data-readiness]").waitFor();
}

test.describe("/changelog — SPEC.md", () => {
  test("names the commit it was made at, and every phase the files hold", async ({ page }) => {
    await openChangelog(page);
    await expect(page.locator("main")).toContainText(`Made at commit ${DATA.madeAt.commit}`);
    await expect(page.locator(".cg-big")).toContainText(`${DATA.phases.done} of ${DATA.phases.total} steps done (${DATA.phases.pct}%)`);
    await expect(page.locator("[data-phase]")).toHaveCount(DATA.phases.redesign.length);
    await expect(page.locator("[data-build]")).toHaveCount(DATA.phases.build.length);
    await expect(page.locator("[data-next]")).toHaveCount(DATA.roadmap.next.length);
    await expect(page.locator(".cg-owed li")).toHaveCount(DATA.roadmap.owed.length);
  });

  test("every day that shipped is listed, and its changes open on demand", async ({ page }) => {
    await openChangelog(page);
    await expect(page.locator("[data-day]")).toHaveCount(DATA.updates.length);
    const first = DATA.updates[0]!;
    const day = page.locator(`[data-day="${first.date}"]`);
    const toggle = day.getByRole("button", { name: new RegExp(`All ${first.commits.length} change`) });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(day.locator(".cg-commits li")).toHaveCount(first.commits.length);
  });

  test("the Prelim sentence follows the measured conditions, and never rounds up", async ({ page }) => {
    await openChangelog(page, { ready: false });
    await expect(page.locator("[data-prelim]")).toHaveText(/not yet okay to run on students/);
    await expect(page.locator('[data-condition="items"]')).toContainText("Not yet");
    await expect(page.locator('[data-condition="student"]')).toContainText("A person checks");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openChangelog(page, { ready: true });
    await expect(page.locator("[data-prelim]")).toHaveText(/One is checked by a person/);
    await expect(page.locator("[data-prelim]")).not.toHaveText(/not yet/);
  });

  test("a failed readiness says so with Try again, and the rest of the page stands", async ({ page }) => {
    await openChangelog(page, { fail: true });
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("[data-phase]")).toHaveCount(DATA.phases.redesign.length);
    await expect(page.locator("[data-day]")).toHaveCount(DATA.updates.length);
  });

  test("the nav offers Changelog, and the index stands beside the column only at 1440", async ({ page }) => {
    await openChangelog(page);
    if (!wide()) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Console sections" }).getByRole("link", { name: "Changelog" })).toBeVisible();
    if (!wide()) await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(wide() ? 1 : 0);
  });

  test("capture: current and current-380, then opened", async ({ page }) => {
    const s = wide() ? "" : "-380";
    await page.setViewportSize({ width: wide() ? 1440 : 380, height: wide() ? 2400 : 844 });
    await openChangelog(page);
    await page.locator(`[data-day="${DATA.updates[0]!.date}"]`).getByRole("button").click();
    // <main> is the scroller at lg (apps/console/CLAUDE.md): a full capture needs
    // a viewport as tall as its content, and main back at its top.
    if (wide()) {
      const h = await page.locator("main").evaluate((m) => { m.scrollTop = 0; return m.scrollHeight; });
      await page.setViewportSize({ width: 1440, height: Math.min(h + 40, 9000) });
    }
    await page.evaluate(() => { document.querySelector("main")!.scrollTop = 0; window.scrollTo(0, 0); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `design/templates/console/changelog/current${s}.png`, fullPage: true });
  });
});

type Screen = [string, (page: Page) => Promise<unknown>];
const SCREENS: Screen[] = [
  ["not yet", async (p) => {
    await openChangelog(p);
    await p.locator(`[data-day="${DATA.updates[0]!.date}"]`).getByRole("button").click();
  }],
  ["ready", (p) => openChangelog(p, { ready: true })],
  ["failed", (p) => openChangelog(p, { fail: true })],
];

test.describe("the gate — CONSOLE-REVAMP.md §2, /changelog", () => {
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
    await openChangelog(page);
    expect(await unreachableByKeyboard(page, "main"), "changelog").toEqual([]);
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
    // Positive control: with motion allowed, hovering a disclosure eases its background.
    await recordMotion(page);
    await openChangelog(page);
    const toggle = page.locator(".cg-toggle").first();
    await toggle.hover();
    await page.waitForTimeout(400);
    expect((await recordedMotion(page)).filter((m) => m.ms >= 100).length, "the toggle should ease").toBeGreaterThan(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openChangelog(page);
    await page.locator(".cg-toggle").first().hover();
    await page.locator(".cg-toggle").first().click();
    await page.waitForTimeout(400);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1), "changelog").toEqual([]);
  });
});
