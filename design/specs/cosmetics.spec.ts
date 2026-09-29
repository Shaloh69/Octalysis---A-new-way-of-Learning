import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * R2 — per-student cosmetics, seen rather than asserted in the abstract.
 *
 * `services/api/test/cosmetics.spec.ts` proves the boundary holds in code: the
 * cosmetic seed is not the exam seed, `layout.ts` has no notion of a student,
 * and no client file hashes anything. This file proves the *other* half, which
 * a unit test cannot: that two students actually get a visibly different
 * system, and that the map underneath it is the same map.
 *
 * R2's definition of done asks for exactly this — "screenshot two different
 * seeded students side by side... the systems look different but the
 * underlying map is identical in structure."
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

/**
 * Two students from `db/demo-seed.sql`, chosen because their derived cosmetics
 * differ on every axis — rotation, palette variant and biome — so a capture
 * that looks identical means something is wrong rather than merely unlucky.
 *
 * Fixture data by construction: no real name reaches `design/`.
 */
const STUDENTS = {
  a: { sub: "dddddddd-1111-4000-8000-000000000001", studentId: "232129001" },
  b: { sub: "dddddddd-1111-4000-8000-000000000006", studentId: "232129006" },
};

function mintDevToken(who: { sub: string; studentId: string }): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: who.sub,
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: who.studentId },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** Each page's per-planet biomes, as the cosmetics endpoint sent them. */
const skies = new WeakMap<Page, Record<string, string>>();

async function open(page: Page, who: keyof typeof STUDENTS): Promise<void> {
  await page.addInitScript(
    ([token]) => window.localStorage.setItem("octa:dev-token", token as string),
    [mintDevToken(STUDENTS[who])],
  );
  page.on("response", async (r) => {
    if (!r.url().endsWith("/api/v1/cosmetics") || !r.ok()) return;
    const body = (await r.json().catch(() => null)) as { planetBiomes?: Record<string, string> } | null;
    if (body?.planetBiomes) skies.set(page, body.planetBiomes);
  });
  await page.goto("/app", { waitUntil: "networkidle" });
  // Wait for the CONDITION, not for a stopwatch.
  //
  // This used to be `waitForTimeout(1800)` and it was flaky at eight parallel
  // workers against one Vite dev server: passing serially and failing in
  // parallel is the signature of a fixed sleep standing in for a real wait.
  // `data-planet` appears when the cosmetics fetch lands, which is the actual
  // precondition every assertion here depends on.
  await page.locator("html[data-planet]").waitFor({ state: "attached" });
  // The header, not the list: on `/app` the list is inside a collapsed
  // disclosure now, so waiting for it to be visible would hang.
  await page.locator(".map-header").waitFor();
}

/** The facts a student can ACT on. These must not vary between students. */
async function structure(page: Page): Promise<string[]> {
  // Read from `/app/stages`, which owns the complete list now. The comparison
  // is about what the curriculum CONTAINS for each student, which must be
  // identical -- only the dressing is allowed to differ.
  await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
  await page.locator(".stage-acts").waitFor();
  return page.locator(".stage-row-title").allTextContents();
}

/** The facts that are only about how it looks. These are supposed to vary. */
async function look(page: Page): Promise<{
  planet: string | null;
  realm: string | null;
  biome: string | null;
  sky: string;
}> {
  // On <html>, beside data-theme -- see cosmetic-seed.ts for why.
  const el = page.locator("html");
  return {
    planet: await el.getAttribute("data-planet"),
    realm: await el.getAttribute("data-realm"),
    // Since 30 Sep 2026 a star route carries NO biome: the biome is the
    // planet's, and belongs to the realm (WEB-REMAKE.md §1).
    biome: await el.getAttribute("data-biome"),
    // The per-planet biomes, one per stage: what the look now varies by.
    sky: JSON.stringify(skies.get(page) ?? null),
  };
}

async function capture(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const file = testInfo.outputPath(`${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test.describe("two students, one curriculum", () => {
  test("the systems look different", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the map is flat by ladder at 380px");

    await open(page, "a");
    const lookA = await look(page);
    await capture(page, "cosmetics-student-a", testInfo);

    const other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await open(other, "b");
    const lookB = await look(other);
    await capture(other, "cosmetics-student-b", testInfo);
    await other.close();

    // Both must actually be seeded -- a null here would mean the attribute
    // never landed and the whole feature is a no-op that still "passes".
    expect(lookA.planet).toMatch(/^v\d+$/);
    expect(lookB.planet).toMatch(/^v\d+$/);
    // /app is the star system: the realm is set, and no biome is.
    expect(lookA.realm).toBe("star");
    expect(lookB.realm).toBe("star");
    expect(lookA.biome).toBeNull();
    expect(lookB.biome).toBeNull();
    // Every planet has a biome, for both students.
    expect(Object.keys(JSON.parse(lookA.sky) as object)).toHaveLength(19);
    expect(Object.keys(JSON.parse(lookB.sky) as object)).toHaveLength(19);

    // These two are chosen to differ: palette variant and the planets' biomes.
    expect(
      `${lookA.planet}/${lookA.sky}`,
      "two students got an identical look -- is the seed reaching the client?",
    ).not.toBe(`${lookB.planet}/${lookB.sky}`);
  });

  test("the map underneath is the same map", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one run is enough for this");

    await open(page, "a");
    const structureA = await structure(page);

    const other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await open(other, "b");
    const structureB = await structure(other);
    await other.close();

    // 19 stages, same titles, same order, for both students. This is the line
    // the whole redesign rests on: cosmetics change what a student LOOKS at and
    // never what they can do or learn. A seeded value that reordered, added or
    // removed a stage would show up right here.
    expect(structureA).toHaveLength(19);
    expect(structureB).toEqual(structureA);
  });

  test("a student's look is stable across visits", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one run is enough for this");

    await open(page, "a");
    const first = await look(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("html[data-planet]").waitFor({ state: "attached" });
    // "The same reason the avatar is seeded from your ID" only works if it does
    // not change on you between sessions.
    expect(await look(page)).toEqual(first);
  });

  test("a planet wears its own biome, and the star system none", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one run is enough for this");

    await open(page, "b");
    const sky = skies.get(page)!;
    expect(sky, "the cosmetics response carried no planetBiomes").toBeTruthy();
    const html = page.locator("html");

    for (const stage of ["00", "04"]) {
      await page.goto(`/app/stage/${stage}`, { waitUntil: "domcontentloaded" });
      await expect(html).toHaveAttribute("data-realm", "biome");
      await expect(html, `planet ${stage}`).toHaveAttribute("data-biome", sky[stage]!);
    }

    // Leaving the planet returns the star system, with no biome left behind.
    await page.goto("/app/map", { waitUntil: "domcontentloaded" });
    await expect(html).toHaveAttribute("data-realm", "star");
    await expect(html).not.toHaveAttribute("data-biome", /.*/);
  });

  test("a reload into a planet paints its biome on the first frame", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one run is enough for this");

    await open(page, "b");
    const sky = skies.get(page)!;
    // Record <html> at the first animation frame: before the first paint, and
    // before any bundle has fetched anything.
    await page.addInitScript(() => {
      requestAnimationFrame(() => {
        const el = document.documentElement;
        (window as unknown as { __first: unknown }).__first = {
          realm: el.getAttribute("data-realm"),
          biome: el.getAttribute("data-biome"),
        };
      });
    });
    await page.goto("/app/stage/04", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window as unknown as { __first?: unknown }).__first);
    const first = await page.evaluate(() => (window as unknown as { __first: unknown }).__first);
    expect(first, "the first frame showed the wrong realm or biome").toEqual({
      realm: "biome",
      biome: sky["04"],
    });

    // And a deep link to a star route never paints a biome, even with one cached.
    await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window as unknown as { __first?: unknown }).__first);
    expect(await page.evaluate(() => (window as unknown as { __first: unknown }).__first)).toEqual({
      realm: "star",
      biome: null,
    });
  });
});
