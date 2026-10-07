import { createHash } from "node:crypto";
import type pg from "pg";
import {
  MOON_GAMES, MOON_MIN_QUESTIONS,
  type MoonAddBody, type MoonPendingBody, type MoonsPublishBody, type MoonsPublishResult,
  type StudioMoon, type StudioMoonsResponse,
} from "@octa/contracts";
import { BlueprintUnsatisfiable, fillBlueprint, type Blueprint } from "./engine/blueprint.js";
import { errors } from "./errors.js";
import { canon } from "./working-copy.js";
import { loadLivePool } from "./repo/engine-repo.js";

/**
 * The Studio's MOONS, server side (docs/STUDIO-EDITOR-PLAN.md "E2 -- the moons
 * plan"; instructor approval, 8 Oct 2026). A moon is an `objectives` row.
 *
 *  - TYPING is free for any staff member and changes nothing a student reads:
 *    a new moon is a DRAFT row, an edit or a retirement is a PENDING change
 *    (`objective_edits`, one per moon).
 *  - PUBLISH applies pending changes and flips drafts live, in one transaction,
 *    for a teacher of the subject or the admin. A draft goes live only with
 *    `moon_publishable()` (3 live questions): otherwise a planet would never open.
 *  - RETIRING a moon removes it for students and from the lock's count; its
 *    items, blueprints and every `objective_progress` row stay (rules 6 and 7).
 *    The last live moon of a graded chapter, and a moon a stage check needs in
 *    order to fill, cannot be retired.
 *  - The lock is the database's (hard rule 4): publishing computes, with
 *    `is_stage_unlocked()` itself, who would see a planet close, and the dry run
 *    says so without changing anything.
 *
 * The routes are `routes/moons.ts`; the rules are here so they are one thing,
 * tested in `test/studio-moons-api.spec.ts`.
 */

type Db = pg.Pool | pg.PoolClient;

const STAGE_ID = /^\d{2}$/;
export const MOON_ID = /^\d{2}\.\d{1,2}$/;

interface MoonRow {
  id: string;
  status: "draft" | "live" | "retired";
  owner: "file" | "console";
  description: string;
  bloom_level: "remember" | "understand" | "apply" | "analyze";
  level: number | null;
  competency: "read" | "trace" | "build" | null;
  questions: number;
  not_live: number;
  any_items: boolean;
  has_evidence: boolean;
  has_journey: boolean;
  publishable: boolean;
  p_action: "edit" | "retire" | null;
  p_description: string | null;
  p_bloom: "remember" | "understand" | "apply" | "analyze" | null;
  p_level: number | null;
  p_competency: "read" | "trace" | "build" | null;
  p_version: number | null;
  p_base_hash: string | null;
  p_edited_by: string | null;
  p_edited_at: string | null;
  p_editor: string | null;
}

/** The fields a pending change is measured against: if they move, the change is stale. */
function fieldsHash(m: Pick<MoonRow, "status" | "description" | "bloom_level" | "level" | "competency">): string {
  return createHash("sha256")
    .update(canon({ status: m.status, description: m.description, bloom: m.bloom_level, level: m.level, competency: m.competency }))
    .digest("hex").slice(0, 32);
}

async function lockStage(db: Db, stageId: string): Promise<void> {
  await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`moons:${stageId}`]);
}

async function stageOf(db: Db, stageId: string): Promise<{ id: string; gradeable: boolean }> {
  if (!STAGE_ID.test(stageId)) throw errors.notFound("No such stage.");
  const { rows } = await db.query<{ id: string; gradeable: boolean }>("select id, gradeable from stages where id = $1", [stageId]);
  if (!rows[0]) throw errors.notFound("No such stage.");
  return rows[0];
}

async function loadMoons(db: Db, stageId: string, lock = false): Promise<MoonRow[]> {
  const { rows } = await db.query<MoonRow>(
    `select o.id, o.status, o.owner, o.description, o.bloom_level, o.level, o.competency,
            (select count(distinct i.family_id)::int from items i
              where i.objective_id = o.id and i.status = 'live') as questions,
            (select count(distinct i.family_id)::int from items i
              where i.objective_id = o.id and i.status::text not in ('live','retired')) as not_live,
            exists (select 1 from items i where i.objective_id = o.id) as any_items,
            exists (select 1 from objective_progress op where op.objective_id = o.id) as has_evidence,
            exists (select 1 from blueprints b where b.objective_id = o.id) as has_journey,
            moon_publishable(o.id) as publishable,
            e.action as p_action, e.description as p_description, e.bloom_level as p_bloom,
            e.level as p_level, e.competency as p_competency, e.version as p_version,
            e.base_hash as p_base_hash, e.edited_by::text as p_edited_by,
            e.edited_at::text as p_edited_at, pr.full_name as p_editor
       from objectives o
       left join objective_edits e on e.objective_id = o.id
       left join profiles pr on pr.id = e.edited_by
      where o.stage_id = $1
      order by split_part(o.id, '.', 1), split_part(o.id, '.', 2)::int${lock ? " for update of o" : ""}`,
    [stageId],
  );
  return rows;
}

/** What the page and Publish bind to: every moon's fields and its pending change. */
function stateHash(moons: MoonRow[]): string {
  return createHash("sha256")
    .update(canon(moons.map((m) => ({
      id: m.id, status: m.status, d: m.description, b: m.bloom_level, l: m.level, c: m.competency,
      p: m.p_action ? { a: m.p_action, d: m.p_description, b: m.p_bloom, l: m.p_level, c: m.p_competency, v: m.p_version } : null,
    }))))
    .digest("hex").slice(0, 32);
}

function toMoon(m: MoonRow): StudioMoon {
  return {
    id: m.id,
    status: m.status,
    owner: m.owner,
    description: m.description,
    bloom: m.bloom_level,
    level: m.level === null ? null : Number(m.level),
    competency: m.competency,
    questions: Number(m.questions),
    notLive: Number(m.not_live),
    publishable: m.publishable === true,
    game: MOON_GAMES[m.id] ?? null,
    removable: m.status === "draft" && !m.any_items && !m.has_evidence && !m.has_journey,
    pending: m.p_action
      ? {
          action: m.p_action,
          description: m.p_description,
          bloom: m.p_bloom,
          level: m.p_level === null ? null : Number(m.p_level),
          competency: m.p_competency,
          version: Number(m.p_version),
          editedBy: m.p_editor,
          editedAt: m.p_edited_at ?? "",
        }
      : null,
  };
}

export async function getMoons(db: Db, stageId: string): Promise<StudioMoonsResponse> {
  const stage = await stageOf(db, stageId);
  const moons = await loadMoons(db, stageId);
  return {
    stageId,
    gradeable: stage.gradeable,
    minQuestions: MOON_MIN_QUESTIONS,
    hash: stateHash(moons),
    moons: moons.map(toMoon),
  };
}

async function audit(db: Db, actor: string, action: string, target: string, payload: unknown): Promise<void> {
  await db.query(
    `insert into audit_log (actor_id, action, target_type, target_id, payload) values ($1, $2, 'stage', $3, $4)`,
    [actor, action, target, JSON.stringify(payload)],
  );
}

/** Add a moon: a DRAFT, invisible to students and uncounted by the lock until it is published. */
export async function addMoon(client: pg.PoolClient, stageId: string, userId: string, body: MoonAddBody): Promise<{ id: string }> {
  const stage = await stageOf(client, stageId);
  if (!stage.gradeable) {
    throw errors.conflict("This chapter is not graded (orientation), so it has no questions and no moons to master.");
  }
  await lockStage(client, stageId);
  const { rows } = await client.query<{ next: number }>(
    `select coalesce(max(split_part(id, '.', 2)::int), 0) + 1 as next from objectives where stage_id = $1`,
    [stageId],
  );
  const next = Number(rows[0]!.next);
  if (next > 99) throw errors.conflict("A chapter holds at most 99 moons.");
  const id = `${stageId}.${next}`;
  await client.query(
    `insert into objectives (id, stage_id, code, bloom_level, level, competency, description, status, owner)
     values ($1, $2, $1, $3, $4, $5, $6, 'draft', 'console')`,
    [id, stageId, body.bloom, body.level, body.competency, body.description],
  );
  await audit(client, userId, "moon.add", stageId, { id, description: body.description, bloom: body.bloom, level: body.level, competency: body.competency });
  return { id };
}

async function loadOne(client: pg.PoolClient, id: string): Promise<MoonRow & { stage_id: string }> {
  if (!MOON_ID.test(id)) throw errors.notFound("No such moon.");
  const { rows: s } = await client.query<{ stage_id: string }>("select stage_id from objectives where id = $1", [id]);
  if (!s[0]) throw errors.notFound("No such moon.");
  await lockStage(client, s[0].stage_id);
  const moon = (await loadMoons(client, s[0].stage_id, true)).find((m) => m.id === id);
  if (!moon) throw errors.notFound("No such moon.");
  return { ...moon, stage_id: s[0].stage_id };
}

/** Save the one pending change on a moon (an edit or a retirement), naming the version loaded. */
export async function savePending(
  client: pg.PoolClient, id: string, userId: string, body: MoonPendingBody,
): Promise<{ version: number }> {
  const moon = await loadOne(client, id);
  if (moon.status === "retired") throw errors.conflict(`Moon ${id} is retired; a retired moon is not edited.`);
  const have = moon.p_version === null ? 0 : Number(moon.p_version);
  if (body.version !== have) {
    throw errors.conflict(`Moon ${id} was changed by someone else since you opened it. Reload to see their change.`);
  }
  if (body.action === "edit") {
    const same = body.description === moon.description && body.bloom === moon.bloom_level
      && body.level === moon.level && body.competency === moon.competency;
    if (same) throw errors.conflict(`That is already moon ${id} as it stands; there is nothing to change.`);
    await client.query(
      `insert into objective_edits (objective_id, action, description, bloom_level, level, competency, base_hash, version, edited_by, edited_at)
       values ($1, 'edit', $2, $3, $4, $5, $6, 1, $7, now())
       on conflict (objective_id) do update
         set action = 'edit', description = excluded.description, bloom_level = excluded.bloom_level,
             level = excluded.level, competency = excluded.competency,
             version = objective_edits.version + 1, edited_by = excluded.edited_by, edited_at = now()`,
      [id, body.description, body.bloom, body.level, body.competency, fieldsHash(moon), userId],
    );
  } else {
    await client.query(
      `insert into objective_edits (objective_id, action, description, bloom_level, level, competency, base_hash, version, edited_by, edited_at)
       values ($1, 'retire', null, null, null, null, $2, 1, $3, now())
       on conflict (objective_id) do update
         set action = 'retire', description = null, bloom_level = null, level = null, competency = null,
             version = objective_edits.version + 1, edited_by = excluded.edited_by, edited_at = now()`,
      [id, fieldsHash(moon), userId],
    );
  }
  return { version: have + 1 };
}

export async function discardPending(client: pg.PoolClient, id: string, userId: string): Promise<{ removed: boolean }> {
  const moon = await loadOne(client, id);
  const r = await client.query("delete from objective_edits where objective_id = $1", [id]);
  const removed = (r.rowCount ?? 0) > 0;
  if (removed) await audit(client, userId, "moon.discard", moon.stage_id, { id, action: moon.p_action });
  return { removed };
}

/** Delete a never-published draft that has no questions and no evidence. Anything else is retired. */
export async function removeDraft(client: pg.PoolClient, id: string, userId: string): Promise<void> {
  const moon = await loadOne(client, id);
  if (moon.status !== "draft") {
    throw errors.conflict(`Moon ${id} is ${moon.status === "live" ? "live" : "retired"}; a moon students have seen is retired, never deleted.`);
  }
  if (moon.any_items || moon.has_evidence || moon.has_journey) {
    throw errors.conflict(`Moon ${id} has questions attached; retire it instead, so they are kept.`);
  }
  await client.query("delete from objectives where id = $1", [id]);
  await audit(client, userId, "moon.remove", moon.stage_id, { id, description: moon.description });
}

/* ------------------------------------------------------------------ publish */

async function stageChecks(db: Db, stageId: string): Promise<Blueprint[]> {
  const { rows } = await db.query(
    `select id, name, scope, stage_id, objective_id, total_items, constraints from blueprints
      where (scope = 'stage' and stage_id = $1) or scope = 'final'
      order by name`,
    [stageId],
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, scope: r.scope, stageId: r.stage_id ?? null, objectiveId: r.objective_id ?? null,
    totalItems: Number(r.total_items), constraints: r.constraints ?? {},
  }));
}

/** Which stage checks and finals can fill from the live bank right now. */
async function fillable(db: Db, stageId: string): Promise<Map<string, { name: string; ok: boolean }>> {
  const out = new Map<string, { name: string; ok: boolean }>();
  for (const bp of await stageChecks(db, stageId)) {
    const pool = await loadLivePool(db, bp.scope === "stage" && bp.stageId ? { stageId: bp.stageId } : {});
    try {
      fillBlueprint(bp, pool, "moons-feasibility");
      out.set(bp.id ?? bp.name, { name: bp.name, ok: true });
    } catch (e) {
      if (!(e instanceof BlueprintUnsatisfiable)) throw e;
      out.set(bp.id ?? bp.name, { name: bp.name, ok: false });
    }
  }
  return out;
}

/** Every (student, successor planet) the lock lets through right now, by the lock's own answer. */
async function openPairs(db: Db, stageId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ uid: string; sid: string }>(
    `select p.id::text as uid, s.id as sid
       from profiles p
       cross join stages s
      where p.role = 'student' and p.deleted_at is null
        and s.published and $1 = any(s.prereq)
        and is_stage_unlocked(p.id, s.id)`,
    [stageId],
  );
  return new Set(rows.map((r) => `${r.uid}|${r.sid}`));
}

const RING = (n: number | null) => (n === null ? "no ring" : `ring ${n}`);

/** Thrown by a dry run to roll the whole transaction back and carry the result out. */
export class DryRun extends Error {
  constructor(readonly result: MoonsPublishResult) {
    super("dry run");
  }
}

export async function publishMoons(
  client: pg.PoolClient,
  stageId: string,
  userId: string,
  body: MoonsPublishBody,
  /** The approval rule: a teacher of the subject, or the admin. Throws a sentence. */
  assertMayPublish: () => Promise<unknown>,
): Promise<MoonsPublishResult> {
  const stage = await stageOf(client, stageId);
  await lockStage(client, stageId);
  await assertMayPublish();

  const moons = await loadMoons(client, stageId, true);
  if (body.hash !== stateHash(moons)) {
    throw errors.conflict("The moons changed since you read them (a save, a publish or a sync). Reload and look again.");
  }

  const byId = new Map(moons.map((m) => [m.id, m]));
  type Plan = { moon: MoonRow; change: "edit" | "retire" | "publish" };
  const plans: Plan[] = [];
  for (const id of [...new Set(body.ids)]) {
    const m = byId.get(id);
    if (!m) throw errors.notFound(`Moon ${id} is not a moon of chapter ${stageId}.`);
    if (m.status === "retired") throw errors.conflict(`Moon ${id} is retired; there is nothing to publish.`);
    if (m.p_action && m.p_base_hash !== fieldsHash(m)) {
      throw errors.conflict(`Moon ${id} changed since this change began (another publish, or a sync). Discard it and make it again.`);
    }
    if (m.p_action === "retire") plans.push({ moon: m, change: "retire" });
    else if (m.status === "draft") {
      if (!m.publishable) {
        throw errors.conflict(
          `Moon ${id} has ${m.questions} live question${m.questions === 1 ? "" : "s"}; it needs ${MOON_MIN_QUESTIONS} before it can go live, ` +
          `or its planet would never open.`,
        );
      }
      plans.push({ moon: m, change: "publish" });
    } else if (m.p_action === "edit") plans.push({ moon: m, change: "edit" });
    else throw errors.conflict(`Moon ${id} has nothing to publish.`);
  }

  // The last live moon of a graded chapter cannot be retired: every planet after it would stay shut.
  const retiring = new Set(plans.filter((p) => p.change === "retire").map((p) => p.moon.id));
  const publishing = new Set(plans.filter((p) => p.change === "publish").map((p) => p.moon.id));
  if (retiring.size > 0 && stage.gradeable) {
    const left = moons.filter((m) => (m.status === "live" || publishing.has(m.id)) && !retiring.has(m.id));
    if (left.length === 0) {
      throw errors.conflict(
        `Moon ${[...retiring].join(", ")} is the last live moon of chapter ${stageId}; retiring it would keep every planet after it shut. ` +
        `Add or publish another moon first, or open the planet by hand on Locks.`,
      );
    }
  }

  const unlockedBefore = await openPairs(client, stageId);
  const fillBefore = retiring.size > 0 ? await fillable(client, stageId) : new Map<string, { name: string; ok: boolean }>();

  // Who made the changes: self-approved when every author is the publisher.
  const authors = new Set<string>();
  const applied: MoonsPublishResult["applied"] = [];
  const gamesRemoved: MoonsPublishResult["gamesRemoved"] = [];
  for (const { moon: m, change } of plans) {
    const moves: string[] = [];
    if (change === "retire") {
      await client.query(
        `update objectives set status = 'retired', retired_at = now(), owner = 'console' where id = $1`, [m.id],
      );
      if (m.status === "live" && MOON_GAMES[m.id]) gamesRemoved.push({ id: m.id, name: MOON_GAMES[m.id]! });
      if (m.p_edited_by) authors.add(m.p_edited_by);
      moves.push(m.status === "live" ? "leaves the map, the grid and the lock's count" : "never reaches students");
    } else {
      const next = {
        description: m.p_action === "edit" ? m.p_description! : m.description,
        bloom: m.p_action === "edit" ? m.p_bloom! : m.bloom_level,
        level: m.p_action === "edit" ? m.p_level : m.level,
        competency: m.p_action === "edit" ? m.p_competency : m.competency,
      };
      if (next.description !== m.description) moves.push("new wording");
      if (next.level !== m.level) moves.push(`moves from ${RING(m.level)} to ${RING(next.level)}`);
      if (next.competency !== m.competency) moves.push(`${m.competency ?? "no competency"} becomes ${next.competency ?? "no competency"} on the grid`);
      if (next.bloom !== m.bloom_level) moves.push(`${m.bloom_level} becomes ${next.bloom}`);
      await client.query(
        `update objectives set description = $2, bloom_level = $3, level = $4, competency = $5,
                status = 'live', owner = 'console'
          where id = $1`,
        [m.id, next.description, next.bloom, next.level, next.competency],
      );
      if (change === "publish") {
        moves.push("goes live: students see it and the lock counts it");
        const made = await client.query<{ actor_id: string | null }>(
          `select actor_id::text as actor_id from audit_log where action = 'moon.add' and target_id = $1 and payload->>'id' = $2
            order by at desc, id desc limit 1`,
          [stageId, m.id],
        );
        if (made.rows[0]?.actor_id) authors.add(made.rows[0].actor_id);
      }
      if (m.p_edited_by) authors.add(m.p_edited_by);
    }
    await client.query("delete from objective_edits where objective_id = $1", [m.id]);
    applied.push({ id: m.id, change, moves });
  }

  // Who would see a planet close? Asked of the lock itself, after the change.
  const unlockedAfter = await openPairs(client, stageId);
  const lost = [...unlockedBefore].filter((k) => !unlockedAfter.has(k));
  const perStage = new Map<string, number>();
  for (const k of lost) perStage.set(k.split("|")[1]!, (perStage.get(k.split("|")[1]!) ?? 0) + 1);

  // A retirement must not leave a stage check, or a final that filled before, unable to fill.
  if (retiring.size > 0) {
    const fillAfter = await fillable(client, stageId);
    for (const [key, was] of fillBefore) {
      if (was.ok && fillAfter.get(key)?.ok === false) {
        throw errors.conflict(
          `Retiring moon ${[...retiring].join(", ")} would leave "${was.name}" unable to fill: its questions are needed by that check. ` +
          `Add questions to another moon of the chapter first.`,
        );
      }
    }
  }

  const result: MoonsPublishResult = {
    ok: true,
    dryRun: body.dryRun,
    applied,
    gamesRemoved,
    impact: {
      relocked: lost.length === 0 ? 0 : new Set(lost.map((k) => k.split("|")[0])).size,
      stages: [...perStage].map(([s, students]) => ({ stageId: s, students })).sort((a, b) => a.stageId.localeCompare(b.stageId)),
    },
    selfApproved: authors.size > 0 && [...authors].every((a) => a === userId),
  };

  if (body.dryRun) throw new DryRun(result);

  await audit(client, userId, "moon.publish", stageId, {
    reason: body.reason, hash: body.hash, applied, gamesRemoved, relocked: result.impact.relocked,
    ...(result.selfApproved ? { selfApproved: true } : {}),
  });
  return result;
}
