import type { Page, Route } from "@playwright/test";

/**
 * `/audit`, on the REAL seeded log.
 *
 * `db/demo-audit.sql` seeds a semester of history the demo state agrees with
 * (roster import, account claims, items to review, a lock opened and handed
 * back, lab marks, the Prelim's window), and `console-audit.spec.ts` writes
 * its own lock rows through the real endpoint. What the seed must NOT claim is
 * a content edit or a summary decision (the demo has none, and /content's
 * spec reads 0 of 19 approved), or an entry with no actor (audit_log is
 * append-only, so a null-actor demo row could never be tidied away).
 *
 * So the UNFILTERED first page gets four entries patched in, each worded
 * exactly as `services/api/src/audit/log.ts` words it, which
 * `services/api/test/console.spec.ts` pins: a content edit, a summary approved
 * (with its text), one sent back while live, and a scheduled lock window.
 * Every filtered read, every Load older and the export go to the API as-is.
 */

export const TEACHER_NAME = "Prof. Amalia R. Bontuyan";
export const TEACHER_ID = "dddddddd-0000-4000-8000-000000000001";

export const FIX = {
  editReason: "Fix a typo in the definition: 'orginization' for 'organization'",
  approvedText:
    "Stage 01 separates what a programmer can see of a machine from the choices made underneath it, and asks you to sort features into one or the other.",
  sendBackReason: "Too long for the map sidebar: two sentences at most",
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function extras() {
  const teacher = { id: TEACHER_ID, name: TEACHER_NAME };
  return [
    {
      id: "990000004", at: hoursAgo(0.5), action: "content.edit", family: "content",
      what: "Edited block 3 of stage 01 (version 1 to 2)", actor: teacher, subject: null,
      target: { type: "content_block", id: "0b10c000-0000-4000-8000-000000000001", label: "Stage 01, block 3" },
      reason: FIX.editReason,
      payload: { stageId: "01", ordinal: 3, version: 2, previousVersion: 1, reason: FIX.editReason },
    },
    {
      id: "990000003", at: hoursAgo(1), action: "summary.send_back", family: "content",
      what: "Sent back the summary for stage 02, taking it off students' screens", actor: teacher, subject: null,
      target: { type: "stage", id: "02", label: "Stage 02 · Computer Evolution and Performance" },
      reason: FIX.sendBackReason, payload: { reason: FIX.sendBackReason, wasLive: true },
    },
    {
      id: "990000002", at: hoursAgo(1.5), action: "summary.approve", family: "content",
      what: "Approved the summary for stage 01", actor: teacher, subject: null,
      target: { type: "stage", id: "01", label: "Stage 01 · Introduction" },
      reason: null, payload: { hash: "9f2c4e1ab07d5c3e8f6a1b2d4c6e8f0a1b3d5f7092c4e6a8b0d2f4a6c8e0b2d4", text: FIX.approvedText },
    },
    {
      id: "990000001", at: hoursAgo(2), action: "lock.window", family: "locks",
      what: "Opened stage 03 for everyone, on its schedule", actor: null, subject: null,
      target: { type: "stage", id: "03", label: "Stage 03 · A Top-Level View of Computer Function" },
      reason: null,
      payload: { lock_id: 7, scope: "global", state: "unlocked", unlock_at: hoursAgo(2), lock_at: null },
    },
  ];
}

export interface FixtureOpts {
  /** Delay every read, to see the skeleton. */
  delayMs?: number;
  /** Answer every read with this status. */
  status?: number;
  /** Answer the CSV with this status. */
  exportStatus?: number;
  /** Leave the unfiltered page exactly as the API sends it. */
  raw?: boolean;
}

export async function useFixture(page: Page, opts: FixtureOpts = {}) {
  const reads: URL[] = [];
  const exports: URL[] = [];

  await page.route(/\/api\/v1\/console\/audit\.csv/, async (route: Route) => {
    exports.push(new URL(route.request().url()));
    if (opts.exportStatus) {
      return route.fulfill({
        status: opts.exportStatus,
        json: { error: { code: "bad_request", message: "30,000 entries match, and an export holds 20,000 at most. Narrow the dates and export again." } },
      });
    }
    return route.continue();
  });

  await page.route(/\/api\/v1\/console\/audit(\?|$)/, async (route: Route) => {
    const url = new URL(route.request().url());
    reads.push(url);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.status) {
      return route
        .fulfill({ status: opts.status, json: { error: { code: "internal", message: "Something went wrong on our side." } } })
        .catch(() => undefined);
    }
    const filtered = [...url.searchParams.keys()].some((k) => k !== "limit");
    if (opts.raw || filtered) return route.continue().catch(() => undefined);

    let res: Awaited<ReturnType<Route["fetch"]>>;
    try {
      res = await route.fetch();
    } catch (e) {
      if (/Test ended|closed|disposed/i.test(String(e))) return;
      throw e;
    }
    const body = (await res.json()) as {
      entries: Array<{ at: string; id: string }>; next: string | null; total: number;
      actors: Array<{ id: string | null; name: string }>;
    };
    const entries = [...extras(), ...body.entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const json = {
      ...body,
      // Not sliced back to the limit: that would drop four REAL entries that
      // Load older, starting from the API's own cursor, would then never fetch.
      entries,
      total: body.total + 4,
      actors: body.actors.some((a) => a.id === null) ? body.actors : [...body.actors, { id: null, name: "System (scheduled)" }],
    };
    return route.fulfill({ response: res, json }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  return { reads, exports };
}
