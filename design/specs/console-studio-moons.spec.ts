import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { TEACHER_ID, useFixture } from "./_content-fixture";

/**
 * The Studio's moons editor (`/studio/cpe-412/:stageId`, the Moons card; E2, 8 Oct
 * 2026; `docs/STUDIO-EDITOR-PLAN.md` "E2 -- the moons plan"; template
 * `design/templates/console/studio-moons/`): a moon is a row with a code, a sentence
 * and a status told by a shape AND a word; typing waits as an unpublished change,
 * a new moon is a draft, a retirement waits, and ONE dialog publishes, saying who
 * would see a planet close and which minigame leaves the map.
 *
 * Reads are the real seed (chapter 04's real moons, 04.5 carrying Cache Tuner); the
 * moon routes are a stateful stand-in here (writes are recorded, never sent). The
 * server's rules are tested in `services/api/test/studio-moons-api.spec.ts`; this
 * file holds what the page does and the six gate assertions on its states.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function teacherToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: TEACHER_ID, email: "teacher@example.com", aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}
const TEACHER = teacherToken();

interface Moon {
  id: string; status: string; owner: string; description: string; bloom: string; level: number | null;
  competency: string | null; questions: number; notLive: number; publishable: boolean; game: string | null;
  removable: boolean;
  /** Sat as a graded check that counts as one more quiz (docs/GRADED-MOONS-PLAN.md). */
  graded: boolean;
  pending: null | { action: string; graded: boolean | null; description: string | null; bloom: string | null; level: number | null; competency: string | null; version: number; editedBy: string | null; editedAt: string };
}
interface MoonWrites {
  add: Array<Record<string, unknown>>;
  pending: Array<{ id: string; body: Record<string, unknown> }>;
  discard: string[];
  remove: string[];
  preview: Array<Record<string, unknown>>;
  publish: Array<Record<string, unknown>>;
}
interface MoonOpts {
  /** A save of a pending change is refused as stale. */
  stale?: boolean;
  /** The dry run is refused (a rule of the server's), with this sentence. */
  previewFails?: string;
  /** Students who would see the next planet close. */
  relocked?: number;
}

/** The moon routes: the real first read, then a stateful stand-in. Registered AFTER `useFixture`, so it answers first. */
async function useMoons(page: Page, opts: MoonOpts = {}) {
  const writes: MoonWrites = { add: [], pending: [], discard: [], remove: [], preview: [], publish: [] };
  let state: { stageId: string; gradeable: boolean; minQuestions: number; moons: Moon[] } | null = null;
  let n = 0;
  const body = () => ({ ...state!, hash: `fixture-moons-${n}` });
  const stale = (route: Route) =>
    route.fulfill({ status: 409, json: { error: { code: "conflict", message: "Moon was changed by someone else since you opened it. Reload to see their change." } } });

  await page.route(/\/api\/v1\/console\/content\/(\d\d\/moons(\/publish)?|moons\/[^/]+(\/pending)?)(\?.*)?$/, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/console\/content\//, "");
    const method = req.method();

    if (/^\d\d\/moons$/.test(path) && method === "GET") {
      if (!state) state = (await (await route.fetch()).json()) as NonNullable<typeof state>;
      return route.fulfill({ json: body() });
    }
    if (/^\d\d\/moons$/.test(path) && method === "POST") {
      const b = req.postDataJSON() as Record<string, unknown>;
      writes.add.push(b);
      const next = Math.max(0, ...state!.moons.map((m) => Number(m.id.split(".")[1]))) + 1;
      const id = `${state!.stageId}.${next}`;
      state!.moons.push({
        id, status: "draft", owner: "console", description: String(b.description), bloom: String(b.bloom), level: Number(b.level),
        competency: String(b.competency), questions: 0, notLive: 0, publishable: false, game: null, removable: true,
        graded: b.graded !== false, pending: null,
      });
      n++;
      return route.fulfill({ json: { ok: true, id } });
    }
    let m = /^moons\/([^/]+)\/pending$/.exec(path);
    if (m && method === "PUT") {
      if (opts.stale) return stale(route);
      const b = req.postDataJSON() as Record<string, unknown>;
      writes.pending.push({ id: m[1]!, body: b });
      const moon = state!.moons.find((x) => x.id === m![1])!;
      const version = (moon.pending?.version ?? 0) + 1;
      moon.pending = {
        action: String(b.action), description: (b.description as string) ?? null, bloom: (b.bloom as string) ?? null,
        level: (b.level as number) ?? null, competency: (b.competency as string) ?? null,
        // The server stores the switch only when it differs from the moon's: null leaves it as it is.
        graded: typeof b.graded === "boolean" && b.graded !== moon.graded ? b.graded : null, version, editedBy: "The Teacher", editedAt: new Date().toISOString(),
      };
      n++;
      return route.fulfill({ json: { ok: true, version } });
    }
    if (m && method === "DELETE") {
      writes.discard.push(m[1]!);
      state!.moons.find((x) => x.id === m![1])!.pending = null;
      n++;
      return route.fulfill({ json: { ok: true, removed: true } });
    }
    m = /^moons\/([^/]+)$/.exec(path);
    if (m && method === "DELETE") {
      writes.remove.push(m[1]!);
      state!.moons = state!.moons.filter((x) => x.id !== m![1]);
      n++;
      return route.fulfill({ json: { ok: true } });
    }
    if (/^\d\d\/moons\/publish$/.test(path) && method === "POST") {
      const b = req.postDataJSON() as { ids: string[]; dryRun: boolean; reason: string };
      if (b.dryRun && opts.previewFails) {
        return route.fulfill({ status: 409, json: { error: { code: "conflict", message: opts.previewFails } } });
      }
      const picked = state!.moons.filter((x) => b.ids.includes(x.id));
      const applied = picked.map((x) => {
        const change = x.pending?.action === "retire" ? "retire" : x.status === "draft" ? "publish" : "edit";
        const flips = x.pending?.graded != null && x.pending.graded !== x.graded;
        const moves = change === "retire" ? ["leaves the map, the grid and the lock's count"]
          : change === "publish" ? ["goes live: students see it and the lock counts it"]
            : flips ? [x.pending!.graded ? "becomes GRADED: its check counts as one more quiz" : "stops being graded: its check leaves the gradebook"]
              : ["new wording"];
        return { id: x.id, change, moves };
      });
      const grading = picked
        .filter((x) => x.pending?.graded != null && x.pending.graded !== x.graded)
        .map((x) => ({ id: x.id, graded: x.pending!.graded as boolean, students: 0 }));
      const result = {
        ok: true, dryRun: b.dryRun, applied, grading,
        gamesRemoved: picked.filter((x) => x.pending?.action === "retire" && x.game).map((x) => ({ id: x.id, name: x.game })),
        impact: {
          relocked: opts.relocked ?? 0,
          stages: (opts.relocked ?? 0) > 0 ? [{ stageId: "05", students: opts.relocked }] : [],
        },
        selfApproved: true,
      };
      if (b.dryRun) {
        writes.preview.push(b);
        return route.fulfill({ json: result });
      }
      writes.publish.push(b);
      for (const x of picked) {
        if (x.pending?.action === "retire") x.status = "retired";
        else {
          if (x.pending?.description) x.description = x.pending.description;
          if (x.pending?.graded != null) x.graded = x.pending.graded;
          x.status = "live";
          x.owner = "console";
        }
        x.pending = null;
      }
      n++;
      return route.fulfill({ json: result });
    }
    return route.continue();
  });
  return { writes, moons: () => state!.moons };
}

async function open(page: Page, opts: MoonOpts = {}, id = "04") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  await useFixture(page, {});
  const fx = await useMoons(page, opts);
  await page.goto(`${CONSOLE_URL}/studio/cpe-412/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator("main h1").first().waitFor({ timeout: 15_000 });
  await page.locator("[data-moons] [data-moon]").first().waitFor({ timeout: 15_000 });
  return fx;
}

const card = (page: Page) => page.locator("[data-moons]");
const row = (page: Page, id: string) => card(page).locator(`[data-moon="${id}"]`);
const review = (page: Page) => card(page).getByRole("button", { name: /^Review moon changes/ });

/** Edit moon `id`'s wording and save: leaves an unpublished change. */
async function editWording(page: Page, id: string, text: string) {
  await row(page, id).getByRole("button", { name: `Edit moon ${id}` }).click();
  const box = page.getByRole("form", { name: `Edit moon ${id}` }).getByRole("textbox");
  await box.fill(text);
  await page.getByRole("form", { name: `Edit moon ${id}` }).getByRole("button", { name: "Save change" }).click();
  await expect(row(page, id)).toHaveAttribute("data-pending", "edit");
}

async function addDraft(page: Page, text = "Explain how a write-back cache handles a dirty line") {
  await card(page).getByRole("button", { name: "Add a moon" }).click();
  const form = page.getByRole("form", { name: "A new moon" });
  await form.getByRole("textbox").fill(text);
  await form.getByLabel("Level (ring)").selectOption("5");
  await form.getByRole("button", { name: "Add moon" }).click();
}

test.describe("the moons: a row is a code, a sentence, a status in a word and a shape", () => {
  test("the chapter's real moons are rows, each Live, with its questions counted and its game named; nothing is waiting", async ({ page }) => {
    const fx = await open(page);
    const moons = fx.moons();
    expect(moons.length, "chapter 04 has moons").toBeGreaterThan(3);
    await expect(card(page).locator("[data-moon]")).toHaveCount(moons.length);
    for (const m of moons) {
      const r = row(page, m.id);
      await expect(r).toContainText(m.description);
      await expect(r).toContainText("Live");
      await expect(r.locator("[data-moon-facts]")).toContainText(`${m.questions} live`);
    }
    await expect(row(page, "04.5")).toContainText("Game: Cache Tuner");
    await expect(review(page)).toBeDisabled();
    await expect(card(page).getByRole("button", { name: "Add a moon" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Publish/ })).toHaveCount(1); // the chapter's own Publish, not the moons'
  });

  test("editing a moon's wording saves an unpublished change: the live sentence stays, the proposal shows beside it", async ({ page }) => {
    const fx = await open(page);
    const original = fx.moons().find((m) => m.id === "04.1")!.description;
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    expect(fx.writes.pending).toHaveLength(1);
    expect(fx.writes.pending[0]).toMatchObject({
      id: "04.1",
      body: { action: "edit", version: 0, description: "Define the cache terms precisely, in the book's own words" },
    });
    const r = row(page, "04.1");
    await expect(r).toContainText("Edit waiting to publish");
    await expect(r).toContainText(original);
    await expect(r.locator("[data-moon-proposed]")).toContainText("Define the cache terms precisely");
    await expect(review(page)).toBeEnabled();
    await expect(review(page)).toContainText("(1)");
    // Discard throws it away and the row reads as it did.
    await r.getByRole("button", { name: "Discard the change to moon 04.1" }).click();
    await expect(r).toHaveAttribute("data-pending", "");
    expect(fx.writes.discard).toEqual(["04.1"]);
  });

  test("a new moon is a draft: it says how many live questions it still needs, and may be deleted while it has none", async ({ page }) => {
    const fx = await open(page);
    await addDraft(page);
    expect(fx.writes.add).toEqual([{ description: "Explain how a write-back cache handles a dirty line", bloom: "understand", level: 5, competency: "read", graded: true }]);
    const id = fx.moons().at(-1)!.id;
    const r = row(page, id);
    await expect(r).toHaveAttribute("data-status", "draft");
    await expect(r).toContainText("Draft");
    await expect(r.locator("[data-moon-facts]")).toContainText("0 of 3 live questions needed");
    await expect(r.getByRole("button", { name: `Delete draft moon ${id}` })).toBeVisible();
    await expect(review(page)).toContainText("(1)");
    await r.getByRole("button", { name: `Delete draft moon ${id}` }).click();
    await expect(r).toHaveCount(0);
    expect(fx.writes.remove).toEqual([id]);
  });

  test("retiring a moon waits for Publish, and a moon with a game says which game leaves; Keep undoes it", async ({ page }) => {
    const fx = await open(page);
    await row(page, "04.5").getByRole("button", { name: "Retire moon 04.5" }).click();
    await expect(row(page, "04.5")).toHaveAttribute("data-pending", "retire");
    await expect(row(page, "04.5")).toContainText("Retirement waiting to publish");
    expect(fx.writes.pending[0]).toMatchObject({ id: "04.5", body: { action: "retire", version: 0 } });
    await expect(page.getByText(/takes Cache Tuner with it/)).toBeVisible();
    await row(page, "04.5").getByRole("button", { name: "Discard the change to moon 04.5" }).click();
    await expect(row(page, "04.5")).toHaveAttribute("data-pending", "");
  });

  test("a stale save is said in words and keeps what was typed", async ({ page }) => {
    await open(page, { stale: true });
    await row(page, "04.1").getByRole("button", { name: "Edit moon 04.1" }).click();
    const form = page.getByRole("form", { name: "Edit moon 04.1" });
    await form.getByRole("textbox").fill("A sentence the other teacher has not seen");
    await form.getByRole("button", { name: "Save change" }).click();
    await expect(form.getByRole("alert")).toContainText("changed by someone else");
    await expect(form.getByRole("textbox")).toHaveValue("A sentence the other teacher has not seen");
  });
});

test.describe("publishing moons: one dialog, the effect said before it is done", () => {
  test("it lists the moons, states the effect, asks a reason, and publishes what was named", async ({ page }) => {
    const fx = await open(page, { relocked: 3 });
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    await review(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("04.1 will change wording");
    const summary = dialog.locator("[data-moons-summary]");
    await expect(summary).toContainText("new wording");
    await expect(summary.locator("[data-relock]")).toContainText("3 students");
    await expect(summary.locator("[data-relock]")).toContainText("stage 05");
    expect(fx.writes.preview.at(-1)).toMatchObject({ ids: ["04.1"], dryRun: true });
    const publish = dialog.getByRole("button", { name: "Publish moons" });
    await expect(publish).toBeDisabled();
    await dialog.getByLabel("What changed (required)").fill("A clearer verb for the cache terms");
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(dialog).toBeHidden();
    expect(fx.writes.publish).toEqual([{ hash: expect.any(String), reason: "A clearer verb for the cache terms", ids: ["04.1"], dryRun: false }]);
    await expect(row(page, "04.1")).toHaveAttribute("data-pending", "");
    await expect(row(page, "04.1")).toContainText("Define the cache terms precisely");
    await expect(review(page)).toBeDisabled();
  });

  test("a draft with too few questions is listed as not ready and cannot be ticked; a retirement names the game it takes", async ({ page }) => {
    const fx = await open(page);
    await addDraft(page);
    await row(page, "04.5").getByRole("button", { name: "Retire moon 04.5" }).click();
    await expect(row(page, "04.5")).toHaveAttribute("data-pending", "retire");
    await review(page).click();
    const dialog = page.getByRole("dialog");
    const draftId = fx.moons().at(-1)!.id;
    const draftBox = dialog.getByRole("checkbox", { name: new RegExp(`^${draftId.replace(".", "\\.")} will go live`) });
    await expect(draftBox).toBeDisabled();
    await expect(dialog).toContainText("0 of 3 live questions");
    await expect(dialog.getByRole("checkbox", { name: /^04\.5 will retire/ })).toBeChecked();
    await expect(dialog.locator("[data-moons-summary]")).toContainText("The minigame Cache Tuner leaves the map");
    await expect(dialog.locator("[data-moons-summary]")).toContainText("No student loses a planet they have open.");
  });

  test("when the server refuses the preview the reason is shown and Publish stays shut", async ({ page }) => {
    await open(page, { previewFails: "Moon 04.5 is the last live moon of chapter 04; retiring it would keep every planet after it shut." });
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    await review(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("[data-moons-summary]")).toContainText("Cannot publish yet. Moon 04.5 is the last live moon");
    await dialog.getByLabel("What changed (required)").fill("A reason that is long enough");
    await expect(dialog.getByRole("button", { name: "Publish moons" })).toBeDisabled();
  });
});

/* ======================================================================
 * THE GATE — CONSOLE-REVAMP.md §2, on the moons' states
 * ==================================================================== */

async function states(page: Page, fx: Awaited<ReturnType<typeof useMoons>>, visit: (label: string) => Promise<void>) {
  await visit("rows");
  await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
  await visit("a change waiting");
  await row(page, "04.2").getByRole("button", { name: "Edit moon 04.2" }).click();
  await visit("the edit form");
  await page.getByRole("form", { name: "Edit moon 04.2" }).getByRole("button", { name: "Cancel" }).click();
  await card(page).getByRole("button", { name: "Add a moon" }).click();
  await visit("the add form");
  const form = page.getByRole("form", { name: "A new moon" });
  await form.getByRole("textbox").fill("Explain how a write-back cache handles a dirty line");
  await form.getByRole("button", { name: "Add moon" }).click();
  await expect(card(page).locator("[data-moon][data-status=draft]")).toHaveCount(1);
  await review(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500); // past the dialog's ease-in
  await visit("the publish dialog");
  void fx;
}

test.describe("the gate — the moons' states", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    const fx = await open(page, { relocked: 2 });
    await states(page, fx, async (label) => expect(await clippedElements(page), label).toEqual([]));
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    const fx = await open(page, { relocked: 2 });
    await states(page, fx, async (label) => expect(await horizontalOverflow(page), label).toBeLessThanOrEqual(0));
  });

  test("3 · every control is reachable from the keyboard alone", async ({ page }) => {
    const fx = await open(page);
    await states(page, fx, async (label) => {
      if (label === "the publish dialog") return; // a modal: Radix traps focus inside it
      expect(await unreachableByKeyboard(page, "main"), label).toEqual([]);
    });
    // And the dialog's own controls take the keyboard: the reason, then Publish.
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What changed (required)").focus();
    await page.keyboard.type("Reachable by keyboard");
    await expect(dialog.getByRole("button", { name: "Publish moons" })).toBeEnabled();
  });

  test("4 · AA contrast, computed, on all three themes", async ({ page }) => {
    test.setTimeout(240_000);
    const fx = await open(page, { relocked: 2 });
    // Reach the richest states once, then sweep the themes over each.
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    await row(page, "04.5").getByRole("button", { name: "Retire moon 04.5" }).click();
    await expect(row(page, "04.5")).toHaveAttribute("data-pending", "retire");
    await row(page, "04.2").getByRole("button", { name: "Edit moon 04.2" }).click();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, "[data-moons]"), `${theme}: rows, a change, a retirement, the edit form`).toEqual([]);
    }
    await page.getByRole("form", { name: "Edit moon 04.2" }).getByRole("button", { name: "Cancel" }).click();
    await card(page).getByRole("button", { name: "Add a moon" }).click();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, "[data-moons]"), `${theme}: the add form`).toEqual([]);
    }
    await review(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(500);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page, "[role=dialog]"), `${theme}: the publish dialog`).toEqual([]);
    }
    void fx;
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    const fx = await open(page, { relocked: 2 });
    await states(page, fx, async (label) => expect(await offTokenStyles(page, "[data-moons], [role=dialog]"), label).toEqual([]));
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, the publish dialog eases in.
    await recordMotion(page);
    await open(page);
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    await review(page).click();
    const moving = await motionStarted(page, "dialog");
    expect(moving.length, "with motion allowed, the dialog should ease in").toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-moons] [data-moon]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await editWording(page, "04.2", "Describe the mapping functions in the book's order");
    await review(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ----- the looks, for a person: written to the template folder, opened by whoever reads them ----- */

test.describe("captures", () => {
  test("the moons, in their states", async ({ page }, info) => {
    const fx = await open(page, { relocked: 2 });
    const suffix = info.project.name === "desktop-1440" ? "" : "-380";
    const dir = "design/templates/console/studio-moons";
    await card(page).scrollIntoViewIfNeeded();
    await card(page).screenshot({ path: `${dir}/current${suffix}.png` });
    await editWording(page, "04.1", "Define the cache terms precisely, in the book's own words");
    await row(page, "04.5").getByRole("button", { name: "Retire moon 04.5" }).click();
    await expect(row(page, "04.5")).toHaveAttribute("data-pending", "retire");
    await row(page, "04.2").getByRole("button", { name: "Edit moon 04.2" }).click();
    await card(page).screenshot({ path: `${dir}/current-editing${suffix}.png` });
    await page.getByRole("form", { name: "Edit moon 04.2" }).getByRole("button", { name: "Cancel" }).click();
    await addDraft(page);
    await review(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/current-publish${suffix}.png` });
    void fx;
  });
});

/* ===========================================================================
 * The GRADED switch (docs/GRADED-MOONS-PLAN.md; instructor, 8 Oct 2026: "add a
 * control for each moon to be able [to say] if graded or not").
 * ========================================================================= */

const switchOf = (page: Page, id: string) => row(page, id).getByRole("switch", { name: `Moon ${id} is graded` });

test.describe("the Graded switch on a moon", () => {
  test("every live moon carries a switch, on, told by a word and not by colour alone", async ({ page }) => {
    const fx = await open(page);
    for (const m of fx.moons().filter((x) => x.status === "live")) {
      const sw = switchOf(page, m.id);
      await expect(sw, m.id).toHaveAttribute("aria-checked", "true");
      await expect(sw).toContainText("Graded");
      await expect(row(page, m.id).locator("[data-moon-facts]")).toContainText("graded");
    }
  });

  test("pressing it stages ONE change (the wording untouched), says so, and nothing is published", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    const before = fx.moons().find((x) => x.id === id)!;
    await switchOf(page, id).click();
    await expect(page.locator("[data-toaster]")).toContainText(`Moon ${id} will be practice only`);
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "false");
    await expect(switchOf(page, id)).toContainText("Practice only");
    await expect(row(page, id).locator("[data-grading-waiting]")).toContainText("Grading change waiting to publish");
    await expect(row(page, id)).toHaveAttribute("data-pending", "edit");
    await expect(review(page)).toContainText("(1)");
    // The server was sent the live wording, unchanged, and the switch.
    expect(fx.writes.pending).toHaveLength(1);
    expect(fx.writes.pending[0]!.body).toMatchObject({ action: "edit", graded: false, description: before.description });
    expect(fx.writes.publish).toEqual([]);
    // No "Proposed:" line repeating wording that did not change.
    await expect(row(page, id).locator("[data-moon-proposed]")).toHaveCount(0);
  });

  test("pressing it again, back to what is live, drops the change instead of saving a no-op", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(page, id).click();
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "false");
    await switchOf(page, id).click();
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "true");
    await expect(row(page, id)).toHaveAttribute("data-pending", "");
    expect(fx.writes.discard).toEqual([id]);
    await expect(review(page)).toBeDisabled();
  });

  test("it works from the keyboard: Space toggles it, and focus is visible", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(page, id).focus();
    await expect(switchOf(page, id)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "false");
    // The save runs and finishes; the keyboard user must still be on the switch.
    await expect(page.locator("[data-toaster]")).toContainText("practice only");
    await expect(switchOf(page, id)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "true");
    await expect(switchOf(page, id)).toBeFocused();
    const outline = await switchOf(page, id).evaluate((e) => getComputedStyle(e).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("a wording edit does not drop a flip already waiting", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(page, id).click();
    await expect(row(page, id)).toHaveAttribute("data-pending", "edit");
    await row(page, id).getByRole("button", { name: `Edit moon ${id}` }).click();
    const form = page.getByRole("form", { name: `Edit moon ${id}` });
    await form.getByRole("textbox").fill("A clearer wording for this moon, entirely");
    await form.getByRole("button", { name: "Save change" }).click();
    await expect(row(page, id).locator("[data-moon-proposed]")).toContainText("A clearer wording");
    expect(fx.writes.pending.at(-1)!.body).toMatchObject({ graded: false });
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "false");
  });

  test("Publish says what it does to the gradebook, and applies it", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(page, id).click();
    await expect(review(page)).toContainText("(1)");
    await review(page).click();
    const dialog = page.locator("[data-moons-dialog]");
    await expect(dialog).toContainText(`${id} will stop being graded`);
    await expect(dialog.locator("[data-moons-summary]")).toContainText("stops being graded");
    await expect(dialog.locator("[data-grading]")).toContainText("The gradebook changes");
    await expect(dialog.locator("[data-grading]")).toContainText(`${id} stops counting`);
    await expect(dialog.locator("[data-grading]")).toContainText("Every sitting is kept");
    await dialog.getByRole("textbox").fill("Practice only this term");
    await dialog.getByRole("button", { name: "Publish moons" }).click();
    await expect(page.locator("[data-toaster]")).toContainText("1 moon published");
    expect(fx.writes.publish).toHaveLength(1);
    await expect(switchOf(page, id)).toHaveAttribute("aria-checked", "false");
    await expect(row(page, id)).toHaveAttribute("data-pending", "");
  });

  test("a new moon is asked 'Graded', on by default; off sends practice only", async ({ page }) => {
    const fx = await open(page);
    await card(page).getByRole("button", { name: "Add a moon" }).click();
    const form = page.getByRole("form", { name: "A new moon" });
    const box = form.getByRole("checkbox", { name: /Graded/ });
    await expect(box).toBeChecked();
    await form.getByRole("textbox").fill("Explain how a write-back cache handles a dirty line");
    await box.uncheck();
    await form.getByRole("button", { name: "Add moon" }).click();
    await expect(page.locator("[data-toaster]")).toContainText("added as a draft");
    expect(fx.writes.add.at(-1)).toMatchObject({ graded: false });
  });

  test("a moon waiting to retire has no switch: there is nothing left to grade", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await row(page, id).getByRole("button", { name: `Retire moon ${id}` }).click();
    await expect(row(page, id)).toHaveAttribute("data-pending", "retire");
    await expect(switchOf(page, id)).toHaveCount(0);
  });

  test("the gate on a state with a flip waiting: nothing clipped, no sideways scroll, AA on all three themes, tokens, keyboard", async ({ page }) => {
    const fx = await open(page);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(page, id).click();
    await expect(row(page, id).locator("[data-grading-waiting]")).toBeVisible();
    expect(await clippedElements(page, "main")).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
    expect(await offTokenStyles(page, "[data-moons]")).toEqual([]);
    for (const t of THEMES) {
      await setTheme(page, t);
      expect(await contrastFailures(page, "[data-moons]"), t).toEqual([]);
    }
  });

  test("reduced motion: the switch snaps, it does not slide", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop-1440", "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    const fx = await open(calm);
    const id = fx.moons().find((x) => x.status === "live")!.id;
    await switchOf(calm, id).click();
    await expect(switchOf(calm, id)).toHaveAttribute("aria-checked", "false");
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1 && /mn-switch/.test(m.on));
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});
