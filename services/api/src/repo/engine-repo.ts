import type pg from "pg";
import { createHash } from "node:crypto";
import type { Db } from "../db.js";
import { withTransaction } from "../db.js";
import { makeAttemptSeed } from "../engine/seed.js";
import { fillBlueprint, type Blueprint, type PoolItem } from "../engine/blueprint.js";
import { resolveItem, type ResolvedItem } from "../engine/resolve.js";
import { gradeResponse, scoreAttempt, type GradeResult } from "../engine/grade.js";
import { errors } from "../errors.js";

/**
 * The bridge between the engine and the database.
 *
 * Everything that could leak an answer key lives on this side of the wall:
 * loading the live bank, deriving the seed, resolving the paper, persisting
 * `attempt_items`, and grading. No route hands a `ResolvedItem` to a client
 * without passing it through `serialize/student.ts` first.
 */

export interface AttemptContext {
  readonly attemptId: string;
  readonly userId: string;
  readonly assessmentId: string;
  readonly attemptNo: number;
  readonly seed: string;
  readonly engineVersion: string;
  readonly status: "in_progress" | "submitted" | "abandoned" | "voided";
  readonly blueprintScope: "stage" | "final";
}

/* ============================================================
 * Reading the bank
 * ========================================================== */

export async function loadLivePool(
  db: Db,
  opts: { stageId?: string } = {},
): Promise<PoolItem[]> {
  const params: unknown[] = [];
  let where = "i.status = 'live'";
  if (opts.stageId) {
    params.push(opts.stageId);
    where += ` and i.stage_id = $${params.length}`;
  }

  const { rows } = await db.query(
    `select i.id, i.slug, i.stage_id, i.objective_id, i.type, i.bloom,
            i.stem_template, i.solver_ref, i.correct_spec, i.distractor_pool,
            i.rationale_template, s.act, s.gradeable
       from items i
       join stages s on s.id = i.stage_id
      where ${where}
      order by i.id`,
    params,
  );

  return rows.map(
    (r): PoolItem => ({
      id: r.id,
      slug: r.slug,
      stageId: r.stage_id,
      objectiveId: r.objective_id,
      type: r.type,
      bloom: r.bloom,
      stemTemplate: r.stem_template,
      solverRef: r.solver_ref,
      correctSpec: r.correct_spec ?? {},
      distractorPool: r.distractor_pool ?? [],
      rationaleTemplate: r.rationale_template,
      act: Number(r.act),
      gradeable: r.gradeable,
    }),
  );
}

export async function loadBlueprintFor(db: Db, assessmentId: string): Promise<Blueprint> {
  const { rows } = await db.query(
    `select b.id, b.name, b.scope, b.stage_id, b.total_items, b.constraints
       from assessments a join blueprints b on b.id = a.blueprint_id
      where a.id = $1`,
    [assessmentId],
  );
  const r = rows[0];
  if (!r) throw errors.notFound("That assessment does not exist.");
  return {
    id: r.id,
    name: r.name,
    scope: r.scope,
    stageId: r.stage_id ?? null,
    totalItems: Number(r.total_items),
    constraints: r.constraints ?? {},
  };
}

/**
 * The exam salt. Lives in `assessment_secrets`, which has RLS on and a
 * deny-all policy -- service_role only. It never reaches a client, and the
 * denial suite asserts that for anon, student and teacher alike (V-15).
 */
async function loadExamSalt(client: pg.PoolClient, assessmentId: string): Promise<string> {
  const { rows } = await client.query(
    "select exam_salt from assessment_secrets where assessment_id = $1",
    [assessmentId],
  );
  const salt = rows[0]?.exam_salt;
  if (!salt) {
    throw errors.internal(`assessment ${assessmentId} has no row in assessment_secrets`);
  }
  return salt as string;
}

/* ============================================================
 * Starting an attempt
 * ========================================================== */

export interface StartResult {
  readonly attempt: AttemptContext;
  readonly items: ResolvedItem[];
  /** True when an in-progress attempt already existed and was resumed. */
  readonly resumed: boolean;
}

export async function startAttempt(
  db: Db,
  opts: { userId: string; studentId: string; assessmentId: string; engineVersion: string },
): Promise<StartResult> {
  const blueprint = await loadBlueprintFor(db, opts.assessmentId);

  return withTransaction(db, async (client) => {
    // Serialise per (user, assessment) so a double-click cannot create two
    // attempts, and so the attempts_allowed check below cannot race.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `${opts.userId}:${opts.assessmentId}`,
    ]);

    const existing = await client.query(
      `select a.id, a.attempt_no, a.seed, a.engine_version, a.status
         from attempts a
        where a.user_id = $1 and a.assessment_id = $2
        order by a.attempt_no desc`,
      [opts.userId, opts.assessmentId],
    );

    const open = existing.rows.find((r) => r.status === "in_progress");
    if (open) {
      const items = await loadResolvedPaper(client, open.id, open.seed, open.engine_version);
      return {
        attempt: toContext(open, opts, blueprint.scope),
        items,
        resumed: true,
      };
    }

    const { rows: assessRows } = await client.query(
      `select attempts_allowed, opens_at, closes_at from assessments where id = $1`,
      [opts.assessmentId],
    );
    const assessment = assessRows[0];
    if (!assessment) throw errors.notFound("That assessment does not exist.");

    const now = Date.now();
    if (assessment.opens_at && now < new Date(assessment.opens_at).getTime()) {
      throw errors.forbidden("That assessment has not opened yet.");
    }
    if (assessment.closes_at && now > new Date(assessment.closes_at).getTime()) {
      throw errors.forbidden("That assessment has closed.");
    }

    const used = existing.rows.length;
    if (used >= Number(assessment.attempts_allowed)) {
      throw errors.forbidden(
        `You have used all ${assessment.attempts_allowed} attempt(s) for this assessment.`,
      );
    }

    const attemptNo = used + 1;
    const salt = await loadExamSalt(client, opts.assessmentId);
    const seed = makeAttemptSeed({
      studentId: opts.studentId,
      stageId: blueprint.scope === "final" ? "final" : (blueprint.id ?? "stage"),
      attemptNo,
      examSalt: salt,
    });

    // A stage check samples its OWN stage. `fillBlueprint()` has no stage
    // dimension, so this narrowing is the only thing that keeps a "Stage 01
    // Check" from drawing chapter-4 cache questions out of the whole live bank
    // — which is exactly what it did until `loadBlueprintFor()` started
    // carrying `stage_id`. A final is cumulative and takes the full pool.
    const pool = await loadLivePool(
      db,
      blueprint.scope === "stage" && blueprint.stageId ? { stageId: blueprint.stageId } : {},
    );
    // BlueprintUnsatisfiable propagates. It is never swallowed into a short
    // paper -- a paper quietly missing three `analyze` items measures something
    // other than what it claims to.
    const { items: selected } = fillBlueprint(blueprint, pool, seed);

    const resolved = selected.map((item, idx) =>
      resolveItem(item, seed, { ordinal: idx + 1, engineVersion: opts.engineVersion }),
    );

    const { rows: created } = await client.query(
      `insert into attempts (user_id, assessment_id, attempt_no, seed, engine_version, status, max_score)
       values ($1, $2, $3, $4, $5, 'in_progress', $6)
       returning id, attempt_no, seed, engine_version, status`,
      [
        opts.userId,
        opts.assessmentId,
        attemptNo,
        seed,
        opts.engineVersion,
        resolved.reduce((a, r) => a + r.points, 0),
      ],
    );
    const attempt = created[0]!;

    // Persist the resolved paper, answer key included. `attempt_items` is
    // RLS-denied to the student until submit.
    for (const r of resolved) {
      await client.query(
        `insert into attempt_items
           (attempt_id, ordinal, item_id, resolved_params, resolved_options, correct_value, points)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          attempt.id,
          r.ordinal,
          r.itemId,
          JSON.stringify(r.resolvedParams),
          JSON.stringify(r.options),
          JSON.stringify({ value: r.correctValue, index: r.correctIndex }),
          r.points,
        ],
      );
    }

    return {
      attempt: toContext(attempt, opts, blueprint.scope),
      items: resolved,
      resumed: false,
    };
  });
}

function toContext(
  row: { id: string; attempt_no: number; seed: string; engine_version: string; status: string },
  opts: { userId: string; assessmentId: string },
  scope: "stage" | "final",
): AttemptContext {
  return {
    attemptId: row.id,
    userId: opts.userId,
    assessmentId: opts.assessmentId,
    attemptNo: Number(row.attempt_no),
    seed: row.seed,
    engineVersion: row.engine_version,
    status: row.status as AttemptContext["status"],
    blueprintScope: scope,
  };
}

/* ============================================================
 * Regenerating a paper
 *
 * This is the whole point of storing a seed. Months later, from `seed` plus
 * `engine_version`, the exact paper a student sat is reconstructed byte for
 * byte -- for a grade dispute, for the console drill-down, or for an audit.
 * ========================================================== */

export async function loadResolvedPaper(
  client: pg.PoolClient | Db,
  attemptId: string,
  seed: string,
  engineVersion: string,
): Promise<ResolvedItem[]> {
  const { rows } = await client.query(
    `select ai.ordinal, ai.points,
            i.id, i.slug, i.stage_id, i.objective_id, i.type, i.bloom,
            i.stem_template, i.solver_ref, i.correct_spec, i.distractor_pool,
            i.rationale_template
       from attempt_items ai
       join items i on i.id = ai.item_id
      where ai.attempt_id = $1
      order by ai.ordinal`,
    [attemptId],
  );

  return rows.map((r) =>
    resolveItem(
      {
        id: r.id,
        slug: r.slug,
        stageId: r.stage_id,
        objectiveId: r.objective_id,
        type: r.type,
        bloom: r.bloom,
        stemTemplate: r.stem_template,
        solverRef: r.solver_ref,
        correctSpec: r.correct_spec ?? {},
        distractorPool: r.distractor_pool ?? [],
        rationaleTemplate: r.rationale_template,
      },
      seed,
      { ordinal: Number(r.ordinal), points: Number(r.points), engineVersion },
    ),
  );
}

export async function loadAttempt(db: Db, attemptId: string): Promise<AttemptContext | null> {
  const { rows } = await db.query(
    `select a.id, a.user_id, a.assessment_id, a.attempt_no, a.seed, a.engine_version,
            a.status, b.scope
       from attempts a
       join assessments s on s.id = a.assessment_id
       join blueprints  b on b.id = s.blueprint_id
      where a.id = $1`,
    [attemptId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    attemptId: r.id,
    userId: r.user_id,
    assessmentId: r.assessment_id,
    attemptNo: Number(r.attempt_no),
    seed: r.seed,
    engineVersion: r.engine_version,
    status: r.status,
    blueprintScope: r.scope,
  };
}

/* ============================================================
 * Answering
 * ========================================================== */

export interface AnswerOutcome {
  readonly result: GradeResult;
  readonly item: ResolvedItem;
  /** Whether the verdict may be shown now. Withheld mid-exam on a final. */
  readonly revealVerdict: boolean;
  readonly alreadyAnswered: boolean;
}

export async function recordAnswer(
  db: Db,
  opts: {
    attempt: AttemptContext;
    ordinal: number;
    rawAnswer: unknown;
    timeMs?: number;
  },
): Promise<AnswerOutcome> {
  if (opts.attempt.status !== "in_progress") {
    throw errors.forbidden("That attempt is no longer open.");
  }

  const items = await loadResolvedPaper(
    db,
    opts.attempt.attemptId,
    opts.attempt.seed,
    opts.attempt.engineVersion,
  );
  const item = items.find((i) => i.ordinal === opts.ordinal);
  if (!item) throw errors.notFound(`This paper has no question ${opts.ordinal}.`);

  const result = gradeResponse(item, opts.rawAnswer);
  const revealVerdict = opts.attempt.blueprintScope !== "final";

  // `responses` is append-only, enforced by trigger. A repeated answer for an
  // ordinal is not an error -- a flaky network will produce them -- but the
  // first answer is the one that counts and nothing overwrites it.
  const inserted = await db.query(
    `insert into responses (attempt_id, ordinal, raw_answer, is_correct, points, time_ms)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (attempt_id, ordinal) do nothing
     returning ordinal`,
    [
      opts.attempt.attemptId,
      opts.ordinal,
      JSON.stringify(opts.rawAnswer ?? {}),
      result.isCorrect,
      result.points,
      opts.timeMs ?? null,
    ],
  );

  return {
    result,
    item,
    revealVerdict,
    alreadyAnswered: inserted.rowCount === 0,
  };
}

/* ============================================================
 * Submitting
 * ========================================================== */

export interface SubmitResult {
  readonly score: number;
  readonly maxScore: number;
  readonly mastery: number;
  readonly byObjective: Record<string, { correct: number; total: number }>;
  readonly items: ResolvedItem[];
  readonly results: Map<number, GradeResult>;
  readonly alreadySubmitted: boolean;
}

export async function submitAttempt(db: Db, attempt: AttemptContext): Promise<SubmitResult> {
  const items = await loadResolvedPaper(db, attempt.attemptId, attempt.seed, attempt.engineVersion);

  const { rows: responseRows } = await db.query(
    "select ordinal, raw_answer, is_correct, points from responses where attempt_id = $1",
    [attempt.attemptId],
  );

  const results = new Map<number, GradeResult>();
  for (const r of responseRows) {
    const item = items.find((i) => i.ordinal === Number(r.ordinal));
    if (!item) continue;
    // Re-grade from the stored raw answer rather than trusting the stored
    // verdict. If a key correction has landed, the submit reflects it.
    results.set(Number(r.ordinal), gradeResponse(item, r.raw_answer));
  }

  const scored = scoreAttempt(items, results);

  // Idempotent: submitting twice must not double-score.
  const { rows: updated } = await db.query(
    `update attempts
        set status = 'submitted', score = $2, max_score = $3, submitted_at = now()
      where id = $1 and status = 'in_progress'
      returning id`,
    [attempt.attemptId, scored.score, scored.maxScore],
  );

  return { ...scored, items, results, alreadySubmitted: updated.length === 0 };
}

/* ============================================================
 * Progress
 * ========================================================== */

export async function updateStageProgress(
  db: Db,
  opts: { userId: string; stageId: string; mastery: number; score: number },
): Promise<void> {
  await db.query(
    `insert into stage_progress (user_id, stage_id, mastery, best_score, attempts, last_seen_at)
     values ($1, $2, $3, $4, 1, now())
     on conflict (user_id, stage_id) do update
       set mastery      = greatest(stage_progress.mastery, excluded.mastery),
           best_score   = greatest(coalesce(stage_progress.best_score, 0), excluded.best_score),
           attempts     = stage_progress.attempts + 1,
           last_seen_at = now()`,
    [opts.userId, opts.stageId, Math.min(1, Math.max(0, opts.mastery)), opts.score],
  );
}

/** Stable hash of a resolved paper, for reproducibility auditing. */
export function paperFingerprint(items: readonly ResolvedItem[]): string {
  return createHash("sha256")
    .update(items.map((i) => `${i.ordinal}:${i.itemId}:${i.options.join("|")}`).join("\n"))
    .digest("hex");
}
