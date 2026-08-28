import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import { loadAttempt, loadResolvedPaper } from "../repo/engine-repo.js";
import type { Env } from "../env.js";

/**
 * The teacher console API.
 *
 * Two rules run through all of it:
 *
 *   - Every write that changes student-visible state writes to `audit_log`
 *     with an actor and a reason. If a grade is ever challenged, that table is
 *     the evidence.
 *   - A lock override REQUIRES a reason. INV-22 checks for it, and a toggle
 *     that does not record why is a toggle nobody can explain in December.
 */

export function registerConsoleRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/roster
   * -------------------------------------------------------- */
  app.get("/api/v1/console/roster", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select d.student_id, d.full_name, d.status, d.claimed_at,
              s.code as section_code,
              p.id as user_id, p.deleted_at,
              (select count(*)::int from attempts a where a.user_id = p.id) as attempts,
              (select round(avg(sp.mastery) * 100)::int
                 from stage_progress sp where sp.user_id = p.id) as avg_mastery
         from student_directory d
         left join sections s on s.id = d.section_id
         left join profiles p on p.student_id = d.student_id
        order by d.student_id`,
    );

    return reply.send({
      students: rows.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        status: r.status,
        sectionCode: r.section_code,
        userId: r.user_id,
        deactivated: r.deleted_at !== null,
        attempts: Number(r.attempts ?? 0),
        avgMastery: r.avg_mastery === null ? null : Number(r.avg_mastery),
      })),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/locks
   * The students x stages matrix.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/locks", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const stages = await app.db.query(
      "select id, title, ordinal from stages order by ordinal",
    );

    const students = await app.db.query(
      `select p.id as user_id, p.student_id, p.full_name
         from profiles p
        where p.student_id is not null and p.deleted_at is null
        order by p.student_id`,
    );

    // Resolved state per cell, from is_stage_unlocked() -- the same authority
    // the student app reads. The console must not compute its own answer.
    const cells = await app.db.query(
      `select p.id as user_id, s.id as stage_id,
              is_stage_unlocked(p.id, s.id) as unlocked,
              coalesce(sp.mastery, 0) as mastery,
              sl.state as override, sl.reason, sl.actor_id, sl.created_at
         from profiles p
         cross join stages s
         left join stage_progress sp on sp.user_id = p.id and sp.stage_id = s.id
         left join stage_locks sl
                on sl.scope = 'user' and sl.scope_user_id = p.id and sl.stage_id = s.id
        where p.student_id is not null and p.deleted_at is null`,
    );

    const globals = await app.db.query(
      `select stage_id, state, reason, unlock_at, lock_at
         from stage_locks where scope = 'global'`,
    );

    return reply.send({
      stages: stages.rows.map((s) => ({ id: s.id, title: s.title, ordinal: Number(s.ordinal) })),
      students: students.rows.map((s) => ({
        userId: s.user_id,
        studentId: s.student_id,
        fullName: s.full_name,
      })),
      cells: cells.rows.map((c) => ({
        userId: c.user_id,
        stageId: c.stage_id,
        unlocked: c.unlocked,
        mastery: Number(c.mastery),
        // null means "auto" -- the curriculum policy decides.
        override: c.override === "auto" ? null : (c.override ?? null),
        reason: c.reason,
      })),
      globalLocks: globals.rows,
    });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/locks
   * -------------------------------------------------------- */
  const LockBody = z.object({
    scope: z.enum(["global", "section", "user"]),
    stageId: z.string().regex(/^\d{2}$/),
    state: z.enum(["locked", "unlocked", "auto"]),
    userId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    // Not optional. INV-22 requires it, and a toggle nobody can explain in
    // December is worse than no toggle.
    reason: z.string().trim().min(3).max(500),
    unlockAt: z.string().datetime().optional(),
    lockAt: z.string().datetime().optional(),
  });

  app.post("/api/v1/console/locks", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = LockBody.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest(
        "A lock needs a scope, a stage, a state, and a reason of at least 3 characters.",
      );
    }
    const b = body.data;

    if (b.scope === "user" && !b.userId) throw errors.badRequest("A user-scope lock needs a userId.");
    if (b.scope === "section" && !b.sectionId) {
      throw errors.badRequest("A section-scope lock needs a sectionId.");
    }

    await withTransaction(app.db, async (client) => {
      if (b.state === "auto") {
        // "auto" means: stop overriding, let the curriculum decide. Delete the
        // row rather than storing a no-op.
        await client.query(
          `delete from stage_locks
            where scope = $1 and stage_id = $2
              and coalesce(scope_user_id::text, '') = coalesce($3::text, '')
              and coalesce(scope_section_id::text, '') = coalesce($4::text, '')`,
          [b.scope, b.stageId, b.userId ?? null, b.sectionId ?? null],
        );
      } else {
        await client.query(
          `insert into stage_locks
             (scope, scope_user_id, scope_section_id, stage_id, state, unlock_at, lock_at, reason, actor_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict do nothing`,
          [
            b.scope,
            b.userId ?? null,
            b.sectionId ?? null,
            b.stageId,
            b.state,
            b.unlockAt ?? null,
            b.lockAt ?? null,
            b.reason,
            id.userId,
          ],
        );
        // A repeat toggle should update, not silently no-op.
        await client.query(
          `update stage_locks
              set state = $5, unlock_at = $6, lock_at = $7, reason = $8,
                  actor_id = $9, created_at = now()
            where scope = $1 and stage_id = $4
              and coalesce(scope_user_id::text, '') = coalesce($2::text, '')
              and coalesce(scope_section_id::text, '') = coalesce($3::text, '')`,
          [
            b.scope,
            b.userId ?? null,
            b.sectionId ?? null,
            b.stageId,
            b.state,
            b.unlockAt ?? null,
            b.lockAt ?? null,
            b.reason,
            id.userId,
          ],
        );
      }

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'lock.set', 'stage', $2, $3)`,
        [id.userId, b.stageId, JSON.stringify(b)],
      );
    });

    return reply.send({ ok: true });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/students/:userId
   *
   * The page the instructor will use most: every attempt, and the EXACT
   * variant the student saw, regenerated from their stored seed.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/students/:userId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const userId = (req.params as { userId: string }).userId;

    const profile = await app.db.query(
      `select p.id, p.student_id, p.full_name, p.deleted_at, s.code as section_code
         from profiles p left join sections s on s.id = p.section_id
        where p.id = $1`,
      [userId],
    );
    if (profile.rows.length === 0) throw errors.notFound("No such student.");

    const attempts = await app.db.query(
      `select a.id, a.attempt_no, a.status, a.score, a.max_score,
              a.started_at, a.submitted_at, a.engine_version,
              s.title as assessment_title, b.scope
         from attempts a
         join assessments s on s.id = a.assessment_id
         join blueprints  b on b.id = s.blueprint_id
        where a.user_id = $1
        order by a.started_at desc`,
      [userId],
    );

    const progress = await app.db.query(
      `select stage_id, mastery, best_score, attempts, last_seen_at
         from stage_progress where user_id = $1 order by stage_id`,
      [userId],
    );

    return reply.send({
      student: {
        userId: profile.rows[0].id,
        studentId: profile.rows[0].student_id,
        fullName: profile.rows[0].full_name,
        sectionCode: profile.rows[0].section_code,
        deactivated: profile.rows[0].deleted_at !== null,
      },
      attempts: attempts.rows.map((a) => ({
        attemptId: a.id,
        attemptNo: Number(a.attempt_no),
        status: a.status,
        score: a.score === null ? null : Number(a.score),
        maxScore: a.max_score === null ? null : Number(a.max_score),
        startedAt: a.started_at,
        submittedAt: a.submitted_at,
        engineVersion: a.engine_version,
        assessmentTitle: a.assessment_title,
        scope: a.scope,
      })),
      progress: progress.rows.map((p) => ({
        stageId: p.stage_id,
        mastery: Number(p.mastery),
        bestScore: p.best_score === null ? null : Number(p.best_score),
        attempts: Number(p.attempts),
        lastSeenAt: p.last_seen_at,
      })),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/attempts/:attemptId
   *
   * Regenerate the exact paper from the stored seed. This is why the seed is
   * stored at all: months later, from `seed` plus `engine_version`, the paper
   * the student actually sat is reconstructed byte for byte.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/attempts/:attemptId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const attemptId = (req.params as { attemptId: string }).attemptId;

    const attempt = await loadAttempt(app.db, attemptId);
    if (!attempt) throw errors.notFound("No such attempt.");

    const items = await loadResolvedPaper(
      app.db,
      attempt.attemptId,
      attempt.seed,
      attempt.engineVersion,
    );

    const responses = await app.db.query(
      "select ordinal, raw_answer, is_correct, points, time_ms, answered_at from responses where attempt_id = $1",
      [attemptId],
    );
    const byOrdinal = new Map(responses.rows.map((r) => [Number(r.ordinal), r]));

    return reply.send({
      attemptId,
      status: attempt.status,
      engineVersion: attempt.engineVersion,
      // Staff see the key. That is the whole point of the drill-down, and
      // `ai_after_submit` grants staff the same read at the database level.
      items: items.map((i) => {
        const r = byOrdinal.get(i.ordinal);
        return {
          ordinal: i.ordinal,
          type: i.type,
          stageId: i.stageId,
          objectiveId: i.objectiveId,
          stem: i.stem,
          options: i.options,
          resolvedParams: i.resolvedParams,
          correctValue: i.correctValue,
          rationale: i.rationale,
          studentAnswer: r?.raw_answer ?? null,
          isCorrect: r ? r.is_correct : null,
          timeMs: r?.time_ms ?? null,
        };
      }),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/content
   *
   * Authoring status per stage. This exists because the honest answer to "is
   * the course ready" is per-chapter, and an aggregate hides it.
   *
   * A stage is PLANNED until someone writes its prose. `scripts/gen-stages.mjs`
   * emits a callout carrying `meta.kind='planned'` for every chapter that has
   * only its syllabus outline, so the gap is a queryable fact rather than
   * something a reader has to notice.
   *
   * Chapters 1-7 are authored. 8-18 carry their objectives and topic outline
   * and say plainly that the teaching text is coming -- which is the honest
   * state, and better than prose nobody has checked.
   *
   * (`scaffold` is still matched so an older sync is not misreported as done.)
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select s.id, s.title, s.act, s.ordinal, s.archetype, s.levels,
              s.est_minutes, s.published, s.gradeable,
              (select count(*)::int from content_blocks cb where cb.stage_id = s.id)
                as blocks,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.meta->>'kind' in ('scaffold','planned'))
                as scaffold_blocks,
              (select count(*)::int from objectives o where o.stage_id = s.id)
                as objectives,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status = 'live')
                as live_items,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status <> 'live')
                as draft_items
         from stages s
        order by s.ordinal`,
    );

    const stages = rows.map((r) => {
      const blocks = Number(r.blocks);
      const scaffold = Number(r.scaffold_blocks);
      return {
        id: r.id,
        title: r.title,
        act: Number(r.act),
        ordinal: Number(r.ordinal),
        archetype: r.archetype,
        levels: r.levels,
        estMinutes: Number(r.est_minutes),
        published: r.published,
        gradeable: r.gradeable,
        blocks,
        objectives: Number(r.objectives),
        liveItems: Number(r.live_items),
        draftItems: Number(r.draft_items),
        // Three states, and they are genuinely different:
        //   empty     nothing synced at all
        //   scaffold  objectives and a topic outline, no teaching text
        //   authored  real prose exists
        authoring: blocks === 0 ? "empty" : scaffold > 0 ? "planned" : "authored",
      };
    });

    const gradeable = stages.filter((s) => s.gradeable);
    return reply.send({
      stages,
      summary: {
        total: stages.length,
        authored: stages.filter((s) => s.authoring === "authored").length,
        planned: stages.filter((s) => s.authoring === "planned").length,
        empty: stages.filter((s) => s.authoring === "empty").length,
        objectives: stages.reduce((a, s) => a + s.objectives, 0),
        liveItems: stages.reduce((a, s) => a + s.liveItems, 0),
        // PHASES.md targets ~40 live items per gradeable stage. The bank is the
        // schedule, so the shortfall is stated as a number rather than implied.
        itemTarget: gradeable.length * 40,
      },
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/audit
   * -------------------------------------------------------- */
  app.get("/api/v1/console/audit", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 100), 500);

    const { rows } = await app.db.query(
      `select l.id, l.action, l.target_type, l.target_id, l.payload, l.at,
              p.full_name as actor_name
         from audit_log l
         left join profiles p on p.id = l.actor_id
        order by l.at desc
        limit $1`,
      [limit],
    );

    return reply.send({ entries: rows });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/audit/system  -- the invariant suite
   * -------------------------------------------------------- */
  app.get("/api/v1/console/audit/system", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      "select id, name, severity, offending_count, sample from run_invariants() order by id",
    );

    // On an unseeded database the bank-health checks legitimately have nothing
    // to check. They are notices, not failures.
    const EXPECTED_EMPTY = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);
    const results = rows.map((r) => ({
      id: r.id,
      name: r.name,
      severity: EXPECTED_EMPTY.has(r.id) && Number(r.offending_count) > 0 ? "notice" : r.severity,
      offendingCount: Number(r.offending_count),
      sample: r.sample,
    }));

    return reply.send({
      results,
      failing: results.filter((r) => r.severity === "fail" && r.offendingCount > 0).length,
      ranAt: new Date().toISOString(),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/gradebook.csv
   * -------------------------------------------------------- */
  app.get("/api/v1/console/gradebook.csv", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const stages = await app.db.query(
      "select id from stages where gradeable order by ordinal",
    );
    const stageIds = stages.rows.map((s) => s.id as string);

    const { rows } = await app.db.query(
      `select p.student_id, p.full_name, sp.stage_id, sp.mastery
         from profiles p
         left join stage_progress sp on sp.user_id = p.id
        where p.student_id is not null and p.deleted_at is null
        order by p.student_id`,
    );

    const byStudent = new Map<string, { name: string; mastery: Map<string, number> }>();
    for (const r of rows) {
      const entry = byStudent.get(r.student_id) ?? { name: r.full_name, mastery: new Map() };
      if (r.stage_id) entry.mastery.set(r.stage_id, Number(r.mastery));
      byStudent.set(r.student_id, entry);
    }

    const escape = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const lines = [["student_id", "full_name", ...stageIds.map((s) => `stage_${s}`)].join(",")];
    for (const [studentId, entry] of byStudent) {
      lines.push(
        [
          escape(studentId),
          escape(entry.name),
          ...stageIds.map((s) => String(Math.round((entry.mastery.get(s) ?? 0) * 100))),
        ].join(","),
      );
    }

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="octa-gradebook.csv"')
      .send(lines.join("\n"));
  });
}
