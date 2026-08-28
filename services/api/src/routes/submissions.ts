import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import type { Env } from "../env.js";

/**
 * Labs, the project, and participation — 40% of the final grade.
 *
 * These are NOT attempts, and the difference decides the whole file. An attempt
 * is machine-generated and machine-graded with an answer key withheld by RLS. A
 * submission is written by a student and graded by a person against a rubric,
 * and there is no secret in it at all.
 *
 * THREE RULES.
 *
 * 1. **A graded submission is frozen.** Same principle as `responses` being
 *    append-only: once a person has marked something, the student cannot
 *    quietly change what was marked. A correction is a REGRADE — staff return
 *    it first — never an edit. Enforced by trigger in the database, so it holds
 *    even against the service role.
 *
 * 2. **Reasoning is a graded criterion, not a courtesy.** `LAB-MANUAL.md`:
 *    every lab's rubric puts a full point on stated reasoning, and a right
 *    answer with no explanation caps at 3 of 4. So `body_md` is what the rubric
 *    scores, and a submission with an empty one is refused rather than silently
 *    accepted and marked down later.
 *
 * 3. **Late is a fact, not a penalty.** `is_late` is a generated column. Whether
 *    it costs marks is the instructor's decision at grading time; the database
 *    only records what happened.
 */

const SubmitBody = z.object({
  kind: z.enum(["lab", "project", "participation"]),
  slug: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(200),
  stageId: z.string().regex(/^\d{2}$/).nullable().optional(),
  bodyMd: z.string().trim().max(40_000),
  attachments: z
    .array(z.object({ name: z.string().trim().max(200), path: z.string().trim().max(500) }))
    .max(10)
    .optional(),
  payload: z.record(z.unknown()).optional(),
  /** `false` saves a draft without handing it in. */
  submit: z.boolean().default(true),
});

const GradeBody = z.object({
  score: z.number().min(0),
  maxScore: z.number().positive(),
  /** One entry per rubric criterion, as authored in the lab manual. */
  rubric: z.record(z.unknown()).optional(),
  feedbackMd: z.string().trim().max(20_000).optional(),
});

const jsonParam = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);

export function registerSubmissionRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/submissions          -- the student's own
   * -------------------------------------------------------- */
  app.get("/api/v1/submissions", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const { rows } = await app.db.query(
      `select id, kind, stage_id, slug, title, body_md, attachments, payload,
              status, submitted_at, score, max_score, rubric, feedback_md,
              graded_at, due_at, is_late, updated_at
         from submissions where user_id = $1
        order by coalesce(submitted_at, updated_at) desc`,
      [id.userId],
    );
    return reply.send({ submissions: rows.map(toStudentShape) });
  });

  /* ----------------------------------------------------------
   * PUT /api/v1/submissions/:slug    -- create or update MINE
   *
   * PUT rather than POST because a deliverable is a slot, not a stream: one
   * submission per student per slug, and re-handing-in replaces the draft
   * rather than creating a second row a grader might miss.
   * -------------------------------------------------------- */
  app.put("/api/v1/submissions/:slug", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const body = SubmitBody.safeParse({
      ...(req.body as object),
      slug: (req.params as { slug: string }).slug,
    });
    if (!body.success) {
      throw errors.badRequest("That submission could not be read. Check the required fields.");
    }
    const b = body.data;

    // Rule 2. An empty write-up is not a submission -- the rubric puts a full
    // point on stated reasoning, so accepting one silently would mean marking
    // it down for something nobody told the student about.
    if (b.submit && b.bodyMd.length < 20) {
      throw errors.badRequest(
        "Write up your reasoning before submitting. The rubric gives a full point for it, " +
          "and a correct answer with no explanation cannot score above 3 of 4.",
      );
    }

    const existing = await app.db.query(
      "select id, status from submissions where user_id = $1 and slug = $2",
      [id.userId, b.slug],
    );

    if (existing.rows[0]?.status === "graded") {
      throw errors.forbidden(
        "This has already been graded. Ask your instructor to return it if it needs changing.",
      );
    }

    const { rows } = await app.db.query(
      `insert into submissions
         (user_id, kind, stage_id, slug, title, body_md, attachments, payload,
          status, submitted_at)
       values ($1, $2::submission_kind, $3, $4, $5, $6, $7, $8,
               $9::submission_status, case when $9 = 'submitted' then now() else null end)
       on conflict (user_id, slug) do update
         set title        = excluded.title,
             body_md      = excluded.body_md,
             attachments  = excluded.attachments,
             payload      = excluded.payload,
             status       = excluded.status,
             submitted_at = coalesce(excluded.submitted_at, submissions.submitted_at)
       returning id, status, submitted_at, is_late`,
      [
        id.userId,
        b.kind,
        b.stageId ?? null,
        b.slug,
        b.title,
        b.bodyMd,
        jsonParam(b.attachments ?? []),
        jsonParam(b.payload ?? {}),
        b.submit ? "submitted" : "draft",
      ],
    );

    const r = rows[0]!;
    return reply.send({
      id: r.id,
      status: r.status,
      submittedAt: r.submitted_at,
      // Said plainly rather than discovered at grading time.
      isLate: r.is_late === true,
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/submissions   (staff)
   * -------------------------------------------------------- */
  app.get("/api/v1/console/submissions", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const q = req.query as { status?: string; kind?: string; slug?: string };

    const { rows } = await app.db.query(
      `select s.id, s.user_id, s.kind, s.stage_id, s.slug, s.title, s.body_md,
              s.attachments, s.payload, s.status, s.submitted_at, s.score,
              s.max_score, s.rubric, s.feedback_md, s.graded_at, s.due_at,
              s.is_late, p.full_name, p.student_id,
              g.full_name as grader_name
         from submissions s
         join profiles p on p.id = s.user_id
         left join profiles g on g.id = s.graded_by
        where ($1::text is null or s.status = $1::submission_status)
          and ($2::text is null or s.kind   = $2::submission_kind)
          and ($3::text is null or s.slug   = $3)
        order by (s.status = 'submitted') desc, s.submitted_at asc nulls last
        limit 500`,
      [q.status ?? null, q.kind ?? null, q.slug ?? null],
    );

    const summary = await app.db.query(
      `select status::text as status, count(*)::int as n from submissions group by status`,
    );

    return reply.send({
      submissions: rows.map((r) => ({
        ...toStudentShape(r),
        studentName: r.full_name,
        studentId: r.student_id,
        graderName: r.grader_name,
      })),
      summary: Object.fromEntries(summary.rows.map((r) => [r.status, Number(r.n)])),
    });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/submissions/:id/grade   (staff)
   * -------------------------------------------------------- */
  app.post("/api/v1/console/submissions/:id/grade", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const subId = (req.params as { id: string }).id;

    const body = GradeBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That grade could not be read.");
    const g = body.data;

    if (g.score > g.maxScore) {
      throw errors.badRequest(`A score of ${g.score} is above the maximum of ${g.maxScore}.`);
    }

    const { rowCount } = await app.db.query(
      `update submissions
          set status = 'graded', score = $2, max_score = $3,
              rubric = $4, feedback_md = coalesce($5, feedback_md),
              graded_by = $6, graded_at = now()
        where id = $1 and status in ('submitted','returned','graded')`,
      [subId, g.score, g.maxScore, jsonParam(g.rubric ?? {}), g.feedbackMd ?? null, id!.userId],
    );
    if (rowCount === 0) {
      throw errors.notFound("No such submission, or it has not been handed in yet.");
    }

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'submission.grade','submission',$2,$3)`,
      [id!.userId, subId, JSON.stringify({ score: g.score, maxScore: g.maxScore })],
    );

    return reply.send({ ok: true });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/submissions/:id/return   (staff)
   *
   * The ONLY way a graded submission becomes editable again. Requires a reason
   * for the same reason a lock override does: in December, "why was this
   * reopened" needs an answer that is not a guess.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/submissions/:id/return", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const subId = (req.params as { id: string }).id;

    const parsed = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("Returning a submission needs a reason of at least 3 characters.");
    }

    const { rowCount } = await app.db.query(
      `update submissions set status = 'returned', feedback_md = $2 where id = $1`,
      [subId, parsed.data.reason],
    );
    if (rowCount === 0) throw errors.notFound("No such submission.");

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'submission.return','submission',$2,$3)`,
      [id!.userId, subId, JSON.stringify({ reason: parsed.data.reason })],
    );

    return reply.send({ ok: true });
  });
}

function toStudentShape(r: Record<string, unknown>) {
  return {
    id: r.id,
    kind: r.kind,
    stageId: r.stage_id,
    slug: r.slug,
    title: r.title,
    bodyMd: r.body_md,
    attachments: r.attachments ?? [],
    payload: r.payload ?? {},
    status: r.status,
    submittedAt: r.submitted_at,
    score: r.score === null ? null : Number(r.score),
    maxScore: r.max_score === null ? null : Number(r.max_score),
    rubric: r.rubric ?? {},
    feedbackMd: r.feedback_md,
    gradedAt: r.graded_at,
    dueAt: r.due_at,
    isLate: r.is_late === true,
  };
}
