import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";

/**
 * `/items` — the question bank, dense, with the psychometric warnings intact.
 *
 * `CONSOLE-DATA-AND-TEMPLATES.md` §2 names this page and the submissions queue
 * as "the same shape", to be "solved together against the same reference rather
 * than separately by taste". D-4 fixed the queue; this page was still a card
 * list at **122px per item** — about 4,000px for 33 items, and the bank targets
 * roughly 40 live items per gradeable chapter, so ~700 items and ~85,000px at
 * full size.
 *
 * The density is asserted here as a number, because a screenshot cannot hold
 * one and taste drifts.
 *
 * THE POINT OF THE PAGE MUST SURVIVE THE DENSITY PASS. A negative
 * point-biserial means the students who did best on the paper did worst on this
 * item — almost always a wrong key. That sentence is why a teacher opens this
 * page, and compressing it into a colour would have been the density pass
 * eating the thing it was meant to surface.
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

/**
 * Skip, with the reason, when the item bank is empty.
 *
 * **F-41: nothing in this repository seeds `items`.** `db/demo-seed.sql` has no
 * insert for them, `sync-content.mjs` does not touch them, and the content files
 * carry none — so a clean `pnpm db:reset` leaves the bank at ZERO. The rows this
 * spec was written against were live-database artefacts that a reset destroys.
 *
 * The page is not broken when the bank is empty; it is correctly empty. Failing
 * here would send the next person hunting a regression in code that is fine, so
 * these skip and name the finding instead.
 */
async function bankIsEmpty(page: Page): Promise<boolean> {
  /*
   * WAIT FOR THE PAGE TO DECIDE before counting. This used to count rows the
   * instant `<main>` existed -- which is while the page still says "Loading" --
   * so it found zero rows and SKIPPED all four tests below on every run, with
   * 183 items in the bank. Measured 25 Sep 2026: "8 skipped", reported for
   * weeks as "four passing tests". A skip that fires on a race is a test that
   * has quietly stopped existing.
   */
  await page
    .locator("table tbody tr")
    .or(page.getByText(/No items match|The bank is empty/))
    .first()
    .waitFor({ timeout: 15_000 });
  const rows = await page.locator("table tbody tr").count();
  return rows === 0;
}

test.describe("the item bank is scannable", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("is a table, and a dense one", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "density is a desktop question");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    const perRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("table tbody tr")];
      if (rows.length === 0) return Infinity;
      return rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0) / rows.length;
    });

    /*
     * 72px measured at 1440, against 122px for the card list it replaced.
     *
     * The first bound here was calibrated at 67px -- measured while the
     * database was missing its objectives, so that whole column was empty. With
     * real data the rows were 98px, which against 122px is a rounding error
     * rather than a density pass. The objective sentence is now clamped to two
     * lines (full text on hover) and the stem given room, which is what bought
     * the actual improvement.
     *
     * MEASURE ON REAL DATA. A bound calibrated against an empty column is a
     * bound that passes and means nothing.
     */
    expect(perRow, `${Math.round(perRow)}px per item; the card list was 122px`).toBeLessThan(95);
  });

  test("states the 30-exposure rule once, not on every row", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    /*
     * The first version printed "not enough exposures… around 30" in EVERY row,
     * which on a fresh bank is every row — 22 copies of one sentence, and the
     * single biggest contributor to row height. Repeating an explanation per
     * row is how a density pass quietly gives back what it won.
     */
    const copies = await page.evaluate(
      () => (document.body.innerText.match(/do not mean anything yet/g) ?? []).length,
    );
    expect(copies, "the rule belongs above the table, once").toBe(1);
  });

  test("a bad item still says what is wrong with it, in words", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    /*
     * `db/demo-seed.sql` seeds exactly one item with real psychometrics, for
     * this: before it, every item had zero exposures, so the branch a teacher
     * opens this page FOR could not be seen, screenshotted or reviewed at all.
     */
    const row = page.locator("table tbody tr", { hasText: "flagged" }).first();
    await expect(row).toBeVisible();

    // Colour is never the only signal -- the sentence is the signal.
    await expect(row).toContainText("the key is probably wrong");
    await expect(row).toContainText("at guessing");

    // And the numbers behind it are in mono, per the type roles.
    await expect(row.locator(".num").first()).toBeVisible();
  });

  test("every column the cards carried is still there", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 15_000 });
    if (await bankIsEmpty(page)) {
      test.skip(true, "the item bank is empty (F-41); nothing in the repo seeds items");
      return;
    }
    await page.locator("table tbody tr").first().waitFor();

    // A density pass that drops a field is not a density pass, it is a deletion.
    // Compared case-insensitively: `allInnerTexts` returns RENDERED text, and
    // these headers are uppercased in CSS, so a literal "Item" never matches.
    const headers = (await page.locator("table thead th").allInnerTexts()).join(" | ").toLowerCase();
    for (const col of ["item", "stem", "objective", "exposures", "discrimination"]) {
      expect(headers, `${col} must survive`).toContain(col);
    }

    const first = await page.locator("table tbody tr").first().innerText();
    expect(first, "slug, version, stage, type and bloom all still shown").toMatch(
      /v\d+.*stage \d{2}/s,
    );
  });
});

/* ======================================================================
 * THE GATE — `CONSOLE-REVAMP.md` §2's six assertions, at 1440 AND 380.
 *
 * Added 25 Sep 2026 for the /items revamp, and written to fail first against
 * the page as it stood: its action column sat past the right-hand edge of a
 * horizontally scrolling table ("DISCRIMINA" cut mid-word, "Preview" not on
 * screen at all at 1440; at 380 only the ITEM column was visible).
 *
 * These run at BOTH widths -- no `test.skip` on the project -- because the
 * defect was worst at 380 and a gate that only looks at 1440 would have
 * passed it.
 *
 * The route's surfaces are the page AND its two dialogs. A dialog is where the
 * decisions happen; a gate that closed its eyes when one opened would be
 * gating the half of the page nobody acts on.
 * ==================================================================== */

async function openItems(page: Page): Promise<void> {
  await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
  await page.locator("table tbody tr").first().waitFor({ timeout: 20_000 });
}

/** The first row's review control, by what it says it does. */
function firstReview(page: Page) {
  return page.locator("table tbody tr").first().getByRole("button", { name: /^Review / });
}

async function openReview(page: Page): Promise<void> {
  await firstReview(page).click();
  await page.getByRole("dialog").waitFor();
  // The resolved instance, not "Loading": the preview is what is being judged.
  await page.getByRole("dialog").getByText(/^key$/).first().waitFor({ timeout: 15_000 });
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** A tiny, VALID import file. Used for dry runs only; nothing is committed. */
const PROBE_FILE = JSON.stringify({
  stageId: "01",
  items: [
    {
      slug: "01-gate-probe-dry-run",
      objective: "01.1",
      type: "S",
      bloom: "remember",
      stem: "Which of these is a probe item that exists only to exercise the dry run?",
      correct: "This one",
      distractors: ["Not this one", "Nor this", "Nor that"],
      rationale: "It is a probe.",
      source: "design/specs/console-items.spec.ts, gate probe, never committed",
    },
  ],
});

async function openImportWithProbe(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Import JSON" }).click();
  await page.getByRole("dialog").waitFor();
  await page.locator("[role=dialog] input[type=file]").setInputFiles({
    name: "probe.json",
    mimeType: "application/json",
    buffer: Buffer.from(PROBE_FILE),
  });
  await page.getByRole("dialog").getByText(/would be created/i).waitFor({ timeout: 15_000 });
}

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("1 · nothing is clipped — page, review dialog, import dialog", async ({ page }) => {
    await openItems(page);
    expect(await clippedElements(page), "on the page").toEqual([]);

    await openReview(page);
    expect(await clippedElements(page), "in the review dialog").toEqual([]);
    await closeDialog(page);

    await openImportWithProbe(page);
    expect(await clippedElements(page), "in the import dialog").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openItems(page);
    expect(await horizontalOverflow(page), "the page").toBeLessThanOrEqual(0);
    await openReview(page);
    expect(await horizontalOverflow(page), "with the review dialog open").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    await openItems(page);
    expect(await unreachableByKeyboard(page, "main"), "on the page").toEqual([]);

    // Open a review WITHOUT the mouse, walk it, and leave it: focus must come
    // home to the row it left, or a reviewer loses their place in 183 items.
    const trigger = firstReview(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").getByText(/^key$/).first().waitFor({ timeout: 15_000 });
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the review dialog").toEqual([]);
    await closeDialog(page);
    await expect(trigger).toBeFocused();

    const importer = page.getByRole("button", { name: "Import JSON" });
    await importer.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "in the import dialog").toEqual([]);
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(90_000);
    await openItems(page);
    const failures: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} page: ${f}`));
      await openReview(page);
      failures.push(...(await contrastFailures(page)).map((f) => `${theme} review: ${f}`));
      await closeDialog(page);
    }
    expect(failures).toEqual([]);
  });

  test("5 · the token system is what actually rendered", async ({ page }) => {
    await openItems(page);
    expect(await offTokenStyles(page), "on the page").toEqual([]);
    await openReview(page);
    expect(await offTokenStyles(page), "in the review dialog").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    /*
     * POSITIVE CONTROL FIRST. Without it this test passes on a page with no
     * motion at all -- which is exactly what /items was, and what design.md
     * says it must not be. So: with motion allowed, the review dialog must
     * visibly ease in. Then, with the media feature emulated, nothing the route
     * owns may animate for longer than the 0.01ms the global rule allows.
     */
    await recordMotion(page);
    await openItems(page);
    await openReview(page);
    const moving = (await recordedMotion(page)).filter((m) => m.on.startsWith("dialog") && m.ms >= 100);
    expect(moving.length, "with motion allowed, the review dialog should ease in").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openItems(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await openReview(page);
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================================
 * FEEDBACK, LOADING, TRANSITIONS — `.claude/rules/design.md`, required on
 * every page that is changed. None of the three existed on /items.
 *
 * Writes are INTERCEPTED here, never sent. These specs run against the local
 * demo bank the Prelim is reviewed from; a spec that approved items to prove a
 * toast would be quietly publishing questions.
 * ==================================================================== */

test.describe("feedback, loading and failure — design.md", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("a slow bank shows a skeleton shaped like the table, never a blank", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the skeleton's shape is a desktop claim");
    await page.route("**/api/v1/console/items?*", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });

    const skeleton = page.locator("[data-skeleton]");
    await expect(skeleton).toBeVisible({ timeout: 1_400 });
    const skeletonCols = Number(await skeleton.getAttribute("data-cols"));

    await page.locator("table tbody tr").first().waitFor();
    await expect(skeleton).toHaveCount(0);
    const tableCols = await page.locator("table thead th").count();
    expect(skeletonCols, "the skeleton promises the columns that arrive").toBe(tableCols);
  });

  test("a failed fetch says so and offers a retry", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/console/items?*", async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "internal", message: "The bank could not be read." } }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main [role=alert]")).toContainText("could not be read");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.locator("table tbody tr").first().waitFor();
  });

  test("a decision confirms itself in words, and a failure stays until dismissed", async ({ page }) => {
    test.setTimeout(60_000);
    let ok = true;
    await page.route("**/api/v1/console/items/*/status", async (route) => {
      await route.fulfill(
        ok
          ? { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "live" }) }
          : {
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({
                error: { code: "forbidden", message: "Ask another member of staff to review it." },
              }),
            },
      );
    });
    await openItems(page);
    const slug = (await page.locator("table tbody tr").first().locator("[data-slug]").innerText()).trim();

    await openReview(page);
    await page.getByRole("button", { name: "Approve and publish" }).click();

    // What happened to what -- the slug, and the verb. Not "Success".
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(`${slug} approved`);
    await expect(page.locator("[data-toaster]")).toContainText(`${slug} approved`);

    ok = false;
    await page.getByRole("button", { name: "Approve and publish" }).click();
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toContainText("Ask another member of staff");
    await closeDialog(page);
    await page.waitForTimeout(4_600); // longer than a success toast lives
    await expect(alert, "a failure must not vanish on a timer").toBeVisible();
    await alert.getByRole("button", { name: "Dismiss" }).click();
    await expect(alert).toHaveCount(0);
  });
});

/* ======================================================================
 * THE FEATURES PAGE-SPECS.md PLANNED AND THE PAGE NEVER HAD.
 * Approved by the instructor 25 Sep 2026: browse by type and by objective,
 * bulk approve drafts, import and export JSON.
 * ==================================================================== */

test.describe("the planned features — PAGE-SPECS.md §/console/items", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  });

  test("browse by type and by objective narrows the table", async ({ page }) => {
    await openItems(page);
    await page.getByLabel("Type").selectOption("G");
    const metas = await page.locator("table tbody tr [data-meta]").allInnerTexts();
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) expect(m).toContain("ordering");

    await page.getByLabel("Type").selectOption("");
    await page.getByLabel("Objective").selectOption("04.3");
    const objs = await page.locator("table tbody tr [data-objective]").allInnerTexts();
    expect(objs.length).toBeGreaterThan(0);
    for (const o of objs) expect(o).toContain("04.3");
  });

  test("drafts are approved into review together — and only drafts", async ({ page }) => {
    // The demo bank has no drafts (sync-items lands everything in review), so
    // three rows are relabelled in the RESPONSE. The write is intercepted.
    await page.route("**/api/v1/console/items?*", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      for (const i of body.items.slice(0, 3)) i.status = "draft";
      body.summary = { draft: 3, review: body.items.length - 3 };
      await route.fulfill({ response: res, json: body });
    });
    let sent: { ids: string[]; to: string } | null = null;
    await page.route("**/api/v1/console/items/bulk-status", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ json: { moved: sent!.ids, skipped: [] } });
    });

    await openItems(page);
    await page.getByLabel("Status").selectOption("draft");
    await page.getByRole("checkbox", { name: "Select every draft on this page" }).check();
    await page.getByRole("button", { name: "Send 3 to review" }).click();

    await expect(page.locator("[data-toaster]")).toContainText("3 drafts sent to review");
    expect(sent!.to).toBe("review");
    expect(sent!.ids).toHaveLength(3);

    // A row that is not a draft never offers a checkbox: bulk can only ever
    // move drafts, and publishing stays one decision per item.
    await page.getByLabel("Status").selectOption("review");
    await expect(page.locator("main").getByRole("checkbox")).toHaveCount(0);
  });

  test("import runs as a dry run first, and says what it would do", async ({ page }) => {
    await openItems(page);
    await openImportWithProbe(page);
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("01-gate-probe-dry-run");
    await expect(dlg).toContainText(/1 would be created/i);
    await expect(dlg.getByRole("button", { name: "Import 1 item as draft" })).toBeEnabled();
    // Deliberately NOT pressed. The API spec proves the commit.
  });

  test("export downloads exactly what the filters show", async ({ page }) => {
    await openItems(page);
    await page.getByLabel("Stage").selectOption("04");
    const shown = Number(await page.locator("[data-total]").getAttribute("data-total"));
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: `Export ${shown} as JSON` }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^octa-items-.*\.json$/);
    const chunks: Buffer[] = [];
    for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(body.items).toHaveLength(shown);
    for (const i of body.items) expect(i.stageId).toBe("04");
    await expect(page.locator("[data-toaster]")).toContainText(`Exported ${shown} items`);
  });
});
