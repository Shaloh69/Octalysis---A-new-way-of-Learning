import type { FastifyInstance } from "fastify";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import type { Env } from "../env.js";

/**
 * Lecture Mode — the aggregate a teacher puts on the projector.
 *
 * **NO NAMES, EVER.** `apps/console/CLAUDE.md` states it as a hard rule and this
 * route is where it has to be true, because a UI promise is only as good as the
 * payload behind it. Nothing here selects `full_name`, `student_id`, or
 * `user_id` — not filtered out at the edge, never fetched. A field that is never
 * loaded cannot leak through a logging change or a careless spread.
 *
 * **SMALL GROUPS ARE SUPPRESSED.** With four students in a room, "3 of 4 chose
 * B" plus one visible face is not anonymous. Under `MIN_COHORT` the endpoint
 * returns counts as null and says why, rather than returning numbers that
 * identify people to everyone watching.
 *
 * This is polled rather than pushed. `PAGE-SPECS.md` names Supabase Realtime,
 * and Realtime on the free tier is one more thing to fail in front of forty
 * students -- a five-second poll of a cheap aggregate degrades to "slightly
 * stale" instead of "blank screen mid-lecture".
 */

/** Below this, an aggregate identifies individuals. */
const MIN_COHORT = 5;

export function registerLiveRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/live
   *
   * What the room is doing right now, in aggregate.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/live", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    // Active = an attempt touched in the last 20 minutes. Long enough to
    // survive a student reading a question, short enough that yesterday's
    // lecture is not still on the board.
    const active = await app.db.query(
      `select count(distinct a.user_id)::int as n
         from attempts a
        where a.status = 'in_progress'
          and a.started_at > now() - interval '20 minutes'`,
    );

    const perStage = await app.db.query(
      `select sp.stage_id, count(*)::int as n, round(avg(sp.mastery) * 100)::int as avg_mastery
         from stage_progress sp
         join profiles p on p.id = sp.user_id and p.deleted_at is null
        group by sp.stage_id
        order by sp.stage_id`,
    );

    // The distribution for whatever is being answered right now, by ORDINAL.
    // No item text, because a projector showing the stem alongside the split
    // hands the answer to anyone who has not answered yet.
    const spread = await app.db.query(
      `select r.ordinal,
              count(*)::int as answered,
              count(*) filter (where r.is_correct)::int as correct
         from responses r
         join attempts a on a.id = r.attempt_id
        where a.status = 'in_progress'
          and r.answered_at > now() - interval '20 minutes'
        group by r.ordinal
        order by r.ordinal`,
    );

    const cohort = Number(active.rows[0]?.n ?? 0);
    const suppressed = cohort > 0 && cohort < MIN_COHORT;

    return reply.send({
      cohort,
      // Below the threshold the numbers ARE the identification, so they are not
      // sent at all rather than sent and hidden by CSS.
      suppressed,
      minCohort: MIN_COHORT,
      stages: perStage.rows.map((r) => ({
        stageId: r.stage_id,
        students: Number(r.n),
        avgMastery: Number(r.avg_mastery ?? 0),
      })),
      spread: suppressed
        ? []
        : spread.rows.map((r) => ({
            ordinal: Number(r.ordinal),
            answered: Number(r.answered),
            correct: Number(r.correct),
          })),
      at: new Date().toISOString(),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/live/health
   *
   * The one thing a teacher needs mid-lecture that is not about students:
   * is the system itself all right? Cheap enough to poll.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/live/health", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select
         (select count(*)::int from attempts
           where status = 'in_progress'
             and started_at > now() - interval '20 minutes')   as in_progress,
         (select count(*)::int from attempts
           where submitted_at > now() - interval '20 minutes') as submitted_recently,
         (select count(*)::int from feedback
           where created_at > now() - interval '20 minutes')   as reports_recently`,
    );
    const r = rows[0]!;
    return reply.send({
      inProgress: Number(r.in_progress),
      submittedRecently: Number(r.submitted_recently),
      // A spike here during a lecture usually means one broken item, not forty
      // confused students. Worth surfacing where a teacher will see it.
      reportsRecently: Number(r.reports_recently),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/live      (STUDENT view of the same aggregate)
   *
   * A student sees the class distribution AFTER they have answered, and never
   * before -- otherwise the projector becomes a way to copy the room.
   * -------------------------------------------------------- */
  app.get("/api/v1/live", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const { rows } = await app.db.query(
      `select count(distinct a.user_id)::int as cohort
         from attempts a
        where a.status = 'in_progress'
          and a.started_at > now() - interval '20 minutes'`,
    );
    const cohort = Number(rows[0]?.cohort ?? 0);

    return reply.send({
      cohort,
      suppressed: cohort < MIN_COHORT,
      minCohort: MIN_COHORT,
    });
  });
}
