import type { Page, Route } from "@playwright/test";

/**
 * `/content` and `/content/:stageId`, on the REAL seeded responses.
 *
 * Every read goes to the API and comes back as the seed has it: 19 chapters, 19
 * draft summaries, 217 blocks. Every WRITE is intercepted and never sent, for
 * the reason `console-students.spec.ts` gives for the roster: an approval puts
 * text on students' map and an edit changes what they read, and a spec that
 * did either for real would change the world every other spec reads. The API's
 * side of both is `services/api/test/content.spec.ts`.
 *
 * The page reloads after a write, so the reads replay what the spec "wrote".
 * The one state the seed lacks is history (a fresh sync has replaced nothing),
 * and `history: true` adds two versions to every block's history.
 */

export interface Summary {
  stageId: string; title: string; act: number; draft: string; hash: string;
  status: "draft" | "approved" | "sent_back"; note: string | null;
  reviewer: string | null; reviewedAt: string | null; updatedAt: string;
}
export interface Block {
  id: string; ordinal: number; kind: string; body: string; meta: Record<string, string>;
  version: number; updatedAt: string; consoleEdited: boolean; editable: boolean;
  source: string | null; historyCount: number;
  lastEdit: { via: string; at: string; reason: string | null; editor: string | null } | null;
}

export interface Writes {
  edit: Array<{ id: string; body: { body: string; version: number; reason: string } }>;
  approve: Array<{ stageId: string; body: { hash: string } }>;
  sendBack: Array<{ stageId: string; body: { reason: string } }>;
}

export interface FixtureOpts {
  fail?: "edit" | "stale" | "approve" | "send-back";
  /** Delay every read, to see the skeleton. */
  delayMs?: number;
  /** Answer every read with this status. */
  status?: number;
  history?: boolean;
}

const REVIEWER = "Prof. Amalia R. Bontuyan";

function applySummary(s: Summary, w: Writes): Summary {
  let out = s;
  for (const a of w.approve) if (a.stageId === s.stageId) out = { ...out, status: "approved", note: null, reviewer: REVIEWER, reviewedAt: new Date().toISOString() };
  for (const b of w.sendBack) if (b.stageId === s.stageId) out = { ...out, status: "sent_back", note: b.body.reason, reviewer: REVIEWER, reviewedAt: new Date().toISOString() };
  return out;
}

function applyBlock(b: Block, w: Writes): Block {
  let out = b;
  for (const e of w.edit) {
    if (e.id === b.id) {
      out = {
        ...out, body: e.body.body.trim(), version: out.version + 1, consoleEdited: true,
        historyCount: out.historyCount + 1, updatedAt: new Date().toISOString(),
        lastEdit: { via: "console", at: new Date().toISOString(), reason: e.body.reason, editor: REVIEWER },
      };
    }
  }
  return out;
}

export async function useFixture(page: Page, opts: FixtureOpts = {}) {
  const writes: Writes = { edit: [], approve: [], sendBack: [] };

  await page.route(/\/api\/v1\/console\/content(\/|\?|$)/, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/console\/content/, "");
    const method = req.method();

    if (method !== "GET") {
      const fail = (status: number, message: string) =>
        route.fulfill({ status, json: { error: { code: status === 409 ? "conflict" : "internal", message } } });

      let m = /^\/blocks\/([^/]+)$/.exec(path);
      if (m && method === "PUT") {
        if (opts.fail === "edit") return fail(500, "The database did not answer.");
        const body = req.postDataJSON() as Writes["edit"][number]["body"];
        if (opts.fail === "stale") {
          return fail(409, `Someone saved this block since you opened it (it is now version ${body.version + 1}). Reload to read their text before saving yours.`);
        }
        writes.edit.push({ id: m[1]!, body });
        return route.fulfill({
          json: { block: { id: m[1], version: body.version + 1, body: body.body.trim(), consoleEdited: true } },
        });
      }
      m = /^\/summaries\/(\d\d)\/(approve|send-back)$/.exec(path);
      if (m) {
        const [, stageId, action] = m;
        if (action === "approve") {
          if (opts.fail === "approve") return fail(409, "This summary changed since you opened it. Read the new text before approving it.");
          writes.approve.push({ stageId: stageId!, body: req.postDataJSON() });
        } else {
          if (opts.fail === "send-back") return fail(500, "The database did not answer.");
          writes.sendBack.push({ stageId: stageId!, body: req.postDataJSON() });
        }
        return route.fulfill({ json: { ok: true } });
      }
      return route.continue();
    }

    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.status && opts.status >= 400) {
      return route.fulfill({ status: opts.status, json: { error: { code: "internal", message: "The database did not answer." } } });
    }

    if (/^\/blocks\/[^/]+\/history$/.test(path) && opts.history) {
      return route.fulfill({
        json: {
          versions: [
            { version: 2, kind: "prose", body: "An earlier wording, fixed in the console.", via: "console", replacedAt: "2026-09-27T09:12:00.000Z", reason: "typo in the second sentence", editor: REVIEWER },
            { version: 1, kind: "prose", body: "The first wording, as synced from the file.", via: "sync", replacedAt: "2026-09-20T02:00:00.000Z", reason: null, editor: null },
          ],
        },
      });
    }

    /*
     * Approve, send back and save each RELOAD the page's data. A test that ends
     * on its toast can close the page under that reload, and a throw here then
     * surfaces as a failure of the NEXT test in the worker (seen 28 Sep 2026:
     * two /signin tests failed at this line). A read that outlives its test
     * proves nothing either way, so it is dropped.
     */
    let res: Awaited<ReturnType<Route["fetch"]>>;
    let json: Record<string, unknown>;
    try {
      res = await route.fetch();
      json = (await res.json()) as Record<string, unknown>;
    } catch (e) {
      if (/Test ended|closed|disposed/i.test(String(e))) return;
      throw e;
    }

    if (path === "" || path === "/") {
      const stages = json.stages as Array<{ id: string; summaryStatus: string | null; consoleEdited: number }>;
      const summary = json.summary as { summaries: Record<string, number>; consoleEdited: number };
      for (const a of writes.approve) { const s = stages.find((x) => x.id === a.stageId); if (s) s.summaryStatus = "approved"; }
      for (const b of writes.sendBack) { const s = stages.find((x) => x.id === b.stageId); if (s) s.summaryStatus = "sent_back"; }
      const n = (st: string | null) => stages.filter((s) => s.summaryStatus === st).length;
      summary.summaries = { draft: n("draft"), approved: n("approved"), sentBack: n("sent_back"), none: n(null) };
      summary.consoleEdited += writes.edit.length;
    } else if (path === "/summaries") {
      json.summaries = (json.summaries as Summary[]).map((s) => applySummary(s, writes));
    } else if (/^\/\d\d$/.test(path)) {
      json.blocks = (json.blocks as Block[]).map((b) => applyBlock(b, writes));
      if (json.summary) json.summary = applySummary(json.summary as Summary, writes);
      // Two replaced versions (2 and 1) means the block is now at version 3.
      if (opts.history) json.blocks = (json.blocks as Block[]).map((b) => ({ ...b, version: b.version + 2, historyCount: Math.max(2, b.historyCount) }));
    }
    return route.fulfill({ response: res, json }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  return { writes };
}
