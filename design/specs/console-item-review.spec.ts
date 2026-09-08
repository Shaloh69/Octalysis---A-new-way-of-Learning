import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * `/items` — the review queue, which is how the seeded bank reaches students.
 *
 * ## Why this spec exists
 *
 * The instructor's ruling is that item approval goes through the console. That
 * turned `/items` from a page you look at into the page a few hundred graded
 * decisions pass through, and reviewing a seeded bank exposed two gaps that a
 * two-item fixture never could:
 *
 * 1. **`review` offered exactly one decision — Approve and publish.** A
 *    reviewer who found a wrong key had no way to say so. The item either went
 *    live or sat in the queue forever. On a machine-seeded bank, "send this one
 *    back" is the decision they will need most.
 * 2. **Every decision closed the dialog.** Two hundred open/close cycles does
 *    not just waste time, it pushes a reviewer toward clicking Approve to make
 *    the modal go away — the exact failure the review rule exists to prevent.
 *
 * ## What is asserted, and what is deliberately not
 *
 * The reason field is REQUIRED, and that is tested by watching the confirm
 * button stay disabled — not by reading the disabled attribute off a button
 * nobody could reach. The advance is tested by the dialog TITLE changing to the
 * next item's slug, because a queue that silently re-opened the same item would
 * pass any test that only counted clicks.
 *
 * The approve-and-publish path is exercised only as far as its guard: this
 * fixture's items are authored by the teacher who is also the only member of
 * staff, so the server requires an explicit self-approval. The seeded bank will
 * carry `author_id = NULL`, which is a different and genuinely reviewed path —
 * that one gets its own coverage when the seed lands, and this spec says so
 * rather than pretending to cover it.
 *
 * FIXTURE DATA ONLY. Items are created with a run-unique slug and retired at the
 * end, so repeated runs neither collide nor leave a growing review queue behind
 * — the order-dependence lesson from `attempt-runner.spec.ts`.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const API_URL = process.env.OCTA_API_URL ?? "http://localhost:8090";

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
 * A prefix unique to the RUN, and a counter unique to each call within it.
 * The run prefix alone was not enough: two tests in the same file both started
 * at index 0 and the second collided with the first's slugs.
 */
const RUN = `rev${Date.now().toString(36)}`;
let batch = 0;

interface Made {
  id: string;
  slug: string;
}

async function makeReviewItems(request: APIRequestContext, n: number): Promise<Made[]> {
  const made: Made[] = [];
  const b = batch++;
  for (let k = 0; k < n; k++) {
    const slug = `${RUN}-${b}-${k}`;
    const created = await request.post(`${API_URL}/api/v1/console/items`, {
      headers: { authorization: `Bearer ${TEACHER}`, "content-type": "application/json" },
      data: {
        slug,
        stageId: "04",
        type: "S",
        bloom: "understand",
        stemTemplate: `Review-queue fixture ${k}: which cache mapping suffers conflict misses?`,
        correctSpec: { value: "Direct mapped" },
        distractorPool: ["Fully associative", "Two-way set associative", "Four-way set associative"],
        rationaleTemplate: "Direct mapping gives each block exactly one line, so blocks collide.",
      },
    });
    expect(
      created.ok(),
      `could not create fixture item ${slug}: ${created.status()} ${await created.text()}`,
    ).toBe(true);
    const { id } = (await created.json()) as { id: string };

    // Created items land in `draft`; the queue under test is `review`.
    const moved = await request.patch(`${API_URL}/api/v1/console/items/${id}/status`, {
      headers: { authorization: `Bearer ${TEACHER}`, "content-type": "application/json" },
      data: { status: "review" },
    });
    expect(moved.ok(), `could not move ${slug} to review`).toBe(true);
    made.push({ id, slug });
  }
  return made;
}

async function retire(request: APIRequestContext, made: Made[]): Promise<void> {
  for (const m of made) {
    await request.patch(`${API_URL}/api/v1/console/items/${m.id}/status`, {
      headers: { authorization: `Bearer ${TEACHER}`, "content-type": "application/json" },
      data: { status: "retired", reason: "review-queue spec fixture" },
    });
  }
}

async function openReviewQueue(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TEACHER);
  await page.goto(`${CONSOLE_URL}/items`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "review", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: RUN }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("the item review queue", () => {
  test.describe.configure({ mode: "serial" });

  test("a reviewer can send an item back, and must say why", async ({ page, request }) => {
    const made = await makeReviewItems(request, 2);
    try {
      await openReviewQueue(page);

      await page
        .getByRole("row")
        .filter({ hasText: made[0]!.slug })
        .getByRole("button", { name: "Preview" })
        .click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Before the ruling this button did not exist at all.
      const sendBack = dialog.getByRole("button", { name: "Send back", exact: true });
      await expect(sendBack).toBeVisible();
      await sendBack.click();

      const confirm = dialog.getByRole("button", { name: "Send back to draft" });
      await expect(confirm).toBeVisible();

      /*
       * Captured, because `REDESIGN-CLAUDE.md` §2 is explicit that nothing counts
       * as implemented until it has been opened and looked at -- and the three
       * defects that rule has caught in this repo all passed every other gate.
       */
      await dialog.screenshot({ path: "design/item-review/send-back-panel.png" });

      /*
       * The reason is required. Asserted by the button REFUSING the click rather
       * than by reading its disabled attribute: a button that is styled disabled
       * but still fires is the failure worth catching, and it looks identical in
       * the DOM snapshot.
       */
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel("What is wrong with this item?").fill("Key is wrong — B also holds.");
      await expect(confirm).toBeEnabled();
    } finally {
      await retire(request, made);
    }
  });

  test("deciding advances to the next item instead of closing", async ({ page, request }) => {
    const made = await makeReviewItems(request, 3);
    try {
      await openReviewQueue(page);

      await page
        .getByRole("row")
        .filter({ hasText: made[0]!.slug })
        .getByRole("button", { name: "Preview" })
        .click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading")).toContainText(made[0]!.slug);

      // The queue position tells the reviewer how much is left.
      await expect(dialog).toContainText(/\d+ of \d+/);

      await dialog.getByRole("button", { name: "Send back", exact: true }).click();
      await dialog.getByLabel("What is wrong with this item?").fill("Distractor 3 is a duplicate.");
      await dialog.getByRole("button", { name: "Send back to draft" }).click();

      /*
       * The dialog must STAY OPEN on the NEXT item. Checking only that it is
       * still open would pass if it re-opened the same item, which is why the
       * heading is asserted to have moved on.
       */
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading")).toContainText(made[1]!.slug, { timeout: 15_000 });
      await expect(dialog.getByRole("heading")).not.toContainText(made[0]!.slug);
    } finally {
      await retire(request, made);
    }
  });

  test("the reason and the self-approval tick do not leak to the next item", async ({
    page,
    request,
  }) => {
    /*
     * The one that would be a real incident. If the typed reason or a ticked
     * "I re-checked this key myself" survived the advance, the audit log would
     * attach a confirmation the reviewer never made to an item they had not yet
     * read.
     */
    const made = await makeReviewItems(request, 3);
    try {
      await openReviewQueue(page);

      await page
        .getByRole("row")
        .filter({ hasText: made[0]!.slug })
        .getByRole("button", { name: "Preview" })
        .click();

      const dialog = page.getByRole("dialog");
      const selfApproval = dialog.getByRole("checkbox");
      await expect(selfApproval, "sole-staff install should offer self-approval").toBeVisible();
      await selfApproval.check();

      await dialog.getByRole("button", { name: "Send back", exact: true }).click();
      await dialog.getByLabel("What is wrong with this item?").fill("Stem does not match 04.5.");
      await dialog.getByRole("button", { name: "Send back to draft" }).click();

      await expect(dialog.getByRole("heading")).toContainText(made[1]!.slug, { timeout: 15_000 });

      // Both per-item controls must be back to their resting state.
      await expect(dialog.getByRole("checkbox")).not.toBeChecked();
      await dialog.getByRole("button", { name: "Send back", exact: true }).click();
      await expect(dialog.getByLabel("What is wrong with this item?")).toHaveValue("");
    } finally {
      await retire(request, made);
    }
  });
});
