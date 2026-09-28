import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, OLDER_CURSOR, useFixture, type FixtureOpts } from "./_feedback-fixture";

/**
 * `/feedback`: what students report, worked down as a queue, each report once,
 * with the exact instance it was about.
 *
 * `PAGE-SPECS.md` §4.4 is the plan. Before the rebuild (29 Sep 2026) the page
 * was one list filtered by status only, capped at 300 rows with no count,
 * triaged one report at a time (the seed's "4 KB vs 8 KB" five times over),
 * offering neither severity nor "released in", showing none of what a report
 * carried, and rendering NOTHING where a variant was missing.
 *
 * Instructor rulings of that day: one queue (no "My feedback" until the
 * console can send feedback); status, severity and released in; server
 * filters, a count, Load older, a CSV; exact repeats grouped and triaged
 * together; SUS by role with its n. `design/templates/console/feedback/SPEC.md`.
 *
 * `console-live-feedback.spec.ts` keeps its three older `/feedback` tests
 * (a dense table, a row that expands in place one at a time, a SUS panel that
 * explains an empty score). This file does not repeat them.
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
const wide = (project: string) => project === "desktop-1440";
const ALL: FixtureOpts = { variant: true, sus: true, older: true };
const REPEATED = /hit-rate question says 4 KB/i;

async function openFeedback(page: Page, opts: FixtureOpts = ALL, query = "") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/feedback${query}`, { waitUntil: "domcontentloaded" });
  if (!opts.status && !opts.delayMs) await page.locator("[data-group]").first().waitFor({ timeout: 15_000 });
  return fx;
}

/** A group's row (1440) or card (380), found by its text. */
const group = (page: Page, text: RegExp | string) => page.locator("[data-group]").filter({ hasText: text });

async function openGroup(page: Page, text: RegExp | string) {
  const button = group(page, text).getByRole("button", { name: /^(Triage|Close)$/ });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  return page.locator("[data-detail]");
}

/* ================================================================ the gate */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: the queue, a group's detail with its variant, a repeated group", async ({ page }) => {
    await openFeedback(page);
    expect(await clippedElements(page), "the queue").toEqual([]);
    await openGroup(page, FIX.variantBody);
    expect(await clippedElements(page), "the variant").toEqual([]);
    await openGroup(page, REPEATED);
    expect(await clippedElements(page), "five reports").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openFeedback(page);
    expect(await horizontalOverflow(page), "the queue").toBeLessThanOrEqual(0);
    await openGroup(page, FIX.variantBody);
    expect(await horizontalOverflow(page), "the variant").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone, and Triage keeps focus", async ({ page }) => {
    await openFeedback(page);
    expect(await unreachableByKeyboard(page, "main"), "the queue").toEqual([]);
    const button = group(page, FIX.variantBody).getByRole("button", { name: "Triage", exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(group(page, FIX.variantBody).getByRole("button", { name: "Close", exact: true })).toBeFocused();
    expect(await unreachableByKeyboard(page, "main"), "detail open").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    await openFeedback(page);
    await openGroup(page, FIX.variantBody);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), theme).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openFeedback(page);
    await openGroup(page, FIX.variantBody);
    expect(await offTokenStyles(page)).toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, the detail eases open.
    await recordMotion(page);
    await openFeedback(page);
    await openGroup(page, FIX.variantBody);
    const moving = await motionStarted(page, "main");
    expect(moving.length, "with motion allowed, the detail should ease open").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-group]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openGroup(page, FIX.variantBody);
    await page.getByRole("button", { name: "Load older reports" }).click();
    await expect(page.locator("[data-group]").filter({ hasText: FIX.olderBody })).toBeVisible();
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================= the approved plan */

test.describe("one queue, filtered on the server", () => {
  test("one queue with no tabs, and Export CSV in the header", async ({ page }) => {
    await openFeedback(page);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  test("the status counts are the filter, pressed, and put the status in the address and the request", async ({ page }) => {
    const fx = await openFeedback(page);
    const statuses = page.getByRole("group", { name: "Status" });
    await expect(statuses.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
    // Seed: 5 question reports new, 4 flags triaged, 2 CSAT shipped; plus the fixture's variant and 2 older flags.
    await expect(statuses.getByRole("button", { name: /^New/ })).toContainText("8");
    await expect(statuses.getByRole("button", { name: /^Triaged/ })).toContainText("4");
    await expect(statuses.getByRole("button", { name: /^Shipped/ })).toContainText("2");
    await statuses.getByRole("button", { name: /^Triaged/ }).click();
    await expect(page).toHaveURL(/[?&]status=triaged/);
    await expect(statuses.getByRole("button", { name: /^Triaged/ })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => fx.reads.at(-1)?.searchParams.get("status")).toBe("triaged");
    await expect(page.locator("[data-group]")).toHaveCount(1);
    await expect(page.locator("[data-group]").first()).toContainText(/look like the same answer/i);
  });

  test("the kind filter narrows to one kind, in the address and the request", async ({ page }) => {
    const fx = await openFeedback(page);
    await page.getByLabel("Kind", { exact: true }).selectOption("csat");
    await expect(page).toHaveURL(/[?&]kind=csat/);
    await expect.poll(() => fx.reads.at(-1)?.searchParams.get("kind")).toBe("csat");
    await expect(page.locator("[data-group]")).toHaveCount(1);
    await expect(page.locator("[data-group]").first()).toContainText(/Satisfaction/);
  });

  test("the address is read on arrival, so a filtered view can be linked", async ({ page }) => {
    const fx = await openFeedback(page, ALL, "?status=shipped");
    expect(fx.reads[0]?.searchParams.get("status")).toBe("shipped");
    await expect(page.getByRole("group", { name: "Status" }).getByRole("button", { name: /^Shipped/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the result line counts groups and reports, in mono", async ({ page }) => {
    await openFeedback(page);
    const line = page.locator("[data-result]");
    // 3 seeded groups + the variant = 4 shown; + 2 older = 6 in all; 11 + 1 + 2 = 14 reports.
    await expect(line).toHaveText(/Showing 4 of 6 groups · 14 reports/);
    const fonts = await line.locator(".num").evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily));
    for (const f of fonts) expect(f).toMatch(/JetBrains Mono/);
  });

  test("Load older brings the next page in from the API's own cursor, then says it is the end", async ({ page }) => {
    const fx = await openFeedback(page);
    await page.getByRole("button", { name: "Load older reports" }).click();
    await expect(group(page, FIX.olderBody)).toBeVisible();
    expect(fx.reads.at(-1)?.searchParams.get("before")).toBe(OLDER_CURSOR);
    await expect(page.locator("[data-result]")).toHaveText(/Showing 6 of 6 groups/);
    await expect(page.getByRole("button", { name: "Load older reports" })).toHaveCount(0);
    await expect(page.locator("[data-end]")).toHaveText(/every report this filter matches/i);
  });
});

test.describe("exact repeats are one row, and each report is shown", () => {
  test("the five identical question reports are one row that says so", async ({ page }) => {
    await openFeedback(page);
    await expect(group(page, REPEATED)).toHaveCount(1);
    await expect(group(page, REPEATED)).toContainText(/reported 5 times/i);
  });

  test("its detail lists every report: who, their role, and when to the minute", async ({ page }) => {
    await openFeedback(page);
    const d = await openGroup(page, REPEATED);
    await expect(d.locator("[data-report]")).toHaveCount(5);
    const first = d.locator("[data-report]").first();
    await expect(first.locator("[data-fact=who]")).toHaveText(/\S+.*·\s*student/i);
    await expect(first.locator("[data-fact=when]")).toHaveText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/);
  });

  test("a question report without its variant says so, in words (INV-25)", async ({ page }) => {
    await openFeedback(page);
    const d = await openGroup(page, REPEATED);
    await expect(d.locator("[data-no-variant]").first()).toContainText(/no variant was attached/i);
  });

  test("a question report WITH its variant shows the stem, the options lettered and the numbers in mono", async ({ page }) => {
    await openFeedback(page);
    const d = await openGroup(page, FIX.variantBody);
    const v = d.locator("[data-variant]");
    await expect(v).toContainText(FIX.stem);
    await expect(v.locator("[data-option]")).toHaveCount(4);
    await expect(v.locator("[data-option]").first()).toContainText(/^A\s*6 ns$/);
    const params = v.locator("[data-params] .num").first();
    await expect(params).toBeVisible();
    expect(await params.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/);
    await expect(group(page, FIX.variantBody)).toContainText(FIX.slug);
  });

  test("what was attached automatically is shown, key by key (PAGE-SPECS.md §4.1)", async ({ page }) => {
    await openFeedback(page);
    const d = await openGroup(page, FIX.variantBody);
    const attached = d.locator("[data-attached]");
    await expect(attached).toContainText("viewport");
    await expect(attached).toContainText("1440×900");
    await expect(attached).toContainText("0.9.3");
    await expect(attached).toContainText("/app/stage/04/check");
  });
});

test.describe("triage: status, severity, released in — one decision for the group", () => {
  test("Save waits for a change; Released in appears with Shipped", async ({ page }) => {
    await openFeedback(page);
    const d = await openGroup(page, REPEATED);
    await expect(d.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(d.getByLabel("Released in", { exact: true })).toHaveCount(0);
    await d.getByRole("group", { name: "Move to" }).getByRole("button", { name: "Shipped" }).click();
    await expect(d.getByRole("group", { name: "Move to" }).getByRole("button", { name: "Shipped" })).toHaveAttribute("aria-pressed", "true");
    await expect(d.getByLabel("Released in", { exact: true })).toBeVisible();
    await expect(d.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("saving moves every report in the group in ONE request, and toasts what happened to how many", async ({ page }) => {
    const fx = await openFeedback(page);
    const d = await openGroup(page, REPEATED);
    await d.getByRole("group", { name: "Move to" }).getByRole("button", { name: "Shipped" }).click();
    await d.getByRole("group", { name: "Severity" }).getByRole("button", { name: "High" }).click();
    await d.getByLabel("Released in", { exact: true }).fill("1.4");
    await d.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("[data-toaster]")).toContainText(/5 reports moved to shipped/i);
    await expect(page.locator("[data-toaster]")).toContainText(/released in 1\.4/i);
    expect(fx.triages).toHaveLength(1);
    expect(fx.triages[0]).toMatchObject({ status: "shipped", severity: "high", releasedIn: "1.4" });
    expect((fx.triages[0]!.ids as string[])).toHaveLength(5);
  });

  test("a refused save keeps the detail and the choices, says why, and its toast stays", async ({ page }) => {
    await openFeedback(page, { ...ALL, triageStatus: 404 });
    const d = await openGroup(page, REPEATED);
    await d.getByRole("group", { name: "Move to" }).getByRole("button", { name: "Won't fix" }).click();
    await d.getByRole("button", { name: "Save" }).click();
    await expect(d.getByRole("alert")).toContainText(/no longer exists/i);
    await expect(d.getByRole("group", { name: "Move to" }).getByRole("button", { name: "Won't fix" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(4_500);
    await expect(page.locator("[data-toaster]")).toContainText(/not saved/i);
  });
});

test.describe("SUS, by role, with its n", () => {
  test("students and staff reported apart; below 20 it is not yet reliable; an empty one says so", async ({ page }) => {
    await openFeedback(page);
    const sus = page.locator("[data-sus]");
    await expect(sus.locator("[data-sus-student]")).toContainText("72.5");
    await expect(sus.locator("[data-sus-student]")).toContainText(/6 responses/);
    await expect(sus.locator("[data-sus-student]")).toContainText(/not yet reliable/i);
    await expect(sus.locator("[data-sus-staff]")).toContainText(/no responses yet/i);
    await expect(sus).not.toContainText(/\bSUS\s*[:=]?\s*0\b/);
  });
});

test.describe("export", () => {
  test("Export CSV downloads every match for the filter shown, and says how many", async ({ page }) => {
    const fx = await openFeedback(page, ALL, "?kind=flag");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^octa-feedback-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fx.exports.at(-1)?.searchParams.get("kind")).toBe("flag");
    await expect(page.locator("[data-toaster]")).toContainText(/exported 4 reports/i);
  });

  test("a refused export says why and stays", async ({ page }) => {
    await openFeedback(page, { ...ALL, exportStatus: 400 });
    await page.getByRole("button", { name: "Export CSV" }).click();
    await expect(page.locator("[data-toaster]")).toContainText(/filter by status or kind/i);
  });
});

/* ============================================== loading and failure */

test.describe("loading and failure — design.md", () => {
  test("nothing under 400ms, then a skeleton shaped like the queue, never a blank", async ({ page }) => {
    await openFeedback(page, { ...ALL, delayMs: 2_500 });
    await page.waitForTimeout(150);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await page.locator("[data-group]").first().waitFor({ timeout: 15_000 });
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  });

  test("past three seconds it says so in words, at the top of the skeleton", async ({ page }) => {
    await openFeedback(page, { ...ALL, delayMs: 5_000 });
    const note = page.locator("[data-skeleton] > :first-child");
    await expect(note).toContainText(/still loading/i, { timeout: 4_500 });
    await expect(note).toBeInViewport();
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    await openFeedback(page, { status: 500 });
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText(/could not be loaded/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

/* ===================================================== the narrow page */

test.describe("the narrow page", () => {
  test("at 380 each group is a card: status, kind, text and date inside the viewport, no table", async ({ page }, testInfo) => {
    test.skip(wide(testInfo.project.name), "380 only");
    await openFeedback(page);
    expect(await page.locator("table").count(), "no table at 380").toBe(0);
    const vw = page.viewportSize()!.width;
    for (const text of [FIX.variantBody, REPEATED]) {
      for (const fact of ["status", "kind", "when"]) {
        const el = group(page, text).locator(`[data-fact="${fact}"]`);
        await expect(el, `${fact}`).toBeVisible();
        const box = (await el.boundingBox())!;
        expect(box.x + box.width, `${fact} is off-screen`).toBeLessThanOrEqual(vw);
      }
    }
  });

  test("at 1440 severity is its own column, a shape and a word", async ({ page }, testInfo) => {
    test.skip(!wide(testInfo.project.name), "1440 only");
    await openFeedback(page);
    await expect(page.locator("thead th")).toContainText(["Status", "Kind", "Report", "About", "Severity", "Last"]);
  });
});
