import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  motionStarted,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";
import { S006 } from "./_stage-fixture";

/**
 * `/app/work`, remade (WEB-REMAKE.md §8 row 8; design/templates/web/work/
 * SPEC.md): Starfield's inventory. The list of hand-ins with a score column,
 * the summary box, and the chosen one's card.
 *
 * Reads run against the real API (student 232129006 has one marked lab).
 * Saving and handing in are INTERCEPTED: a real PUT would leave a row in the
 * seeded database that other specs read.
 */

const ROUTE = ".work";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function work(page: Page, path = "/app/work"): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".work [data-card]").waitFor({ timeout: 15_000 });
}

test.describe("/app/work — the six gate assertions", () => {
  test("1 · nothing is clipped: a marked lab, and the new form", async ({ page }) => {
    for (const path of ["/app/work", "/app/work?item=new"]) {
      await work(page, path);
      expect(await clippedElements(page, ROUTE), path).toEqual([]);
    }
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const path of ["/app/work", "/app/work?item=new"]) {
      await work(page, path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await work(page, "/app/work?item=new");
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the star set", async ({ page }) => {
    for (const path of ["/app/work", "/app/work?item=new"]) {
      await work(page, path);
      expect(await contrastFailures(page, ROUTE), path).toEqual([]);
    }
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    for (const path of ["/app/work", "/app/work?item=new"]) {
      await work(page, path);
      expect(await offTokenStyles(page, ROUTE), path).toEqual([]);
    }
  });
  test("6 · reduced motion: choosing does not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    await recordMotion(page);
    await work(page);
    await page.getByRole("button", { name: /hand in something new/i }).click();
    expect((await motionStarted(page, "main", 50)).length, "nothing moved without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await work(calm);
    await calm.getByRole("button", { name: /hand in something new/i }).click();
    await calm.locator('.work [data-card="new"]').waitFor();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/work — what the page owes", () => {
  test("lists the API's hand-ins, each with its code, status in words and score", async ({ page, request }) => {
    await work(page);
    const res = await request.get(`${API}/api/v1/submissions`, { headers: { Authorization: `Bearer ${S006}` } });
    const { submissions } = (await res.json()) as { submissions: Array<{ id: string; slug: string; title: string; score: number | null; maxScore: number | null }> };
    await expect(page.locator(".work [data-item]")).toHaveCount(submissions.length);
    for (const s of submissions) {
      const row = page.locator(`[data-item="${s.id}"]`);
      await expect(row).toContainText(s.title.toUpperCase().slice(0, 12), { ignoreCase: true });
      await expect(row).toContainText(s.slug.toUpperCase());
      if (s.score !== null) await expect(row.locator(".work-item-score")).toHaveText(`${s.score}/${s.maxScore}`);
    }
  });

  test("a marked hand-in is read-only: its feedback, what was written, and no form", async ({ page }) => {
    await work(page);
    const card = page.locator(".work [data-card]");
    await expect(card).toContainText(/Marked/);
    await expect(card).toContainText(/Feedback/i);
    await expect(card.locator("textarea")).toHaveCount(0);
    await expect(card.locator(".mono").filter({ hasText: /\d+\/\d+/ }).first()).toBeVisible();
  });

  test("the write-up is the field: labelled, and says what it is worth", async ({ page }) => {
    await work(page, "/app/work?item=new");
    const body = page.getByRole("textbox", { name: "Your reasoning" });
    await expect(body).toBeVisible();
    await expect(page.locator(".work-form")).toContainText(/full point/);
    await expect(page.getByRole("button", { name: "Hand in", exact: true })).toBeDisabled();
  });

  test("Save draft confirms with one toast naming the code, and the list gains it", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    const added = { id: "0000aaaa-0000-4000-8000-000000000001", kind: "lab", slug: "lab-06", title: "Laboratory 06", bodyMd: "draft", status: "draft", submittedAt: null, score: null, maxScore: null, feedbackMd: null, isLate: false };
    let saved = false;
    await page.route("**/api/v1/submissions/**", (r) =>
      r.request().method() === "PUT" ? ((saved = true), r.fulfill({ json: { id: added.id, status: "draft", submittedAt: null, isLate: false } })) : r.fallback(),
    );
    await page.route("**/api/v1/submissions", async (r) => {
      if (!saved) return r.fallback();
      const res = await r.fetch();
      const json = (await res.json()) as { submissions: unknown[] };
      await r.fulfill({ response: res, json: { submissions: [...json.submissions, added] } });
    });
    await work(page, "/app/work?item=new");
    await page.getByRole("textbox", { name: "Which one?" }).fill("lab-06");
    await page.getByRole("textbox", { name: "Title" }).fill("Laboratory 06");
    await page.getByRole("textbox", { name: "Your reasoning" }).fill("draft");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("[data-toaster] [role=status]")).toHaveCount(1);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("LAB-06 draft saved");
    await expect(page.locator(`[data-item="${added.id}"]`)).toBeVisible();
    await expect(page.locator(".work [data-card]")).toHaveAttribute("data-card", added.id);
  });

  test("a refused hand-in says why, inline and in a toast that stays", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await page.route("**/api/v1/submissions/**", (r) =>
      r.request().method() === "PUT"
        ? r.fulfill({ status: 400, json: { error: { code: "bad_request", message: "Write your reasoning before you hand this in." } } })
        : r.fallback(),
    );
    await work(page, "/app/work?item=new");
    await page.getByRole("textbox", { name: "Which one?" }).fill("lab-06");
    await page.getByRole("textbox", { name: "Title" }).fill("Laboratory 06");
    await page.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(page.locator(".work-err")).toContainText(/reasoning/);
    const alert = page.locator("[data-toaster] [role=alert]");
    await expect(alert).toContainText("LAB-06 was not handed in");
    await page.waitForTimeout(4_500);
    await expect(alert, "a failure toast left on a timer").toBeVisible();
  });

  test("the star realm, and no biome", async ({ page }) => {
    await work(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
  });

  test("on a phone the card opens under its own row", async ({ page }, info) => {
    test.skip(wide(info), "the 380 case");
    await work(page);
    const row = page.locator(".work [data-item]").first();
    expect(await row.evaluate((el) => !!el.parentElement?.querySelector("[data-card]"))).toBe(true);
    await expect(page.locator("[data-card]")).toHaveCount(1);
  });
});

test.describe("/app/work — loading and failing", () => {
  test("a failed load is the page: an h1, the reason, and Try again that loads", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/submissions", (r) => (fail ? r.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong on our side." } } }) : r.fallback()));
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/work");
    const err = page.locator(".work.state-error");
    await expect(err).toBeVisible({ timeout: 15_000 });
    await expect(err.locator("h1")).toHaveCount(1);
    fail = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.locator(".work [data-card]").waitFor({ timeout: 15_000 });
  });

  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    await page.route("**/api/v1/submissions", async (r) => {
      await new Promise((f) => setTimeout(f, 4_500));
      await r.fallback();
    });
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/work");
    await page.waitForTimeout(150);
    await expect(page.locator(".work [data-skeleton]")).toHaveCount(0);
    await expect(page.locator(".work [data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await expect(page.locator(".work")).toContainText(/still loading/i, { timeout: 4_000 });
    await page.locator(".work [data-card]").waitFor({ timeout: 10_000 });
  });
});
