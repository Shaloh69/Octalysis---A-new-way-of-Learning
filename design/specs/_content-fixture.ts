import type { Page, Route } from "@playwright/test";

/**
 * Course Studio (`/studio`, which took in `/content`), on the REAL seeded responses.
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

/** The fixture teacher's user id: the token's `sub`, and what `authoredBy: "me"` is set to. */
export const TEACHER_ID = "dddddddd-0000-4000-8000-000000000001";

export interface Writes {
  /** The Studio's editor (E1): a chapter's working copy saved, discarded, published. Never sent. */
  save: Array<{ stageId: string; body: { version: number; blocks: Array<{ id?: string; kind: string; body: string; meta: Record<string, string> }> } }>;
  discard: string[];
  publish: Array<{ stageId: string; body: { hash: string; reason: string } }>;
  /** Subjects and books (CS1): never sent, replayed into the next read. */
  studio: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  edit: Array<{ id: string; body: { body: string; version: number; reason: string } }>;
  approve: Array<{ stageId: string; body: { hash: string } }>;
  sendBack: Array<{ stageId: string; body: { reason: string } }>;
  /** Drafted lesson text (5 Oct 2026). */
  approveDraft: Array<{ stageId: string; body: { hash: string } }>;
  sendBackDraft: Array<{ stageId: string; body: { reason: string } }>;
  /** Figures (6 Oct 2026): never sent, replayed into the chapter read. */
  approveFigure: Array<{ id: string; body: { hash: string } }>;
  sendBackFigure: Array<{ id: string; body: { reason: string } }>;
}

export interface FixtureOpts {
  fail?: "edit" | "stale" | "approve" | "send-back" | "approve-draft" | "approve-figure" | "subject" | "save" | "save-stale" | "publish";
  /** The working copy was begun against text that has since changed (Publish will refuse). */
  stale?: boolean;
  /**
   * Who the reader is, for the approval rule: the API says it in `/console/subjects`
   * (`me`). Default: a teacher of CPE 412, so an Approve is offered, as it always was.
   */
  me?: { role: "teacher" | "admin"; approves: string[] };
  /** Every summary, drafted chapter and figure was written by the reader (the author rule). */
  authoredBy?: "me";
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
  const writes: Writes = { save: [], discard: [], publish: [], studio: [], edit: [], approve: [], sendBack: [], approveDraft: [], sendBackDraft: [], approveFigure: [], sendBackFigure: [] };

  // The working copy a spec "saved", replayed into the next read like a database would.
  const working: { version: number; blocks: Writes["save"][number]["body"]["blocks"] } | { version: -1 } = { version: -1 };
  const hasWorking = (w: typeof working): w is { version: number; blocks: Writes["save"][number]["body"]["blocks"] } => w.version >= 0;

  // Subjects and books (CS1). Reads are the real API with `me` set by the spec; writes are never sent.
  await page.route(/\/api\/v1\/console\/(subjects|books)(\/|\?|$)/, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/console/, "");
    if (req.method() !== "GET") {
      if (opts.fail === "subject") {
        return route.fulfill({ status: 409, json: { error: { code: "conflict", message: "CPE 413 already exists. Rename it instead." } } });
      }
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      writes.studio.push({ method: req.method(), path: decodeURIComponent(path), body });
      return route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: { ok: true, id: "fixture-book-" + writes.studio.length, code: body.code } });
    }
    let res: Awaited<ReturnType<Route["fetch"]>>;
    let json: { subjects: Array<{ code: string; title: string; books: Array<Record<string, unknown>>; classes: { total: number; assigned: number }; hasChapters: boolean }>; me: Record<string, unknown> };
    try {
      res = await route.fetch();
      json = (await res.json()) as typeof json;
    } catch (e) {
      if (/Test ended|closed|disposed/i.test(String(e))) return;
      throw e;
    }
    json.me = opts.me ?? { role: "teacher", approves: ["CPE 412"] };
    for (const w of writes.studio) {
      const m = /^\/subjects(?:\/([^/]+))?(?:\/(books))?$/.exec(w.path);
      if (m && w.method === "POST" && !m[1]) {
        json.subjects.push({ code: String(w.body.code), title: String(w.body.title), books: [], classes: { total: 0, assigned: 0 }, hasChapters: false });
      } else if (m && m[1] && w.method === "PATCH") {
        const s = json.subjects.find((x) => x.code === m[1]);
        if (s) s.title = String(w.body.title);
      } else if (m && m[1] && m[2] === "books") {
        const s = json.subjects.find((x) => x.code === m[1]);
        if (s) {
          const makeDefault = w.body.isDefault === true || s.books.length === 0;
          if (makeDefault) s.books.forEach((b) => { b.isDefault = false; });
          s.books.push({ id: "fixture-book-new", title: w.body.title, author: w.body.author ?? null, edition: w.body.edition ?? null, isDefault: makeDefault });
        }
      } else {
        const b = /^\/books\/([^/]+)(\/default)?$/.exec(w.path);
        if (b) {
          for (const s of json.subjects) {
            const book = s.books.find((x) => x.id === b[1]);
            if (!book) continue;
            if (b[2]) { s.books.forEach((x) => { x.isDefault = false; }); book.isDefault = true; }
            else Object.assign(book, { title: w.body.title ?? book.title, author: w.body.author === undefined ? book.author : w.body.author, edition: w.body.edition === undefined ? book.edition : w.body.edition });
          }
        }
      }
    }
    return route.fulfill({ response: res, json }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  // A figure approval serves a drawing to students: never for real from a spec.
  await page.route(/\/api\/v1\/console\/figures\/[^/]+\/(approve|send-back)$/, async (route: Route) => {
    const m = /\/figures\/([^/]+)\/(approve|send-back)$/.exec(new URL(route.request().url()).pathname)!;
    const [, id, action] = m;
    if (action === "approve") {
      if (opts.fail === "approve-figure") {
        return route.fulfill({ status: 409, json: { error: { code: "conflict", message: "This figure was redrawn since you opened it. Look at the new drawing before approving it." } } });
      }
      writes.approveFigure.push({ id: id!, body: route.request().postDataJSON() });
    } else {
      writes.sendBackFigure.push({ id: id!, body: route.request().postDataJSON() });
    }
    return route.fulfill({ json: { ok: true, alreadyApproved: false } });
  });

  await page.route(/\/api\/v1\/console\/content(\/|\?|$)/, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/console\/content/, "");
    const method = req.method();

    if (method !== "GET") {
      const fail = (status: number, message: string) =>
        route.fulfill({ status, json: { error: { code: status === 409 ? "conflict" : "internal", message } } });

      let m = /^\/(\d\d)\/working$/.exec(path);
      if (m && method === "PUT") {
        if (opts.fail === "save") return fail(500, "The database did not answer.");
        const body = req.postDataJSON() as Writes["save"][number]["body"];
        if (opts.fail === "save-stale") {
          return fail(409, "Someone saved this chapter's draft since you opened it (it is now version 2). Reload to read their text before saving yours.");
        }
        writes.save.push({ stageId: m[1]!, body });
        Object.assign(working, { version: body.version + 1, blocks: body.blocks });
        return route.fulfill({ json: { ok: true, version: body.version + 1, hash: `fixture-draft-${writes.save.length}`, savedAt: new Date().toISOString() } });
      }
      if (m && method === "DELETE") {
        writes.discard.push(m[1]!);
        Object.assign(working, { version: -1 });
        return route.fulfill({ json: { ok: true, hash: "fixture", blocks: 0 } });
      }
      m = /^\/(\d\d)\/publish$/.exec(path);
      if (m && method === "POST") {
        if (opts.fail === "publish") {
          return fail(409, "The published chapter changed since this draft began (someone published, or sync-content updated it). Discard this draft and start again from the current text.");
        }
        writes.publish.push({ stageId: m[1]!, body: req.postDataJSON() });
        Object.assign(working, { version: -1 });
        return route.fulfill({ json: { ok: true, added: 1, removed: 0, edited: 1, moved: 0, blocks: 0 } });
      }
      m = /^\/blocks\/([^/]+)$/.exec(path);
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
      m = /^\/drafts\/(\d\d)\/(approve|send-back)$/.exec(path);
      if (m) {
        const [, stageId, action] = m;
        if (action === "approve") {
          if (opts.fail === "approve-draft") return fail(409, "This chapter's draft changed since you opened it. Read the new text before approving it.");
          writes.approveDraft.push({ stageId: stageId!, body: req.postDataJSON() });
        } else {
          writes.sendBackDraft.push({ stageId: stageId!, body: req.postDataJSON() });
        }
        return route.fulfill({ json: { ok: true, alreadyApproved: false } });
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

    // A refusal (404 for a chapter that does not exist) passes through as it came.
    if (res.status() >= 400) return route.fulfill({ response: res }).catch(() => undefined);

    if (path === "" || path === "/") {
      const stages = json.stages as Array<{ id: string; summaryStatus: string | null; consoleEdited: number }>;
      const summary = json.summary as { summaries: Record<string, number>; consoleEdited: number };
      for (const a of writes.approve) { const s = stages.find((x) => x.id === a.stageId); if (s) s.summaryStatus = "approved"; }
      for (const b of writes.sendBack) { const s = stages.find((x) => x.id === b.stageId); if (s) s.summaryStatus = "sent_back"; }
      const n = (st: string | null) => stages.filter((s) => s.summaryStatus === st).length;
      summary.summaries = { draft: n("draft"), approved: n("approved"), sentBack: n("sent_back"), none: n(null) };
      summary.consoleEdited += writes.edit.length;
    } else if (path === "/summaries") {
      json.summaries = (json.summaries as Summary[]).map((s) => ({
        ...applySummary(s, writes), ...(opts.authoredBy === "me" ? { authoredBy: TEACHER_ID } : {}),
      }));
    } else if (/^\/\d\d\/working$/.test(path)) {
      if (hasWorking(working)) {
        Object.assign(json, {
          source: "draft", origin: "console", version: working.version, hash: `fixture-draft-${writes.save.length}`,
          status: "draft", editedBy: "Fixture Teacher", baseHash: json.liveHash, stale: false,
          blocks: working.blocks.map((b) => ({ id: b.id ?? null, kind: b.kind, body: b.body, meta: b.meta ?? {}, locked: b.kind === "quote" || b.kind === "figure" })),
        });
      } else if (opts.stale) {
        Object.assign(json, { source: "draft", origin: "console", version: 3, hash: "fixture-stale", status: "draft", editedBy: "Fixture Teacher", baseHash: "older", stale: true });
      }
    } else if (/^\/\d\d$/.test(path)) {
      json.blocks = (json.blocks as Block[]).map((b) => applyBlock(b, writes));
      if (json.summary) json.summary = applySummary(json.summary as Summary, writes);
      if (opts.authoredBy === "me") {
        if (json.summary) (json.summary as Record<string, unknown>).authoredBy = TEACHER_ID;
        if (json.draft) (json.draft as Record<string, unknown>).authoredBy = TEACHER_ID;
        for (const f of (json.figures ?? []) as Array<Record<string, unknown>>) f.authoredBy = TEACHER_ID;
      }
      const id = path.slice(1);
      const d = json.draft as { status: string; note: string | null; reviewer: string | null; reviewedAt: string | null; everApproved: boolean } | null;
      if (d) {
        for (const a of writes.approveDraft) if (a.stageId === id) Object.assign(d, { status: "approved", note: null, everApproved: true, reviewer: REVIEWER, reviewedAt: new Date().toISOString() });
        for (const b of writes.sendBackDraft) if (b.stageId === id) Object.assign(d, { status: "sent_back", note: b.body.reason, reviewer: REVIEWER, reviewedAt: new Date().toISOString() });
      }
      const figs = (json.figures ?? []) as Array<{ id: string; status: string; note: string | null; served: boolean; reviewer: string | null; reviewedAt: string | null }>;
      for (const fg of figs) {
        for (const a of writes.approveFigure) if (a.id === fg.id) Object.assign(fg, { status: "approved", note: null, served: true, reviewer: REVIEWER, reviewedAt: new Date().toISOString() });
        for (const b of writes.sendBackFigure) if (b.id === fg.id) Object.assign(fg, { status: "sent_back", note: b.body.reason, reviewer: REVIEWER, reviewedAt: new Date().toISOString() });
      }
      // Two replaced versions (2 and 1) means the block is now at version 3.
      if (opts.history) json.blocks = (json.blocks as Block[]).map((b) => ({ ...b, version: b.version + 2, historyCount: Math.max(2, b.historyCount) }));
    }
    return route.fulfill({ response: res, json }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  return { writes };
}
