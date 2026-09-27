import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { FIX, useFixture } from "./_assessments-fixture";

/**
 * `/assessments` — setting the exam window.
 *
 * The instructor's ruling was that opening and closing dates are decided in the
 * console. That was not possible: `routes/assessments.ts` offered only GET and
 * POST, so an assessment seeded without dates was open forever and one created
 * with them could never be extended — while the file's own closing comment
 * claimed "closing it is a `closes_at` in the past; that is the supported way to
 * end one".
 *
 * The route exists now and is denial-tested in `assessments.spec.ts`. This spec
 * covers the half that lives in the browser, because a guarded endpoint with no
 * caller is not a feature a teacher has.
 *
 * FIXTURE DATA. Prelim and Midterm come from `scripts/sync-assessments.mjs`, and
 * the spec restores whatever window it found so a run leaves no trace.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "teacher@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const TEACHER = teacherToken();

/**
 * One assessment, at either width: a table row at 1440, a list item at 380.
 * The original tests located a `role=row`, which only the table has; since the
 * rebuild (27 Sep 2026) they locate `[data-assessment]`, and every assertion
 * they made is unchanged.
 */
const entry = (page: Page, title: string) =>
  page.locator("[data-assessment]").filter({ hasText: title }).first();

test.describe("the exam window, from the console", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
    await page.goto(`${CONSOLE_URL}/assessments`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ timeout: 15_000 });
  });

  test("a seeded exam says plainly that it is open with no window", async ({ page }) => {
    const row = entry(page, "Prelim Examination");
    await expect(row).toBeVisible({ timeout: 15_000 });
    // Five attempts, every section, no window — the instructor's ruling, on screen.
    await expect(row).toContainText("every section");
    await expect(row).toContainText("no window");

    await row.getByRole("button", { name: "Set window" }).click();
    const dialog = page.getByRole("dialog");
    /*
     * The warning is the point. A NULL bound is no bound and engine-repo.ts
     * enforces exactly that, so "no dates" means "open to everyone right now" —
     * which is a thing a teacher should be told rather than left to infer.
     */
    await expect(dialog).toContainText(/open now/i);
    await dialog.screenshot({ path: "design/item-review/assessment-window.png" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("the reason is required before the window can be saved", async ({ page }) => {
    const row = entry(page, "Prelim Examination");
    await row.getByRole("button", { name: "Set window" }).click();

    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Save window" });
    await expect(save).toBeDisabled();

    await dialog.getByLabel("Reason").fill("Prelim week");
    await expect(save).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("setting a window persists it, and clearing it restores no window", async ({ page }) => {
    const row = () => entry(page, "Prelim Examination");

    await row().getByRole("button", { name: "Set window" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("2026-10-01T08:00");
    await dialog.getByLabel("Closes").fill("2026-10-08T17:00");
    await dialog.getByLabel("Reason").fill("Prelim week, department calendar");
    await dialog.getByRole("button", { name: "Save window" }).click();

    // One toast, naming what changed (design.md), and the dialog is gone.
    await expect(page.getByRole("status").filter({ hasText: /window saved for prelim examination/i })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The row must reflect it without a manual refresh.
    await expect(row()).toContainText(/opens/i, { timeout: 15_000 });
    await expect(row()).not.toContainText("no window");

    // Put it back, which also exercises the null-clears-a-bound path.
    await row().getByRole("button", { name: "Set window" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("");
    await dialog.getByLabel("Closes").fill("");
    await dialog.getByLabel("Reason").fill("restoring the fixture");
    await dialog.getByRole("button", { name: "Save window" }).click();

    await expect(row()).toContainText("no window", { timeout: 15_000 });
  });

  test("a window that closes before it opens is refused, and says so", async ({ page }) => {
    const row = entry(page, "Midterm Examination");
    await row.getByRole("button", { name: "Set window" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Opens").fill("2026-11-01T08:00");
    await dialog.getByLabel("Closes").fill("2026-10-01T08:00");
    await dialog.getByLabel("Reason").fill("deliberately backwards");
    await dialog.getByRole("button", { name: "Save window" }).click();

    // The server refuses, and the dialog stays open carrying the reason why.
    await expect(dialog.getByRole("alert")).toContainText(/close before it opens/i, {
      timeout: 15_000,
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

/* ======================================================================
 * THE REBUILT PAGE, 27 Sep 2026: `design/templates/console/assessments/SPEC.md`
 *
 * Everything below runs on `_assessments-fixture.ts`: the REAL list, patched
 * with the states the seed lacks, and EVERY WRITE INTERCEPTED. Creating an
 * assessment mints a salt and rotating one replaces it; neither may happen to
 * the database from a spec.
 * ==================================================================== */

const wide = (name: string) => name === "desktop-1440";

async function openPage(page: Page, opts: Parameters<typeof useFixture>[1] = {}) {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  const fx = await useFixture(page, opts);
  await page.goto(`${CONSOLE_URL}/assessments`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
  if (!opts.listStatus) await entry(page, FIX.real).waitFor({ timeout: 15_000 });
  return fx;
}

/** Open the create dialog and wait for the bank's answer to land. */
async function openCreate(page: Page) {
  await page.getByRole("button", { name: "New assessment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator("[data-bank-verdict]").waitFor({ timeout: 15_000 });
  return dialog;
}

/** Pick a blueprint by the start of its name, as a teacher reads the list. */
async function pickBlueprint(page: Page, name: string) {
  const select = page.getByRole("dialog").getByLabel("Blueprint");
  const value = await select.locator("option").evaluateAll(
    (opts, n) => (opts as HTMLOptionElement[]).find((o) => o.textContent!.startsWith(n as string))?.value ?? "",
    name,
  );
  expect(value, `a blueprint named ${name}`).not.toBe("");
  await select.selectOption(value);
}

/** The row's ⋯ menu, then an item from it. */
async function fromMenu(page: Page, title: string, item: RegExp) {
  await entry(page, title).getByRole("button", { name: `More for ${title}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("the rebuilt /assessments", () => {
  /* ------------------------------------------------------------------
   * THE GATE: CONSOLE-REVAMP.md §2, at 1440 and 380
   * ---------------------------------------------------------------- */
  test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
    test("1 · nothing is clipped: the list, the create form, the rotate and bank dialogs", async ({ page }) => {
      await openPage(page);
      expect(await clippedElements(page), "the list").toEqual([]);
      await openCreate(page);
      expect(await clippedElements(page), "the create form with its preview").toEqual([]);
      await closeDialog(page);
      await fromMenu(page, FIX.real, /rotate exam salt/i);
      expect(await clippedElements(page), "the rotate dialog").toEqual([]);
      await closeDialog(page);
      await fromMenu(page, FIX.real, /check the bank/i);
      expect(await clippedElements(page), "the bank dialog").toEqual([]);
    });

    test("2 · no horizontal page scroll", async ({ page }) => {
      await openPage(page);
      expect(await horizontalOverflow(page), "the list").toBeLessThanOrEqual(0);
      await openCreate(page);
      expect(await horizontalOverflow(page), "the create form").toBeLessThanOrEqual(0);
      await closeDialog(page);
      await fromMenu(page, FIX.real, /rotate exam salt/i);
      expect(await horizontalOverflow(page), "the rotate dialog").toBeLessThanOrEqual(0);
    });

    test("3 · every control is reachable from the keyboard alone, and focus comes home", async ({ page }) => {
      test.setTimeout(240_000);
      await openPage(page);
      expect(await unreachableByKeyboard(page, "main"), "the list").toEqual([]);

      // The create form, opened and closed without the mouse.
      const newButton = page.getByRole("button", { name: "New assessment" });
      await newButton.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.locator("[data-bank-verdict]").waitFor({ timeout: 15_000 });
      expect(await unreachableByKeyboard(page, "[role=dialog]"), "the create form").toEqual([]);
      await closeDialog(page);
      await expect(newButton, "focus came home to New assessment").toBeFocused();

      // The ⋯ menu without the mouse, to the rotate dialog and back.
      const more = entry(page, FIX.real).getByRole("button", { name: `More for ${FIX.real}` });
      await more.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menu").waitFor();
      await page.keyboard.press("End");
      await expect(page.getByRole("menuitem", { name: /rotate exam salt/i })).toBeFocused();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.getByLabel("Reason (required)").fill("Second semester");
      expect(await unreachableByKeyboard(page, "[role=dialog]"), "the rotate dialog").toEqual([]);
      await closeDialog(page);
      await expect(more, "focus came home to the ⋯ button").toBeFocused();

      // Set window, from its row button, and back to it.
      const setWindow = entry(page, FIX.real).getByRole("button", { name: "Set window" });
      await setWindow.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      expect(await unreachableByKeyboard(page, "[role=dialog]"), "the window dialog").toEqual([]);
      await closeDialog(page);
      await expect(setWindow, "focus came home to Set window").toBeFocused();
    });

    test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
      test.setTimeout(240_000);
      await openPage(page);
      const failures: string[] = [];
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} list: ${f}`));
      }
      await openCreate(page);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} create: ${f}`));
      }
      await closeDialog(page);
      await fromMenu(page, FIX.real, /check the bank/i);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} bank: ${f}`));
      }
      await closeDialog(page);
      await fromMenu(page, FIX.real, /rotate exam salt/i);
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page)).map((f) => `${theme} rotate: ${f}`));
      }
      expect(failures).toEqual([]);
    });

    test("5 · the token system is what actually rendered", async ({ page }) => {
      await openPage(page);
      expect(await offTokenStyles(page), "the list").toEqual([]);
      await openCreate(page);
      expect(await offTokenStyles(page), "the create form").toEqual([]);
      await closeDialog(page);
      await fromMenu(page, FIX.real, /rotate exam salt/i);
      expect(await offTokenStyles(page), "the rotate dialog").toEqual([]);
    });

    test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
      /*
       * POSITIVE CONTROL FIRST: with motion allowed, the create form must ease
       * in. Without this the test passes on a page with no motion at all.
       */
      await recordMotion(page);
      await openPage(page);
      await openCreate(page);
      const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("dialog") && m.ms >= 100);
      expect(moving.length, "with motion allowed, the create form should ease in").toBeGreaterThan(0);
      await closeDialog(page);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await entry(page, FIX.real).waitFor({ timeout: 15_000 });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      await openCreate(page);
      await closeDialog(page);
      await fromMenu(page, FIX.real, /rotate exam salt/i);
      const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
      expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
    });
  });

  /* ------------------------------------------------------------------
   * THE ROUTE'S OWN CLAIMS: PAGE-SPECS.md §/console/assessments
   * ---------------------------------------------------------------- */
  test.describe("the list: every assessment, honest about Start", () => {
    test("at 1440 a table whose header and cells agree; at 380 a list", async ({ page }, info) => {
      await openPage(page);
      if (wide(info.project.name)) {
        const heads = (await page.locator("main thead th").allInnerTexts()).map((t) => t.trim().toLowerCase());
        expect(heads.slice(0, 9)).toEqual([
          "status", "assessment", "scope", "items", "bank", "attempts", "section", "window", "submitted",
        ]);
        // The defect this rebuild fixed: as many headings as cells, in one order.
        const cells = await page.locator("main tbody tr").first().locator("td").count();
        expect(cells).toBe(heads.length);

        /*
         * One line each, found by screenshot under a green spec: the scope
         * badge broke "stage 01" into "stage 0" / "1", and every window date
         * wrapped its time onto a second line.
         */
        const wrapped = await page.locator("main tbody").evaluate((tb) => {
          const out: string[] = [];
          const lineOf = (el: Element) => parseFloat(getComputedStyle(el).lineHeight) || 16;
          for (const el of tb.querySelectorAll("td:nth-child(3) > span, .assess-window > span, [data-bank] > span")) {
            const r = el.getBoundingClientRect();
            if (r.height > lineOf(el) * 1.5 + 8) out.push(`${el.textContent?.trim()} (${Math.round(r.height)}px)`);
          }
          return out;
        });
        expect(wrapped, "a badge or date wrapped onto two lines").toEqual([]);
        const tallest = await page.locator("main tbody tr").evaluateAll((rs) =>
          Math.max(...rs.map((r) => r.getBoundingClientRect().height)),
        );
        expect(tallest, "the tallest row, window dates included").toBeLessThan(70);
      } else {
        await expect(page.locator("main table")).toHaveCount(0);
        await expect(page.locator("main li[data-assessment]").first()).toBeVisible();
      }
    });

    test("status is a word decided by the window: open, scheduled, closed", async ({ page }) => {
      await openPage(page);
      await expect(entry(page, FIX.closed)).toContainText("closed");
      await expect(entry(page, FIX.scheduled)).toContainText("scheduled");
      await expect(entry(page, FIX.bounded)).toContainText("open");
      await expect(entry(page, FIX.bounded)).toContainText(/closes\s*\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}/);
      await expect(entry(page, FIX.real)).toContainText("no window");
      await expect(page.locator("[data-counts]")).toContainText(/\d+ assessments · \d+ open · 1 scheduled · 1 closed/);
    });

    test("every row says whether the bank can fill it, and the banner counts the ones that cannot", async ({ page }) => {
      const { list } = await openPage(page);
      await expect(entry(page, FIX.fills).locator("[data-bank]")).toHaveText("fills");
      await expect(entry(page, FIX.real).locator("[data-bank]")).toContainText(/short/);

      // Every row but the one that fills and the closed one is a Start that will fail.
      const reachable = list()!.assessments.filter(
        (a) => a.title !== FIX.fills && a.title !== FIX.closed && !a.bank.satisfiable,
      ).length;
      const banner = page.locator("[data-bank-banner]");
      await expect(banner).toContainText(new RegExp(`${reachable} of`));
      // A styled link to where items are approved: never browser-default purple or blue.
      const link = banner.getByRole("link", { name: /items/i });
      await expect(link).toHaveAttribute("href", "/items");
      const colour = await link.evaluate((el) => getComputedStyle(el).color);
      expect(colour).not.toBe("rgb(85, 26, 139)");
      expect(colour).not.toBe("rgb(0, 0, 238)");
    });

    test("each row says when its salt was set or rotated, never what it is", async ({ page }) => {
      await openPage(page);
      await expect(entry(page, FIX.real)).toContainText(/salt set \d{1,2} [A-Z][a-z]{2} \d{4}/);
      await expect(entry(page, FIX.rotated)).toContainText(/salt rotated \d{1,2} [A-Z][a-z]{2} \d{4}/);
      await expect(entry(page, FIX.noSalt)).toContainText(/no exam salt/i);
      // A 64-hex string anywhere in the page would be a salt.
      expect(await page.content()).not.toMatch(/[0-9a-f]{64}/);
    });

    test("a section-scoped row names its section; the rest say every section", async ({ page }) => {
      const { list } = await openPage(page);
      const code = list()!.sections[0]!.code;
      await expect(entry(page, FIX.scoped)).toContainText(code);
      await expect(entry(page, FIX.real)).toContainText("every section");
    });

    test("numbers, counts and dates are mono", async ({ page }) => {
      await openPage(page);
      const fonts = await page.locator("main .num").evaluateAll((els) =>
        els.slice(0, 40).map((e) => getComputedStyle(e).fontFamily),
      );
      expect(fonts.length).toBeGreaterThan(10);
      for (const f of fonts) expect(f).toMatch(/JetBrains Mono/);
      const dates = await entry(page, FIX.bounded).locator("[data-date]").evaluateAll((els) =>
        els.map((e) => getComputedStyle(e).fontFamily),
      );
      expect(dates.length).toBeGreaterThan(0);
      for (const f of dates) expect(f).toMatch(/JetBrains Mono/);
    });
  });

  test.describe("dates: a datetime field shows its whole value", () => {
    /*
     * Found by screenshot under a green gate: at max-w-md the window dialog's
     * two mono datetime fields cut "PM" off the closing time. Assertion 1
     * cannot see inside a native input, so the width is measured here against
     * the value's own rendered width.
     */
    for (const which of ["create", "window"] as const) {
      test(`the ${which} dialog's Opens and Closes fit their values`, async ({ page }) => {
        await openPage(page);
        const dialog =
          which === "create"
            ? await openCreate(page)
            : (await entry(page, FIX.bounded).getByRole("button", { name: "Set window" }).click(), page.getByRole("dialog"));
        await dialog.getByLabel("Opens").fill("2026-10-10T10:00");
        await dialog.getByLabel("Closes").fill("2026-12-28T11:00");
        for (const label of ["Opens", "Closes"]) {
          const short = await dialog.getByLabel(label).evaluate((el) => {
            const input = el as HTMLInputElement;
            const cs = getComputedStyle(input);
            const probe = document.createElement("span");
            // `font` computes to "" on an input in Chromium; set its parts.
            probe.style.fontFamily = cs.fontFamily;
            probe.style.fontSize = cs.fontSize;
            probe.style.letterSpacing = cs.letterSpacing;
            probe.style.position = "absolute";
            probe.style.whiteSpace = "pre";
            probe.textContent = "12/28/2026 11:00 PM"; // what Chromium en-US writes, at its longest
            document.body.append(probe);
            const need = probe.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 24;
            probe.remove();
            return input.getBoundingClientRect().width < need ? Math.round(need - input.getBoundingClientRect().width) : 0;
          });
          expect(short, `${label} is ${short}px too narrow for its value`).toBe(0);
        }
      });
    }
  });

  test.describe("create: the form beside what it produces", () => {
    test("the preview shows what a student is offered, and the bank names its real shortfall cells", async ({ page }) => {
      await openPage(page);
      const dialog = await openCreate(page);
      await pickBlueprint(page, "Stage 01 Check");
      await expect(dialog.locator("[data-bank-verdict]")).toContainText(/cannot be filled yet/i);
      const preview = dialog.locator("[data-preview]");
      await expect(preview).toContainText("Stage 01 Check");
      await expect(preview).toContainText(/8 questions/);
      await expect(preview).toContainText(/open now, and stays open/i);
      await expect(dialog.locator("[data-bank]")).toContainText(/questions needed\s*8/i);
      await expect(dialog.locator("[data-bank]")).toContainText(/live in the pool\s*0/i);
      // The dialog says the salt is minted, and never shows one.
      await expect(dialog).toContainText(/mints this assessment.s exam salt/i);
    });

    test("a blueprint the bank can fill says so", async ({ page }) => {
      await openPage(page);
      const dialog = await openCreate(page);
      await pickBlueprint(page, "Stage 07 Check");
      await expect(dialog.locator("[data-bank-verdict]")).toContainText(/the bank can fill it/i);
    });

    test("scoping to a section, a window and attempts: one POST, one toast, focus home", async ({ page }) => {
      const { writes, list } = await openPage(page);
      const newButton = page.getByRole("button", { name: "New assessment" });
      const dialog = await openCreate(page);
      await pickBlueprint(page, "Stage 01 Check");
      const section = list()!.sections[0]!;
      await dialog.getByLabel("Who can see it").selectOption(section.id);
      await expect(dialog.locator("[data-preview]")).toContainText(section.code);
      await dialog.getByLabel("Attempts allowed").fill("3");
      await dialog.getByLabel("Opens").fill("2026-10-01T08:00");
      await dialog.getByLabel("Closes").fill("2026-10-08T17:00");
      await dialog.getByRole("button", { name: "Create assessment" }).click();

      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes.create).toHaveLength(1);
      expect(writes.create[0]).toMatchObject({
        title: "Stage 01 Check", attemptsAllowed: 3, sectionId: section.id,
        opensAt: new Date("2026-10-01T08:00").toISOString(),
        closesAt: new Date("2026-10-08T17:00").toISOString(),
      });
      const toast = page.getByRole("status").filter({ hasText: /stage 01 check created/i });
      await expect(toast).toBeVisible();
      await expect(toast, "the toast says the bank cannot fill it yet").toContainText(/cannot fill/i);
      await expect(newButton).toBeFocused();
    });

    test("a refused create keeps the dialog, says why, and raises an error that stays", async ({ page }) => {
      await openPage(page, { fail: "create" });
      const dialog = await openCreate(page);
      await dialog.getByRole("button", { name: "Create assessment" }).click();
      await expect(dialog.getByRole("alert")).toContainText(/after the opening time/i);
      // The toast sits outside the modal, which Radix hides from the a11y tree
      // while it is open; the dialog's own alert is what a screen reader hears.
      const toast = page.locator("[data-toaster]").getByText(/was not created/i);
      await expect(toast).toBeVisible();
      // design.md: a toast never covers the control that triggered it.
      const a = await toast.boundingBox();
      const b = await dialog.getByRole("button", { name: "Create assessment" }).boundingBox();
      const overlaps = !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, "the error toast covers Create assessment").toBe(false);
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("the row's ⋯ menu: the bank, and the salt", () => {
    test("Check the bank names every short cell for that assessment", async ({ page }) => {
      const { list } = await openPage(page);
      const dialog = await fromMenu(page, FIX.real, /check the bank/i);
      const real = list()!.assessments.find((a) => a.title === FIX.real)!;
      await expect(dialog.locator("[data-bank-verdict]")).toContainText(/cannot be filled yet/i);
      await expect(dialog.locator("[data-shortfall]")).toHaveCount(real.bank.shortfalls.length);
      await expect(dialog).toContainText(/Act 1 · Prelim/);
    });

    test("rotating needs a reason, says what changes and what does not, posts once, toasts", async ({ page }) => {
      const { writes, list } = await openPage(page);
      const dialog = await fromMenu(page, FIX.rotated, /rotate exam salt/i);
      await expect(dialog).toContainText(/started after this/i);
      await expect(dialog).toContainText(/already started or handed in are unchanged/i);
      await expect(dialog).toContainText(/never shown/i);
      const go = dialog.getByRole("button", { name: "Rotate the salt" });
      await expect(go).toBeDisabled();
      await dialog.getByLabel("Reason (required)").fill("Second semester, 2026-2027");
      await go.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes.rotate).toHaveLength(1);
      const id = list()!.assessments.find((a) => a.title === FIX.rotated)!.id;
      expect(writes.rotate[0]!.url).toContain(`/assessments/${id}/rotate-salt`);
      expect(writes.rotate[0]!.body).toEqual({ reason: "Second semester, 2026-2027" });
      await expect(page.getByRole("status").filter({ hasText: /exam salt rotated for stage 06 check/i })).toBeVisible();
    });

    test("a refused rotation keeps the dialog and its reason", async ({ page }) => {
      await openPage(page, { fail: "rotate" });
      const dialog = await fromMenu(page, FIX.real, /rotate exam salt/i);
      await dialog.getByLabel("Reason (required)").fill("Second semester");
      await dialog.getByRole("button", { name: "Rotate the salt" }).click();
      await expect(dialog.getByRole("alert")).toContainText(/staff only/i);
      await expect(dialog.getByLabel("Reason (required)")).toHaveValue("Second semester");
    });
  });

  test.describe("loading and failure — design.md", () => {
    test("a slow list shows a skeleton shaped like it, never a blank", async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
      await useFixture(page, { delayMs: 2500 });
      await page.goto(`${CONSOLE_URL}/assessments`, { waitUntil: "domcontentloaded" });
      const skel = page.locator("[data-skeleton]");
      await expect(skel).toBeVisible({ timeout: 5_000 });
      expect(await skel.locator(".assess-skel-row").count()).toBeGreaterThanOrEqual(8);
      await entry(page, FIX.real).waitFor({ timeout: 15_000 });
      await expect(skel).toHaveCount(0);
    });

    test("a failed fetch says so and offers a retry", async ({ page }) => {
      await openPage(page, { listStatus: 500 });
      const alert = page.getByRole("alert").filter({ hasText: /could not be loaded/i });
      await expect(alert).toBeVisible({ timeout: 15_000 });
      await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
    });
  });
});
