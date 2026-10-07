import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { EditorBlock, WorkingBlock, WorkingCopy } from "@octa/contracts";
import { AppError, errors } from "./errors.js";

/**
 * A chapter's WORKING COPY: the draft a teacher types into, which students
 * never see, and Publish, which puts it live (docs/STUDIO-EDITOR-PLAN.md;
 * instructor rulings, 8 Oct 2026). The routes are `routes/working-copy.ts`; the
 * rules live here so they are one thing, tested in
 * `test/studio-editor-api.spec.ts`.
 *
 *  - A working copy is the `chapter_drafts` row of a chapter: the whole ordered
 *    list of topics, a hash, a version. It exists only while there are
 *    unpublished changes; Publish and Discard both delete it.
 *  - **A quote from the book and a figure are LOCKED.** They are moved or
 *    deleted, never typed into existence or changed: a quote is checked word for
 *    word against the textbook, which this server does not have. A locked topic
 *    is accepted only as the exact block the chapter (live, or its current
 *    draft) already has.
 *  - Publish keeps each topic's id, so a topic's history follows it when it is
 *    moved or edited, and ordinals are rewritten in one transaction.
 */

export interface BlockLike {
  id?: string | null | undefined;
  kind: string;
  body: string;
  meta: Record<string, string>;
}

export interface LiveRow {
  id: string;
  ordinal: number;
  kind: string;
  body_md: string | null;
  meta: Record<string, string>;
  version: number;
}

/** JSON with object keys sorted, so equal content hashes equal whatever its key order. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** The hash of a chapter's topics, in order: what a draft is bound to, and the live text is compared by. */
export function blocksHash(blocks: BlockLike[]): string {
  const norm = blocks.map((b) => ({ id: b.id ?? null, kind: b.kind, body: b.body, meta: b.meta }));
  return createHash("sha256").update(canon(norm)).digest("hex").slice(0, 32);
}

const LOCKED = new Set(["quote", "figure"]);
export const isLocked = (kind: string): boolean => LOCKED.has(kind);

/** What the editor may set on a topic it creates or edits. Nothing else rides along. */
const FREE_META_KEYS = new Set(["kind", "about"]);

const lockedKey = (b: BlockLike) => canon({ kind: b.kind, body: b.body, meta: b.meta });

/** The locked topics a chapter already has, counted: live and its current draft both count. */
export function lockedReference(live: BlockLike[], draft: BlockLike[] | null): Map<string, number> {
  const count = (bs: BlockLike[]) => {
    const m = new Map<string, number>();
    for (const b of bs) if (isLocked(b.kind)) m.set(lockedKey(b), (m.get(lockedKey(b)) ?? 0) + 1);
    return m;
  };
  const out = count(live);
  for (const [k, n] of count(draft ?? [])) out.set(k, Math.max(out.get(k) ?? 0, n));
  return out;
}

/** The sentences a refused save says. Never a stack, never SQL. */
export function validateBlocks(blocks: EditorBlock[], reference: Map<string, number>): void {
  const ids = new Set<string>();
  const used = new Map<string, number>();
  blocks.forEach((b, i) => {
    const where = `Topic ${i + 1}`;
    if (b.id) {
      if (ids.has(b.id)) throw errors.badRequest(`${where} repeats another topic's id.`);
      ids.add(b.id);
    }
    if (isLocked(b.kind)) {
      const key = lockedKey(b);
      const n = (used.get(key) ?? 0) + 1;
      if (n > (reference.get(key) ?? 0)) {
        throw errors.badRequest(
          b.kind === "quote"
            ? `${where} is a quote from the book. It cannot be typed, created or changed here: it is checked word for word against the textbook. Move it or delete it, or edit it in content/stages/NN.md.`
            : `${where} is a figure. It cannot be created or changed here; it can be moved or deleted.`,
        );
      }
      used.set(key, n);
      return;
    }
    if ("source" in b.meta) throw errors.badRequest(`${where} carries a source. Only a quote from the book does.`);
    for (const k of Object.keys(b.meta)) {
      if (!FREE_META_KEYS.has(k)) throw errors.badRequest(`${where} carries "${k}", which the editor does not set.`);
    }
  });
}

type Db = pg.Pool | pg.PoolClient;

export async function loadLive(db: Db, stageId: string, lock = false): Promise<LiveRow[]> {
  const r = await db.query<LiveRow>(
    `select id::text, ordinal, kind, body_md, meta, version
       from content_blocks where stage_id = $1 order by ordinal${lock ? " for update" : ""}`,
    [stageId],
  );
  return r.rows;
}

export const liveAsBlocks = (rows: LiveRow[]): BlockLike[] =>
  rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body_md ?? "", meta: r.meta }));

interface DraftRow {
  blocks: Array<{ id?: string; kind: string; body: string; meta?: Record<string, string> }>;
  draft_hash: string;
  origin: "file" | "console" | "ai";
  version: number;
  base_hash: string | null;
  status: "draft" | "approved" | "sent_back";
  edited_by: string | null;
  edited_at: string | null;
  authored_by: string | null;
  editor: string | null;
}

const draftBlocks = (row: DraftRow): BlockLike[] =>
  row.blocks.map((b) => ({ id: b.id ?? null, kind: b.kind, body: b.body, meta: b.meta ?? {} }));

export async function loadDraft(db: Db, stageId: string, lock = false): Promise<DraftRow | null> {
  const r = await db.query<DraftRow>(
    `select cd.blocks, cd.draft_hash, cd.origin, cd.version, cd.base_hash, cd.status,
            cd.edited_by::text, cd.edited_at, cd.authored_by::text, p.full_name as editor
       from chapter_drafts cd left join profiles p on p.id = cd.edited_by
      where cd.stage_id = $1${lock ? " for update of cd" : ""}`,
    [stageId],
  );
  return r.rows[0] ?? null;
}

export async function getWorkingCopy(db: Db, stageId: string): Promise<WorkingCopy> {
  const live = await loadLive(db, stageId);
  const liveBlocks = liveAsBlocks(live);
  const liveHash = blocksHash(liveBlocks);
  const owner = (await db.query<{ content_owner: "files" | "console" }>("select content_owner from stages where id = $1", [stageId])).rows[0];
  if (!owner) throw errors.notFound("No such stage.");
  const row = await loadDraft(db, stageId);
  const toWorking = (bs: BlockLike[]): WorkingBlock[] =>
    bs.map((b) => ({ id: b.id ?? null, kind: b.kind as WorkingBlock["kind"], body: b.body, meta: b.meta, locked: isLocked(b.kind) }));
  if (!row) {
    return {
      stageId, source: "live", origin: null, version: 0, hash: liveHash, baseHash: null, liveHash, stale: false,
      status: null, editedBy: null, editedAt: null, owner: owner.content_owner, blocks: toWorking(liveBlocks),
    };
  }
  return {
    stageId, source: "draft", origin: row.origin, version: row.version, hash: row.draft_hash, baseHash: row.base_hash,
    liveHash, stale: row.origin === "console" && row.base_hash !== null && row.base_hash !== liveHash,
    status: row.status, editedBy: row.editor, editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
    owner: owner.content_owner, blocks: toWorking(draftBlocks(row)),
  };
}

/** Save: the whole chapter as the editor holds it. Returns the new version and hash. */
export async function saveWorkingCopy(
  client: pg.PoolClient,
  stageId: string,
  actor: string,
  input: { version: number; blocks: EditorBlock[] },
): Promise<{ version: number; hash: string }> {
  const row = await loadDraft(client, stageId, true);
  const current = row?.version ?? 0;
  if (input.version !== current) {
    throw new AppError(
      "conflict",
      `Someone saved this chapter's draft since you opened it (it is now version ${current}). Reload to read their text before saving yours.`,
    );
  }
  const live = await loadLive(client, stageId);
  validateBlocks(input.blocks, lockedReference(liveAsBlocks(live), row ? draftBlocks(row) : null));

  // Every topic gets an id the moment it is saved, so history and Publish can follow it.
  const blocks = input.blocks.map((b) => ({ id: b.id ?? randomUUID(), kind: b.kind, body: b.body, meta: b.meta }));
  const hash = blocksHash(blocks);
  if (row && row.origin === "console" && row.draft_hash === hash) return { version: row.version, hash };

  const liveHash = blocksHash(liveAsBlocks(live));
  if (!row) {
    await client.query(
      `insert into chapter_drafts (stage_id, blocks, draft_hash, origin, version, base_hash, edited_by, edited_at)
       values ($1, $2::jsonb, $3, 'console', 1, $4, $5, now())`,
      [stageId, JSON.stringify(blocks), hash, liveHash, actor],
    );
    return { version: 1, hash };
  }
  // Taking over a drafted chapter (from the files) makes it the console's: sync leaves it alone from here.
  await client.query(
    `update chapter_drafts
        set blocks = $2::jsonb, draft_hash = $3, origin = 'console', version = version + 1,
            status = 'draft', approved_hash = null, note = null, reviewed_by = null, reviewed_at = null,
            base_hash = case when origin = 'console' then base_hash else $4 end,
            edited_by = $5, edited_at = now(), updated_at = now()
      where stage_id = $1`,
    [stageId, JSON.stringify(blocks), hash, liveHash, actor],
  );
  return { version: row.version + 1, hash };
}

export async function discardWorkingCopy(client: pg.PoolClient, stageId: string): Promise<{ hash: string; blocks: number }> {
  const row = await loadDraft(client, stageId, true);
  if (!row) throw errors.notFound("This chapter has no working copy to discard.");
  if (row.origin !== "console") {
    throw new AppError(
      "conflict",
      "This is a drafted chapter waiting for review, not unpublished typing. Send it back instead, with a reason.",
    );
  }
  await client.query("delete from chapter_drafts where stage_id = $1", [stageId]);
  return { hash: row.draft_hash, blocks: row.blocks.length };
}

export interface PublishResult { added: number; removed: number; edited: number; moved: number; kept: number; selfApproved: boolean; origin: string; blocks: number }

/**
 * Put a working copy live. The caller has already established that the actor may
 * (`assertMayApprove`, the database's `approval_verdict`); the trigger on
 * `chapter_drafts` holds it again when the row is marked approved below.
 */
export async function publishWorkingCopy(
  client: pg.PoolClient,
  stageId: string,
  actor: string,
  input: { hash: string; reason: string },
  authorise: (row: { origin: "file" | "console" | "ai"; authored_by: string | null }) => Promise<void>,
): Promise<PublishResult> {
  const row = await loadDraft(client, stageId, true);
  if (!row) throw errors.notFound("This chapter has no working copy to publish.");
  if (row.draft_hash !== input.hash) {
    throw new AppError("conflict", "This chapter's draft changed since you opened it. Read the new text before publishing it.");
  }
  await authorise(row);

  const live = await loadLive(client, stageId, true);
  if (row.origin === "console" && row.base_hash !== null && row.base_hash !== blocksHash(liveAsBlocks(live))) {
    throw new AppError(
      "conflict",
      "The published chapter changed since this draft began (someone published, or sync-content updated it). Discard this draft and start again from the current text.",
    );
  }

  // A draft written from the files has no ids yet: its topics are new.
  const draft = draftBlocks(row).map((b) => ({ id: b.id ?? randomUUID(), kind: b.kind, body: b.body, meta: b.meta }));
  const liveById = new Map(live.map((r) => [r.id, r]));
  const fresh = draft.map((b) => b.id).filter((id) => !liveById.has(id));
  if (fresh.length > 0) {
    // A new topic's id must never be one that exists elsewhere, or that history already knows.
    const clash = await client.query(
      `select 1 from content_blocks where id = any($1::uuid[])
       union all select 1 from content_block_versions where block_id = any($1::uuid[]) limit 1`,
      [fresh],
    );
    if (clash.rowCount) throw errors.badRequest("A topic in this draft uses an id that already belongs to other text. Discard the draft and start again.");
  }

  await client.query(
    `select set_config('app.edit_via', 'console', true), set_config('app.actor_id', $1, true), set_config('app.edit_reason', $2, true)`,
    [actor, input.reason],
  );

  const keep = new Set(draft.map((b) => b.id));
  const gone = live.filter((r) => !keep.has(r.id)).map((r) => r.id);
  if (gone.length > 0) await client.query("delete from content_blocks where id = any($1::uuid[])", [gone]);
  // Out of the way of the unique (stage, ordinal) while the rest are rewritten. A move is not a new version.
  await client.query("update content_blocks set ordinal = ordinal + 100000 where stage_id = $1", [stageId]);

  let added = 0, edited = 0, moved = 0;
  for (let i = 0; i < draft.length; i++) {
    const b = draft[i]!;
    const was = liveById.get(b.id);
    if (!was) {
      added++;
      await client.query(
        `insert into content_blocks (id, stage_id, ordinal, kind, body_md, meta, console_edited)
         values ($1, $2, $3, $4, $5, $6::jsonb, true)`,
        [b.id, stageId, i + 1, b.kind, b.body, JSON.stringify(b.meta)],
      );
      continue;
    }
    const changed = (was.body_md ?? "") !== b.body || was.kind !== b.kind;
    if (changed) edited++;
    else if (was.ordinal !== i + 1) moved++;
    await client.query(
      `update content_blocks
          set ordinal = $2, kind = $3, body_md = $4, meta = $5::jsonb,
              console_edited = console_edited or $6,
              source_hash = case when $6 then null else source_hash end
        where id = $1`,
      [b.id, i + 1, b.kind, b.body, JSON.stringify(b.meta), changed],
    );
  }

  await client.query("update stages set content_owner = 'console' where id = $1", [stageId]);
  // The database's own check of who may approve fires on this update; the row is then done with.
  await client.query(
    `update chapter_drafts
        set status = 'approved', approved_hash = draft_hash, note = null, reviewed_by = $2, reviewed_at = now()
      where stage_id = $1`,
    [stageId, actor],
  );
  const selfApproved = row.origin === "console" ? row.edited_by === actor : row.authored_by === actor;
  await client.query("delete from chapter_drafts where stage_id = $1", [stageId]);

  return {
    added, removed: gone.length, edited, moved, kept: draft.length - added - edited - moved,
    selfApproved, origin: row.origin, blocks: draft.length,
  };
}
