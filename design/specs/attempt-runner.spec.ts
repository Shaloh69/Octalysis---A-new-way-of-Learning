import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/app/stage/:id/check` — the attempt runner, and the highest-stakes surface
 * in the app.
 *
 * ## Why the first test is a denial test
 *
 * Root `CLAUDE.md` hard rule 1: **the answer key never reaches the browser.**
 * That is not a general good practice here — it is the specific defect this
 * whole project exists to fix. The repo OCTA replaces
 * (`CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-`) shipped
 * every answer to the client in `src/data/lessonData.js`, where any student
 * could read them from the bundle.
 *
 * Hard rule 8 says to test authorization by testing denial, so the leak is
 * asserted from the client's side: every response the page receives during a
 * live attempt is captured and searched. Server-side tests already prove the
 * payload is built without the key; this proves nothing puts it back on the way
 * out — a debug field, a widened `select *`, a helpful error.
 *
 * ## Why nothing here submits
 *
 * **Submitting would permanently break `node scripts/db-demo.mjs`.** Verified,
 * not assumed: `responses_attempt_id_fkey` is `ON DELETE CASCADE`, and
 * `demo-seed.sql:51` deletes attempts for every `dddddddd-%` fixture user. So
 * one submitted response makes that delete cascade into `responses`, where the
 * append-only trigger refuses it (hard rule 7) and psql aborts the seed
 * halfway — which presents as "stage 00 is locked" and has already cost this
 * project two rounds of debugging.
 *
 * That is the invariant working. It also means grading feedback -- the neutral
 * response to a wrong answer, the rationale card -- cannot be exercised from
 * here without a disposable database. It belongs in an API-level test, where
 * the fixture is torn down properly.
 *
 * FIXTURE DATA ONLY. Student `232129004` is the one fixture row with stage 07
 * unlocked, which is what makes its check reachable at all.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

/** The only fixture student with stage 07 open, hence the only one who can sit its check. */
function token(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-1111-4000-8000-000000000004",
    email: "232129004@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129004" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = token();

async function signIn(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STUDENT);
}

/**
 * Open stage 07 and enter its check.
 *
 * The control's label DEPENDS ON HISTORY: "Start the check" on a clean fixture,
 * "Start another attempt" once one exists. Both are matched, because a spec
 * that only works on a freshly reset database is a spec that fails the second
 * time anyone runs it — which is exactly how this one first failed.
 *
 * **This does not burn an attempt per run.** `POST /v1/attempts` RESUMES an
 * open attempt and answers `resumed: true` with the same id, so re-running the
 * suite re-enters the same paper rather than consuming one of the twenty
 * allowed. Verified: two entries left the fixture reading "1 of 20 attempts
 * used". If that ever changes, this suite starts quietly eating a student's
 * attempts, so the resume behaviour has a test of its own below.
 */
async function startCheck(page: Page): Promise<void> {
  await page.goto("/app/stage/07", { waitUntil: "networkidle" });
  const start = page
    .getByRole("button", { name: /^(start|resume|continue)/i })
    .first();
  await start.waitFor({ timeout: 15_000 });

  /*
   * Wait for the REQUEST the click is supposed to cause, not for the click to
   * return. `waitFor` proves the button is painted, not that React has attached
   * its handler yet, so a click can land on a live-looking control and do
   * nothing at all -- after which this helper sat waiting 15s for a question
   * that was never coming. It failed as "element(s) not found", which reads as
   * a bad selector and is really a race.
   */
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/v1/attempts") && r.request().method() === "POST",
      { timeout: 20_000 },
    ),
    start.click(),
  ]);
  /*
   * "Question N of M", not "Question 1 of M". A resumed attempt reopens where
   * the student left off, so pinning it to question 1 made this helper depend
   * on which OTHER test had run first -- the hard-rule-1 test answers one, and
   * everything after it then opened on question 2 and timed out. Order-dependent
   * flakiness, introduced by the resume behaviour the suite relies on.
   */
  await expect(page.getByText(/Question \d+ of \d+/i)).toBeVisible({ timeout: 15_000 });
}

/*
 * SERIAL, and it has to be.
 *
 * Every test here enters the SAME open attempt -- that is deliberate, because
 * `POST /v1/attempts` resumes rather than creating, which is what stops the
 * suite eating a student's twenty allowed attempts on every run. The cost is
 * that these tests share one piece of server-side state, so running them in
 * parallel has several browsers resuming and re-rendering the same paper at
 * once and the later arrivals find no question on screen.
 *
 * It presented as two tests failing "element(s) not found" while the same
 * helper worked fine for the other four -- which reads as a flaky selector and
 * is actually contention.
 */
/*
 * SERIAL, AND DELIBERATELY FEW ENTRIES.
 *
 * `POST /v1/attempts` is rate-limited to **10 per minute**
 * (`routes/attempts.ts:44`). An earlier draft of this file had six tests each
 * entering the check separately, which tripped that limiter and rendered
 * "That did not start — Too many attempts." The tests then failed with
 * "element(s) not found", which reads as a bad selector and was really the
 * server defending itself correctly.
 *
 * So the assertions are grouped by ENTRY rather than one per test: three
 * entries on desktop, one on mobile. Serial because they share one open
 * attempt.
 */
test.describe.configure({ mode: "serial" });

test.describe("the attempt runner", () => {
  test("HARD RULE 1: the answer key reaches neither the network nor the DOM", async ({
    page,
  }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * Capture EVERY api response, not just the attempt payload. A key can leak
     * from anywhere: the stage detail, the progress grid, an error body.
     *
     * This test answers NOTHING, so the paper stays pristine for the tests
     * after it. The answering case is the last test in this file.
     */
    const seen: Array<{ url: string; body: string }> = [];
    page.on("response", async (r) => {
      if (!r.url().includes("/api/v1/")) return;
      try {
        seen.push({ url: r.url().split("/api")[1] ?? r.url(), body: await r.text() });
      } catch {
        /* a body that cannot be read cannot leak a key */
      }
    });

    await signIn(page);
    await startCheck(page);
    await page.waitForTimeout(500);

    expect(seen.length, "no API traffic captured — the test proved nothing").toBeGreaterThan(3);

    /*
     * `correct_value` is the real column in `attempt_items`; the rest are the
     * shapes a well-meaning refactor tends to add beside it.
     */
    const forbidden = [
      /"correct_?value"/i,
      /"correct_?answer"/i,
      /"is_?correct"/i,
      /"answer_?key"/i,
      /"correct_?option"/i,
      /"correct_?index"/i,
    ];
    for (const { url, body } of seen) {
      for (const pattern of forbidden) {
        expect(
          body,
          `${url} carries ${pattern} — the answer key reached the browser, which is ` +
            `hard rule 1 and the exact defect this project replaced`,
        ).not.toMatch(pattern);
      }
    }

    /*
     * The other way a key leaks: a class, a `data-` attribute or an `aria-`
     * hint a curious student can read in devtools without opening the network
     * tab.
     */
    const html = await page.locator("main").innerHTML();
    for (const pattern of [/correct/i, /is-answer/i, /data-answer/i]) {
      expect(html, `the question markup hints at the answer via ${pattern}`).not.toMatch(pattern);
    }
  });

  test("a reload resumes the attempt, and the paper says where you are", async ({
    page,
  }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * Attempt number is graded data — `attempts_allowed` caps it — so a refresh
     * that silently burned one would cost a student a try they never used.
     *
     * The orientation assertions ride along on this same entry rather than
     * taking another: a student mid-paper should never have to guess how much
     * is left, and the warning about unanswered questions must name the cost
     * rather than just warn. "Are you sure?" tells nobody anything.
     */
    const ids: string[] = [];
    page.on("response", async (r) => {
      if (!r.url().includes("/api/v1/attempts")) return;
      try {
        const j = JSON.parse(await r.text()) as { attemptId?: string };
        if (j.attemptId) ids.push(j.attemptId);
      } catch {
        /* not the JSON we are after */
      }
    });

    await signIn(page);
    await startCheck(page);

    const main = page.locator("main");
    await expect(main).toContainText(/\d+\s*\/\s*\d+\s*answered/i);
    await expect(main).toContainText(/unanswered/i);
    await expect(main, "the warning should name the cost, not just warn").toContainText(
      /score zero|scores? zero|no marks|zero/i,
    );

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/Question \d+ of \d+/i)).toBeVisible({ timeout: 15_000 });

    expect(ids.length, "no attempt responses captured").toBeGreaterThan(1);
    expect(new Set(ids).size, `a reload started a second attempt: ${ids.join(", ")}`).toBe(1);
  });

  test("HARD RULE 1: answering does not fetch the key either", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * Answering is the moment a naive implementation asks the server "was that
     * right?" and is told. It must not: grading happens once, on submit, in
     * `services/api`. Anything that lets a student probe an answer before
     * committing to it is the same leak in a different shape.
     *
     * LAST on purpose — the only test here that leaves the fixture different
     * from how it found it.
     */
    const seen: string[] = [];
    page.on("response", async (r) => {
      if (!r.url().includes("/api/v1/")) return;
      try {
        seen.push(await r.text());
      } catch {
        /* unreadable bodies cannot leak */
      }
    });

    await signIn(page);
    await startCheck(page);

    await page.locator('input[type="radio"], [role="radio"], .option').first().click();
    await page.waitForTimeout(1200);

    for (const body of seen) {
      expect(body, "answering a question fetched something about correctness").not.toMatch(
        /"correct_?value"|"correct_?answer"|"is_?correct"|"answer_?key"/i,
      );
    }

    // And the page still does not say whether it was right.
    await expect(
      page.locator("main"),
      "the runner graded an answer client-side",
    ).not.toContainText(/correct!|incorrect|well done|wrong/i);
  });

  test("380px: the runner is usable, and nothing scrolls sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-380", "this is the 380px case");

    /*
     * The one surface where a horizontal scrollbar is not merely untidy: an
     * option pushed off-screen is an answer a student cannot select, on a
     * graded paper.
     */
    await signIn(page);
    await startCheck(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the attempt runner scrolls sideways at 380px").toBeLessThanOrEqual(1);

    const options = page.locator('input[type="radio"], [role="radio"], .option');
    expect(await options.count(), "no options are reachable at 380px").toBeGreaterThan(0);
  });
});
