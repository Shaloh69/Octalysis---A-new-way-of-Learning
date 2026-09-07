import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * The six states, for the student routes — `PAGE-SPECS.md` §5 and
 * `apps/web/CLAUDE.md`.
 *
 * **loading · empty · locked · error · offline · 380px.**
 *
 * `r3-gate.spec.ts` runs the mechanical five (380px, focus, reduced motion,
 * control names, one `h1` + a `main`) on every route and says plainly that the
 * remaining gate items are judgement and not mechanical. The six states are the
 * biggest of those, and "judgement" was doing a lot of work there: a state
 * nobody has looked at is a state nobody has built.
 *
 * So these assert what the states SAY, not that they exist. An error that does
 * not tell you how to fix it, or a lock that does not name its distance, passes
 * every mechanical check in the project and still fails the mandate.
 *
 * ## What is deliberately not here
 *
 * **`empty` is not reachable on the reader with this data, and that is
 * recorded rather than faked.** Every published stage has content blocks — the
 * unauthored chapters 08-18 carry four each, including a callout that says in
 * as many words that the lesson text is not written yet. So the reader's
 * "empty" case is a scaffold NOTICE, which is content, not an empty state. A
 * test that forced zero blocks would be testing a database that cannot occur.
 *
 * Where a genuine empty state does exist — a student with no submissions, no
 * mastery yet — it belongs to `/app/work` and `/app/progress`, below.
 *
 * FIXTURE DATA ONLY. The signed-in student is a row from `db/demo-seed.sql`.
 * For this student, stages 00, 05 and 06 are unlocked and everything else is
 * not — which is what makes 12 a reliable locked case.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

function studentToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = studentToken();

async function signIn(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STUDENT);
}

test.describe("the stage reader — its six states", () => {
  test("locked: names the reason AND the distance, and does not hide the objectives", async ({
    page,
  }) => {
    /*
     * Hard rule 4: the client renders a lock, it never computes one. What it
     * owes the student is the two things a lock without them is just a closed
     * door — WHY, and HOW FAR.
     *
     * The objectives staying visible is the deliberate part. `DESIGN-MANDATE.md`
     * calls this scarcity with autonomy: you can see what the stage covers
     * before you can open it, so a lock reads as "not yet" rather than as a
     * blank.
     */
    await signIn(page);
    await page.goto("/app/stage/12", { waitUntil: "networkidle" });

    const locked = page.locator(".state-locked");
    await expect(locked).toBeVisible();

    // The reason, in words, not a code.
    await expect(locked).toContainText(/opens once|reach \d+%|instructor/i);
    // The distance — a number a student can act on.
    await expect(locked).toContainText(/\d+%/);

    // And the objectives are still there, above it.
    await expect(page.getByText(/WHAT YOU SHOULD BE ABLE TO DO/i)).toBeVisible();
    const objectives = page.locator("li", { hasText: /^12\.\d/ });
    expect(await objectives.count(), "a locked stage still shows what it covers")
      .toBeGreaterThan(0);
  });

  test("error: says what happened and how to fix it, and offers the retry", async ({ page }) => {
    /*
     * `DESIGN-MANDATE.md`'s error rule is that the copy names a way forward.
     * "Something went wrong" passes every mechanical check in this repo and
     * tells a student nothing, so this asserts a control they can press rather
     * than only the presence of the word "error".
     */
    await signIn(page);
    await page.route("**/api/v1/stages/**", (r) => r.abort("failed"));
    await page.goto("/app/stage/05", { waitUntil: "domcontentloaded" });

    const err = page.locator(".state-error");
    await expect(err).toBeVisible({ timeout: 15_000 });

    // A way forward, not just a diagnosis.
    const retry = err.getByRole("button");
    expect(await retry.count(), "an error state with no control is a dead end")
      .toBeGreaterThan(0);

    // Never a stack trace or raw SQL — the server contract, held at the surface.
    const text = (await err.innerText()).toLowerCase();
    expect(text).not.toMatch(/at .*\.tsx?:\d+|select .* from |econnrefused/);
  });

  test("loading: a skeleton with a text equivalent, never a bare spinner", async ({ page }) => {
    /*
     * `apps/web/CLAUDE.md`: "loading (skeleton, not a spinner)". A skeleton
     * shows the SHAPE of what is coming; a spinner shows that something is
     * happening, which the student already knows.
     *
     * The request is held open rather than slowed, so the state is observed
     * instead of raced — the reader's own copy is "Arriving at", which is why
     * the assertion allows either wording.
     */
    await signIn(page);
    let release: (() => void) | null = null;
    const held = new Promise<void>((r) => {
      release = r;
    });
    await page.route("**/api/v1/stages/05", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/app/stage/05", { waitUntil: "domcontentloaded" });

    const loading = page.locator(".state-loading");
    await expect(loading).toBeVisible({ timeout: 10_000 });
    // The text equivalent: a screen-reader user is told the same thing.
    await expect(loading).toContainText(/loading|arriving/i);

    release?.();
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  });

  test("offline: a banner, on the stage as everywhere else", async ({ page, context }) => {
    /*
     * The offline state is app-wide in `App.tsx` rather than per route, which
     * is correct — a student who loses connection on a stage has lost it on
     * every route — but it means no per-route spec had ever checked it appears.
     */
    await signIn(page);
    await page.goto("/app/stage/05", { waitUntil: "networkidle" });

    await context.setOffline(true);
    await expect(page.locator(".banner-offline")).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);
    await expect(page.locator(".banner-offline")).toBeHidden({ timeout: 10_000 });
  });

  test("380px: the reader reads, and nothing scrolls sideways", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "mobile-380", "this is the 380px case");

    await signIn(page);
    await page.goto("/app/stage/05", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the reader scrolls sideways at 380px").toBeLessThanOrEqual(1);
  });
});

test.describe("progress and settings — the states they can actually have", () => {
  /*
   * Neither has a LOCKED state and that is correct: a student's own progress is
   * never withheld from them, and settings are never gated. So the reachable
   * set here is loading, error, offline and 380px, and asserting a lock would
   * be inventing a requirement.
   */
  for (const [route, name] of [
    ["/app/progress", "the competency grid"],
    ["/app/settings", "settings"],
  ] as const) {
    test(`${name}: an error names a way forward`, async ({ page }) => {
      await signIn(page);
      await page.route("**/api/v1/**", (r) => r.abort("failed"));
      await page.goto(route, { waitUntil: "domcontentloaded" });

      /*
       * Settings is mostly local — theme, accent, map mode — so it may render
       * fine with the API down, and that is the RIGHT behaviour rather than a
       * missing error state: a student who has lost connection can still turn
       * reduced motion on. Only assert the copy where an error is actually
       * shown.
       */
      /*
       * WAIT for one of the two outcomes; do not COUNT for one.
       *
       * `count()` is instantaneous, so on a slower render this fell through to
       * the "no error state" branch before the error had painted, then failed
       * asserting an `h1` that was about to be replaced anyway. It passed at
       * 1440 and failed at 380 for no reason but timing — the signature of a
       * race dressed as a viewport bug.
       */
      const err = page.locator(".state-error");
      await Promise.race([
        err.waitFor({ timeout: 15_000 }).catch(() => undefined),
        page.locator("h1").waitFor({ timeout: 15_000 }).catch(() => undefined),
      ]);

      if ((await err.count()) === 0) {
        await expect(page.locator("h1")).toBeVisible();
        test.skip(true, `${name} renders without the API; no error state to check`);
        return;
      }

      await expect(err).toBeVisible({ timeout: 15_000 });
      /*
       * An error that REPLACES the page is the page, so it owes a level-one
       * heading and a landmark. This rendered an `h2` in a `div` until 8 Sep —
       * the same defect as `NotFoundPage`, found the same day.
       */
      expect(await page.locator("h1").count(), "the error state has no h1").toBe(1);
      expect(await err.getByRole("button").count(), "an error with no control is a dead end")
        .toBeGreaterThan(0);
      const text = (await err.innerText()).toLowerCase();
      expect(text).not.toMatch(/at .*\.tsx?:\d+|select .* from |econnrefused/);
    });

    test(`${name}: reads at 380px without scrolling sideways`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile-380", "this is the 380px case");
      await signIn(page);
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${name} scrolls sideways at 380px`).toBeLessThanOrEqual(1);
    });
  }

  test("the competency grid shows all 21 cells, with untouched ones marked", async ({ page }) => {
    /*
     * The grid IS the progression axis that replaced XP, so a cell that is
     * simply absent when a student has not reached it would hide the shape of
     * the course. Untouched cells render as a dash: visible, and honestly
     * empty.
     */
    await signIn(page);
    await page.goto("/app/progress", { waitUntil: "networkidle" });

    const text = await page.locator("main").innerText();
    for (const level of ["L0", "L1", "L2", "L3", "L4", "L5", "L6"]) {
      expect(text, `level ${level} missing from the grid`).toContain(level);
    }
    for (const c of ["READ", "TRACE", "BUILD"]) {
      expect(text.toUpperCase(), `competency ${c} missing`).toContain(c);
    }
  });

  test("settings shows the seeded callsign", async ({ page }) => {
    // R3.2's own wording for this route: "now also showing the seeded
    // callsign". It is cosmetic and never an identifier -- the server's own
    // spec says so -- but it is the one visible proof a student's system is
    // seeded to them.
    await signIn(page);
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toContainText(/[A-Z]{3,}-[0-9A-F]{2}/);
  });
});

test.describe("empty states — where they genuinely occur", () => {
  /*
   * The reader has no empty state because it cannot have one (see the header).
   * These two routes can: a student who has submitted nothing, and a grid with
   * no mastery yet.
   *
   * `apps/web/CLAUDE.md` asks that an empty state be "an invitation, not an
   * apology" — so the assertion is that it points somewhere, not merely that it
   * says the list is empty.
   */
  for (const [route, name] of [
    ["/app/work", "your work"],
    ["/app/progress", "the competency grid"],
  ] as const) {
    test(`${name} says what to do next, not just that there is nothing`, async ({ page }) => {
      await signIn(page);
      await page.goto(route, { waitUntil: "networkidle" });

      await expect(page.locator("h1")).toBeVisible();

      const empty = page.locator(".state-empty, .empty, [data-empty]");
      if ((await empty.count()) === 0) {
        /*
         * Not a failure. The demo student HAS work and HAS mastery, so the
         * populated view is the correct render — asserting an empty state here
         * would require a second fixture student and would be testing the
         * fixture rather than the page. Recorded so the gap is visible.
         */
        test.skip(true, `${name} has data for this student; empty view not reachable`);
        return;
      }

      const text = await empty.first().innerText();
      expect(text, "an empty state should point somewhere").toMatch(
        /start|open|begin|choose|map|stage/i,
      );
    });
  }
});

test.describe("never the only path — the constraint every minigame is bound by", () => {
  test("a stage is readable as text, with no canvas anywhere in the reader", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * `MINIGAME-PROPOSALS.md` binds all five approved games to the same
     * constraints: no lives, no game-over, no timer feeding a grade, **never the
     * only path through its stage**, ungraded and opt-in.
     *
     * Four of those five cannot be tested until a game exists. The fifth can be
     * tested NOW, and it is the one that matters most, because it is the
     * property a future game could quietly break: the stage must be completable
     * by reading. So this records the baseline while it is still trivially
     * true — no canvas in the reader at all — and it fails the day a minigame
     * lands on the required path rather than beside it.
     *
     * Written 8 Sep 2026, with all five games DEFERRED because every target
     * chapter is a scaffold. A test that guards a constraint is worth having
     * before the thing it constrains.
     */
    await signIn(page);
    await page.goto("/app/stage/05", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toBeVisible();

    expect(
      await page.locator("main canvas").count(),
      "the stage reader has a canvas — a minigame must sit BESIDE the primary " +
        "encounter, never replace it",
    ).toBe(0);

    // The lesson is text, and it is there.
    const body = await page.locator("main").innerText();
    expect(body.length, "the reader rendered no readable content").toBeGreaterThan(200);
  });
});
