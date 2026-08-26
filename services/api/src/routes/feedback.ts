import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { loadAttempt, loadResolvedPaper } from "../repo/engine-repo.js";
import type { Env } from "../env.js";

/**
 * P8 — feedback: the flag, the content report, and the SUS survey.
 *
 * Three rules shape this file.
 *
 * 1. **A content report carries the exact variant the student saw.** Not the
 *    item template — the resolved instance, with its numbers. "Question 7 is
 *    wrong" is unactionable when every student got different numbers; "question
 *    7 with f=2400 MHz is wrong" is a bug report. The client cannot be trusted
 *    to send it truthfully, so the server reconstructs it from the attempt.
 *
 * 2. **SUS is scored in the database, never here.** `sus_score()` is verified by
 *    hand against the two endpoints of the scale (all 5s → 100, all 1s → 0) and
 *    `inv_24` checks stored scores against it. A second implementation in
 *    TypeScript would be a second thing to keep right.
 *
 * 3. **The survey does not nag.** `PAGE-SPECS.md` §4: not before three sessions
 *    and one completed workflow, and a dismissal is remembered. The gate lives
 *    in `feedback_prompts` so it survives a cleared browser.
 */

const FlagBody = z.object({
  channel: z.enum(["flag", "content_report", "csat"]),
  category: z.enum(["broken", "confusing", "slow", "idea"]).optional(),
  body: z.string().trim().max(4000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  route: z.string().trim().max(200).optional(),
  appVersion: z.string().trim().max(50).optional(),
  context: z.record(z.unknown()).optional(),
  /** For a content report: which item, and which attempt it was seen in. */
  attemptId: z.string().uuid().optional(),
  ordinal: z.number().int().min(1).max(200).optional(),
});

const SusBody = z.object({
  answers: z.array(z.number().int().min(1).max(5)).length(10),
  route: z.string().trim().max(200).optional(),
});

const TriageBody = z.object({
  status: z.enum(["new", "triaged", "in_progress", "shipped", "wont_fix"]),
  severity: z.enum(["low", "medium", "high"]).optional(),
  releasedIn: z.string().trim().max(50).optional(),
});

export function registerFeedbackRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * POST /api/v1/feedback   (any signed-in user)
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/feedback",
    { config: { rateLimit: { max: 20 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      if (!id) throw errors.unauthorized("Sign in to send feedback.");

      const parsed = FlagBody.safeParse(req.body);
      if (!parsed.success) throw errors.badRequest("That feedback could not be read.");
      const b = parsed.data;

      // A report about a question resolves to the EXACT instance the student
      // saw. Taken from the attempt server-side; the client is not asked, and
      // could not be believed if it were.
      let itemId: string | null = null;
      let resolvedVariant: unknown = null;

      if (b.attemptId && b.ordinal !== undefined) {
        // Ownership is checked FIRST and separately. Reporting on someone
        // else's paper must not confirm that the paper exists, so a miss here
        // is silent -- the report is still filed, just without a variant.
        const owned = await app.db.query(
          "select 1 from attempts where id = $1 and user_id = $2",
          [b.attemptId, id.userId],
        );

        if (owned.rowCount === 1) {
          // The stem is NOT stored -- it is regenerated from the seed, which is
          // the same replay the console drill-down uses. Reading a
          // `stem_resolved` column here would have been reading a column that
          // does not exist, and storing one would be a second source of truth
          // for the thing `attempts.seed` already guarantees.
          const attempt = await loadAttempt(app.db, b.attemptId);
          if (attempt) {
            const items = await loadResolvedPaper(
              app.db,
              attempt.attemptId,
              attempt.seed,
              attempt.engineVersion,
            );
            const item = items.find((i) => i.ordinal === b.ordinal);
            if (item) {
              itemId = item.itemId ?? null;
              resolvedVariant = {
                ordinal: item.ordinal,
                params: item.resolvedParams,
                stem: item.stem,
                options: item.options,
              };
            }
          }
        }
      }

      const { rows } = await app.db.query(
        `insert into feedback
           (user_id, role, channel, category, body, rating, route, app_version,
            context, item_id, resolved_variant)
         values ($1, $2::user_role, $3::feedback_channel, $4, $5, $6, $7, $8, $9, $10, $11)
         returning id`,
        [
          id.userId,
          id.role,
          b.channel,
          b.category ?? null,
          b.body ?? null,
          b.rating ?? null,
          b.route ?? null,
          b.appVersion ?? null,
          JSON.stringify(b.context ?? {}),
          itemId,
          resolvedVariant === null ? null : JSON.stringify(resolvedVariant),
        ],
      );

      return reply.status(201).send({ id: rows[0]!.id, variantAttached: resolvedVariant !== null });
    },
  );

  /* ----------------------------------------------------------
   * GET /api/v1/feedback/prompt   -- may we show the SUS survey?
   *
   * The GATE, server-side. PAGE-SPECS.md 4: three sessions AND one completed
   * workflow, and never again once answered or dismissed twice.
   * -------------------------------------------------------- */
  app.get("/api/v1/feedback/prompt", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const { rows } = await app.db.query(
      `select
         (select count(*)::int from attempts
           where user_id = $1 and status = 'submitted')      as completed,
         (select count(distinct date_trunc('day', started_at))::int
            from attempts where user_id = $1)                 as sessions,
         (select answered from feedback_prompts
           where user_id = $1 and prompt_key = 'sus')         as answered,
         (select dismissed_count from feedback_prompts
           where user_id = $1 and prompt_key = 'sus')         as dismissed`,
      [id.userId],
    );
    const r = rows[0]!;
    const answered = r.answered === true;
    const dismissed = Number(r.dismissed ?? 0);

    return reply.send({
      show:
        !answered &&
        dismissed < 2 &&
        Number(r.sessions ?? 0) >= 3 &&
        Number(r.completed ?? 0) >= 1,
      sessions: Number(r.sessions ?? 0),
      completed: Number(r.completed ?? 0),
    });
  });

  app.post("/api/v1/feedback/prompt/dismiss", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");
    await app.db.query(
      `insert into feedback_prompts (user_id, prompt_key, shown_at, dismissed_count)
       values ($1, 'sus', now(), 1)
       on conflict (user_id, prompt_key)
       do update set dismissed_count = feedback_prompts.dismissed_count + 1,
                     shown_at = now()`,
      [id.userId],
    );
    return reply.send({ ok: true });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/feedback/sus
   * -------------------------------------------------------- */
  app.post("/api/v1/feedback/sus", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const parsed = SusBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("A SUS response needs exactly 10 answers, each from 1 to 5.");
    }

    // sus_score() does the arithmetic. See rule 2 at the top of this file.
    const { rows } = await app.db.query(
      `insert into feedback (user_id, role, channel, sus_answers, sus_score, route)
       values ($1, $2::user_role, 'sus', $3::int[], sus_score($3::int[]), $4)
       returning sus_score`,
      [id.userId, id.role, parsed.data.answers, parsed.data.route ?? null],
    );

    await app.db.query(
      `insert into feedback_prompts (user_id, prompt_key, shown_at, answered)
       values ($1, 'sus', now(), true)
       on conflict (user_id, prompt_key) do update set answered = true`,
      [id.userId],
    );

    return reply.status(201).send({ score: Number(rows[0]!.sus_score) });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/feedback    (staff)
   * -------------------------------------------------------- */
  app.get("/api/v1/console/feedback", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const q = req.query as { status?: string; channel?: string };

    const { rows } = await app.db.query(
      `select f.id, f.channel, f.category, f.body, f.rating, f.route, f.status,
              f.severity, f.sus_score, f.item_id, f.resolved_variant, f.created_at,
              f.role, p.full_name as reporter_name, i.slug as item_slug
         from feedback f
         left join profiles p on p.id = f.user_id
         left join items i    on i.id = f.item_id
        where ($1::text is null or f.status  = $1::feedback_status)
          and ($2::text is null or f.channel = $2::feedback_channel)
        order by f.created_at desc
        limit 300`,
      [q.status ?? null, q.channel ?? null],
    );

    // The SUS headline. A single number is what makes it comparable to the
    // published benchmark (68 = average); the raw answers stay in the rows.
    const sus = await app.db.query(
      `select round(avg(sus_score), 1) as mean, count(*)::int as n
         from feedback where channel = 'sus' and sus_score is not null`,
    );

    return reply.send({
      entries: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        category: r.category,
        body: r.body,
        rating: r.rating === null ? null : Number(r.rating),
        route: r.route,
        status: r.status,
        severity: r.severity,
        susScore: r.sus_score === null ? null : Number(r.sus_score),
        itemId: r.item_id,
        itemSlug: r.item_slug,
        resolvedVariant: r.resolved_variant,
        reporterName: r.reporter_name,
        role: r.role,
        createdAt: r.created_at,
      })),
      sus: {
        mean: sus.rows[0]?.mean === null ? null : Number(sus.rows[0]?.mean ?? 0),
        n: Number(sus.rows[0]?.n ?? 0),
      },
    });
  });

  /* ----------------------------------------------------------
   * PATCH /api/v1/console/feedback/:id   (staff triage)
   * -------------------------------------------------------- */
  app.patch("/api/v1/console/feedback/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const feedbackId = (req.params as { id: string }).id;

    const parsed = TriageBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("That triage update could not be read.");

    const { rowCount } = await app.db.query(
      `update feedback
          set status = $2::feedback_status, severity = coalesce($3, severity),
              released_in = coalesce($4, released_in),
              triaged_by = $5, updated_at = now()
        where id = $1`,
      [
        feedbackId,
        parsed.data.status,
        parsed.data.severity ?? null,
        parsed.data.releasedIn ?? null,
        id.userId,
      ],
    );
    if (rowCount === 0) throw errors.notFound("No such feedback.");

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1, 'feedback.triage', 'feedback', $2, $3)`,
      [id.userId, feedbackId, JSON.stringify(parsed.data)],
    );

    return reply.send({ ok: true });
  });
}
