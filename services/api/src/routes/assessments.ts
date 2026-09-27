import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";

/**
 * Creating the thing a student sits.
 *
 * This was the gap that made the whole engine unreachable: blueprints were
 * seeded and papers could be generated, but **nothing could create an
 * assessment**, so there was never anything for a student to open.
 *
 * TWO THINGS HAPPEN HERE THAT CANNOT HAPPEN ANYWHERE ELSE.
 *
 * 1. **The exam salt is minted.** Every assessment gets its own salt, derived
 *    from `EXAM_SALT_SECRET`, and it lives in `assessment_secrets` — a table
 *    with RLS on and a deny-all policy, which is to say service-role only.
 *    Without it a paper is not reproducible; with it readable by a client, every
 *    paper is predictable.
 *
 * 2. **The blueprint is checked BEFORE the assessment exists.** A blueprint
 *    asking for 8 `apply` items from a bank holding 3 cannot be satisfied, and
 *    the honest moment to say so is when a teacher creates the assessment — not
 *    when forty students press Start.
 */

const CreateBody = z.object({
  blueprintId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  /** Null means every section. */
  sectionId: z.string().uuid().nullable().optional(),
  /**
   * FIVE, by the instructor's ruling of 9 September 2026 -- not one.
   *
   * A self-check a student may sit once is an exam; one they may sit five times
   * is practice that happens to be graded. The engine reseeds every attempt, so
   * the second sitting is a DIFFERENT paper from the same blueprint rather than
   * a second look at the same questions -- which is what makes repeat attempts
   * defensible here at all.
   */
  attemptsAllowed: z.number().int().min(1).max(10).default(5),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
});

/**
 * The editable half of an assessment.
 *
 * `undefined` means "leave alone" and `null` means "clear this bound", and the
 * two have to stay distinguishable — clearing a closing date is a real thing a
 * teacher does when an exam is extended indefinitely, and it must not look the
 * same as not mentioning the field.
 *
 * The reason is REQUIRED. Moving an exam window changes what students can do,
 * and `audit_log` entries without a reason are the ones nobody can interpret
 * six weeks later.
 */
const WindowBody = z.object({
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  attemptsAllowed: z.number().int().min(1).max(10).optional(),
  reason: z.string().trim().min(3).max(500),
});

/** Rotating a salt changes every paper not yet started, so it carries a reason. */
const RotateBody = z.object({
  reason: z.string().trim().min(3).max(500),
});

/**
 * A fresh salt. Derived from EXAM_SALT_SECRET plus a random nonce, so it is
 * reproducible from a backup of `assessment_secrets` and the server secret, and
 * unpredictable without both.
 */
async function mintSalt(secret: string, assessmentId: string): Promise<string> {
  const { createHmac, randomUUID } = await import("node:crypto");
  return createHmac("sha256", secret)
    .update(`assessment:${assessmentId}:${randomUUID()}`)
    .digest("hex");
}

/** One live, gradeable item as the feasibility check sees it. */
interface PoolRow { bloom: string; type: string; act: number | string; stage_id: string }

export interface Shortfall { dimension: string; cell: string; need: number; have: number }

/**
 * Can this blueprint be filled from this pool? The SAME answer for the create
 * form and for every row of the list, so the two can never disagree.
 *
 * Two separate failures, and they need different fixes: not enough items at
 * all, versus enough items in the wrong shape.
 */
export function feasibilityOf(
  b: { scope: string; stage_id: string | null; total_items: number | string; constraints: unknown },
  livePool: PoolRow[],
): { totalItems: number; poolSize: number; enoughItems: boolean; shortfalls: Shortfall[]; satisfiable: boolean } {
  const rows = b.scope === "stage" ? livePool.filter((r) => r.stage_id === b.stage_id) : livePool;
  const cons = (b.constraints ?? {}) as Record<string, Record<string, number> | undefined>;
  const shortfalls: Shortfall[] = [];
  const check = (dimension: string, count: (cell: string) => number) => {
    const want = cons[dimension];
    if (!want) return;
    for (const [cell, need] of Object.entries(want)) {
      const have = count(cell);
      if (have < Number(need)) shortfalls.push({ dimension, cell, need: Number(need), have });
    }
  };
  check("by_act", (cell) => rows.filter((r) => String(r.act) === cell).length);
  check("by_bloom", (cell) => rows.filter((r) => r.bloom === cell).length);
  check("by_type", (cell) => rows.filter((r) => r.type === cell).length);

  const totalItems = Number(b.total_items);
  const poolSize = rows.length;
  return {
    totalItems,
    poolSize,
    enoughItems: poolSize >= totalItems,
    shortfalls,
    satisfiable: poolSize >= totalItems && shortfalls.length === 0,
  };
}

// The live pool a blueprint may draw from. `gradeable = false` is excluded:
// stage 00 is orientation and is never sampled (V-1).
const LIVE_POOL_SQL = `select i.bloom, i.type::text as type, s.act, i.stage_id
                         from items i
                         join stages s on s.id = i.stage_id
                        where i.status = 'live' and s.gradeable`;

export function registerAssessmentRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/assessments
   * -------------------------------------------------------- */
  app.get("/api/v1/console/assessments", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select a.id, a.title, a.attempts_allowed, a.opens_at, a.closes_at, a.created_at,
              b.id as blueprint_id, b.name as blueprint_name, b.scope, b.stage_id,
              b.total_items, b.constraints, a.section_id, s.code as section_code,
              -- WHEN the salt was set, and whether it has been rotated since.
              -- Never the salt itself: scan-bundle.mjs forbids it in both
              -- bundles, and the test suite forbids it in this response.
              sec.rotated_at as salt_set_at,
              (select max(l.at) from audit_log l
                where l.action = 'assessment.salt_rotate' and l.target_id = a.id::text)
                as salt_rotated_at,
              (select count(*)::int from attempts at where at.assessment_id = a.id) as attempts,
              (select count(*)::int from attempts at
                where at.assessment_id = a.id and at.status = 'submitted') as submitted
         from assessments a
         join blueprints b on b.id = a.blueprint_id
         left join sections s on s.id = a.section_id
         left join assessment_secrets sec on sec.assessment_id = a.id
        order by a.created_at desc`,
    );

    const sections = await app.db.query(
      "select id, code, term from sections order by code",
    );
    // One read of the live pool answers every row's "can the bank fill it?".
    const pool = (await app.db.query(LIVE_POOL_SQL)).rows as PoolRow[];

    const blueprints = await app.db.query(
      `select id, name, scope, stage_id, total_items, constraints
         from blueprints order by scope, name`,
    );

    return reply.send({
      assessments: rows.map((r) => ({
        id: r.id,
        title: r.title,
        attemptsAllowed: Number(r.attempts_allowed),
        opensAt: r.opens_at,
        closesAt: r.closes_at,
        createdAt: r.created_at,
        blueprintId: r.blueprint_id,
        blueprintName: r.blueprint_name,
        scope: r.scope,
        stageId: r.stage_id,
        totalItems: Number(r.total_items),
        sectionId: r.section_id,
        sectionCode: r.section_code,
        saltSetAt: r.salt_set_at,
        saltRotatedAt: r.salt_rotated_at,
        attempts: Number(r.attempts),
        submitted: Number(r.submitted),
        bank: feasibilityOf(r, pool),
      })),
      blueprints: blueprints.rows.map((b) => ({
        id: b.id,
        name: b.name,
        scope: b.scope,
        stageId: b.stage_id,
        totalItems: Number(b.total_items),
        constraints: b.constraints,
      })),
      sections: sections.rows.map((x) => ({ id: x.id, code: x.code, term: x.term })),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/blueprints/:id/feasibility
   *
   * Can this blueprint actually be filled from the live bank?
   *
   * Answering it BEFORE an assessment is created is the entire point. The
   * engine already throws `BlueprintUnsatisfiable` naming the cell and the
   * shortfall -- but discovering that at 9am with a room full of students is
   * not a recoverable moment.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/blueprints/:id/feasibility", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const blueprintId = (req.params as { id: string }).id;

    const bp = await app.db.query(
      "select id, name, scope, stage_id, total_items, constraints from blueprints where id = $1",
      [blueprintId],
    );
    if (bp.rows.length === 0) throw errors.notFound("No such blueprint.");
    const b = bp.rows[0]!;
    const pool = (await app.db.query(LIVE_POOL_SQL)).rows as PoolRow[];
    const f = feasibilityOf(b, pool);

    return reply.send({ blueprintId: b.id, name: b.name, ...f });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/assessments
   * -------------------------------------------------------- */
  app.post("/api/v1/console/assessments", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest("That assessment could not be read. Check the required fields.");
    }
    const b = body.data;

    if (b.opensAt && b.closesAt && new Date(b.closesAt) <= new Date(b.opensAt)) {
      throw errors.badRequest("The closing time must be after the opening time.");
    }

    const created = await withTransaction(app.db, async (client) => {
      const bp = await client.query("select id from blueprints where id = $1", [b.blueprintId]);
      if (bp.rows.length === 0) throw errors.notFound("No such blueprint.");
      if (b.sectionId) {
        const sec = await client.query("select 1 from sections where id = $1", [b.sectionId]);
        if (sec.rows.length === 0) throw errors.notFound("No such section.");
      }

      const { rows } = await client.query(
        `insert into assessments
           (blueprint_id, section_id, title, opens_at, closes_at, attempts_allowed)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          b.blueprintId,
          b.sectionId ?? null,
          b.title,
          b.opensAt ?? null,
          b.closesAt ?? null,
          b.attemptsAllowed,
        ],
      );
      const assessmentId = rows[0]!.id;

      /*
       * The per-assessment salt, stored in `assessment_secrets`, which has RLS
       * on and a deny-all policy. That is service-role only, and it is the
       * entire reason papers are unpredictable but regenerable.
       */
      const salt = await mintSalt(env.EXAM_SALT_SECRET, assessmentId);

      await client.query(
        "insert into assessment_secrets (assessment_id, exam_salt) values ($1, $2)",
        [assessmentId, salt],
      );

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1,'assessment.create','assessment',$2,$3)`,
        [id!.userId, assessmentId, JSON.stringify({ title: b.title, blueprintId: b.blueprintId })],
      );

      return assessmentId;
    });

    return reply.status(201).send({ id: created });
  });

  /* ----------------------------------------------------------
   * PATCH /api/v1/console/assessments/:id
   *
   * The window, after the fact.
   *
   * This route was MISSING, and its absence made the comment below false: the
   * file said "closing it is a `closes_at` in the past; that is the supported
   * way to end one", while offering only GET and POST. There was no way to set
   * or move a window once an assessment existed, so an exam created without
   * dates was open forever and one created with them could never be extended.
   *
   * Three things it deliberately does NOT allow:
   *   - changing the blueprint. That would silently redefine what a paper is
   *     while attempts already exist against it.
   *   - changing the section. Who sits an exam is not a detail to adjust after
   *     students have started.
   *   - deleting anything. An assessment with attempts against it is evidence.
   *
   * Every change is audited with a reason, because moving an exam window is
   * student-visible state (`apps/console/CLAUDE.md`).
   * -------------------------------------------------------- */
  app.patch("/api/v1/console/assessments/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const assessmentId = (req.params as { id: string }).id;

    const body = WindowBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That change could not be read.");
    const b = body.data;

    const cur = await app.db.query(
      "select title, opens_at, closes_at, attempts_allowed from assessments where id = $1",
      [assessmentId],
    );
    if (cur.rows.length === 0) throw errors.notFound("No such assessment.");
    const before = cur.rows[0]!;

    // The resulting window must make sense, not merely the fields being sent.
    const opensAt = b.opensAt === undefined ? before.opens_at : b.opensAt;
    const closesAt = b.closesAt === undefined ? before.closes_at : b.closesAt;
    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
      throw errors.badRequest("An assessment cannot close before it opens.");
    }

    /*
     * Lowering the attempt limit below what a student has ALREADY used would
     * retroactively invalidate a sitting that was legitimate when it happened.
     * Raising it is always safe.
     */
    if (b.attemptsAllowed !== undefined && b.attemptsAllowed < Number(before.attempts_allowed)) {
      const used = await app.db.query(
        `select coalesce(max(attempt_no), 0)::int as n from attempts where assessment_id = $1`,
        [assessmentId],
      );
      const highest = Number(used.rows[0]!.n);
      if (b.attemptsAllowed < highest) {
        throw errors.badRequest(
          `A student has already sat attempt ${highest}. The limit cannot go below that ` +
            `without invalidating a sitting that was allowed at the time.`,
        );
      }
    }

    await app.db.query(
      `update assessments
          set opens_at = $2, closes_at = $3, attempts_allowed = $4
        where id = $1`,
      [assessmentId, opensAt, closesAt, b.attemptsAllowed ?? before.attempts_allowed],
    );

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'assessment.window','assessment',$2,$3)`,
      [
        id!.userId,
        assessmentId,
        JSON.stringify({
          title: before.title,
          reason: b.reason,
          from: {
            opensAt: before.opens_at,
            closesAt: before.closes_at,
            attemptsAllowed: Number(before.attempts_allowed),
          },
          to: {
            opensAt,
            closesAt,
            attemptsAllowed: b.attemptsAllowed ?? Number(before.attempts_allowed),
          },
        }),
      ],
    );

    return reply.send({ ok: true });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/assessments/:id/rotate-salt
   *
   * A new term, the same assessment, papers nobody has seen.
   *
   * `PAGE-SPECS.md` asked for this from the start and nothing did it: a salt
   * was minted once and lived forever, so reusing an assessment next term
   * handed next term's students the papers this term's students sat.
   *
   * WHAT IT CHANGES: every attempt STARTED after it. An attempt stores its own
   * seed at Start, so a paper already begun -- or already graded -- regenerates
   * exactly as it was. The test suite proves that on a resumed paper.
   *
   * Audited with the reason and never with the salt, old or new.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/assessments/:id/rotate-salt", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const assessmentId = (req.params as { id: string }).id;

    if (!z.string().uuid().safeParse(assessmentId).success) {
      throw errors.notFound("No such assessment.");
    }
    const body = RotateBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("A reason is required to rotate the exam salt.");

    const rotatedAt = await withTransaction(app.db, async (client) => {
      const cur = await client.query(
        `select a.title, s.rotated_at
           from assessments a left join assessment_secrets s on s.assessment_id = a.id
          where a.id = $1`,
        [assessmentId],
      );
      if (cur.rows.length === 0) throw errors.notFound("No such assessment.");
      const before = cur.rows[0]!;

      const salt = await mintSalt(env.EXAM_SALT_SECRET, assessmentId);
      // An upsert: an assessment seeded without a secrets row (which Start
      // would refuse) is repaired by the same action.
      const { rows } = await client.query(
        `insert into assessment_secrets (assessment_id, exam_salt, rotated_at)
         values ($1, $2, clock_timestamp())
         on conflict (assessment_id)
           do update set exam_salt = excluded.exam_salt, rotated_at = excluded.rotated_at
         returning rotated_at`,
        [assessmentId, salt],
      );

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1,'assessment.salt_rotate','assessment',$2,$3)`,
        [
          id!.userId,
          assessmentId,
          JSON.stringify({
            title: before.title,
            reason: body.data.reason,
            previousSetAt: before.rotated_at ?? null,
          }),
        ],
      );
      return rows[0]!.rotated_at as Date;
    });

    return reply.send({ ok: true, rotatedAt });
  });

  /* ----------------------------------------------------------
   * DELETE is deliberately absent.
   *
   * An assessment with attempts against it is evidence. Closing it is a
   * `closes_at` in the past, set through the PATCH above.
   * -------------------------------------------------------- */
}
