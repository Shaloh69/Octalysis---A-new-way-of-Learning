import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  LIVE_MIN_COHORT,
  LiveEndBody,
  LiveOptions,
  LiveSnapshot,
  LiveStartBody,
  type LiveSession,
} from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { AppError, errors } from "../errors.js";
import { withTransaction, type Db } from "../db.js";
import type { Env } from "../env.js";

/**
 * Lecture Mode — the aggregate a teacher puts on the projector, and the one
 * question put to the room.
 *
 * **NO NAMES, EVER.** `apps/console/CLAUDE.md` states it as a hard rule and this
 * route is where it has to be true, because a UI promise is only as good as the
 * payload behind it. Nothing here selects `full_name`, `student_id`, or
 * `user_id` — not filtered out at the edge, never fetched. Not even the teacher
 * who started a question: that is in `/audit`, and the projector reads this.
 *
 * **SMALL GROUPS ARE WITHHELD.** With four students in a room, "3 of 4 got it"
 * plus one visible face is not anonymous. Below `MIN_COHORT` the server sends
 * null in place of the figure, for a stage's average as much as for a
 * question's split, rather than a number the page declines to draw.
 *
 * **ONE QUESTION AT A TIME** (instructor, 29 Sep 2026: the server and console
 * half of "push an item" first). Starting and ending one are audited with the
 * actor and a reason. Nothing writes `live_responses` yet: the student half,
 * `/app/live`, reading the question through the one student serializer and
 * answering it through the grading service, is not built.
 *
 * This is polled rather than pushed. `PAGE-SPECS.md` names Supabase Realtime,
 * and Realtime on the free tier is one more thing to fail in front of forty
 * students -- a five-second poll of a cheap aggregate degrades to "slightly
 * stale" instead of "blank screen mid-lecture". The local stack has no
 * Realtime at all, so a pushed version could not be tested here either.
 */

/** Below this, an aggregate identifies individuals. */
const MIN_COHORT = LIVE_MIN_COHORT;

/*
 * Working now: a paper started OR answered in the last 20 minutes. Long enough
 * to survive a student reading a question, short enough that yesterday's
 * lecture is not still on the board. Until 29 Sep 2026 only the start counted,
 * so a student 25 minutes into a paper dropped out of the count.
 */
const ACTIVE_ATTEMPT = `
  a.status = 'in_progress'
  and (a.started_at > now() - interval '20 minutes'
       or exists (select 1 from responses r
                   where r.attempt_id = a.id
                     and r.answered_at > now() - interval '20 minutes'))`;

type Queryable = Pick<pg.PoolClient, "query"> | Db;

/** The one open question, in the words the projector may show. */
async function openSession(db: Queryable): Promise<LiveSession | null> {
  const { rows } = await db.query(
    `select s.id::text as id, s.started_at, i.slug, i.type::text as type, i.stage_id,
            st.title as stage_title, o.description as objective, sec.code as section,
            (select count(*)::int from live_responses r where r.session_id = s.id) as answered,
            (select count(*)::int from live_responses r
              where r.session_id = s.id and r.is_correct) as correct
       from live_sessions s
       join items i       on i.id = s.item_id
       join stages st     on st.id = i.stage_id
       left join objectives o on o.id = i.objective_id
       left join sections sec on sec.id = s.section_id
      where s.ended_at is null`,
  );
  const r = rows[0];
  if (!r) return null;
  const answered = Number(r.answered);
  return {
    id: r.id,
    itemSlug: r.slug,
    itemType: r.type,
    stageId: r.stage_id,
    stageTitle: r.stage_title,
    objective: r.objective ?? null,
    section: r.section ?? null,
    startedAt: new Date(r.started_at).toISOString(),
    answered,
    // With four answers, the split says how each of them did.
    correct: answered < MIN_COHORT ? null : Number(r.correct),
  };
}

const conflict = (message: string) => new AppError("conflict", message);

export function registerLiveRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/live
   *
   * What the room is doing right now, in aggregate. Also the projector's read.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/live", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const [active, perStage, session] = await Promise.all([
      app.db.query(`select count(distinct a.user_id)::int as n from attempts a where ${ACTIVE_ATTEMPT}`),
      // The whole class so far, by stage: every student's best mastery to date,
      // not only the people in the room. The page says so.
      app.db.query(
        `select sp.stage_id, st.title, count(*)::int as n,
                round(avg(sp.mastery) * 100)::int as avg_mastery
           from stage_progress sp
           join profiles p on p.id = sp.user_id and p.deleted_at is null and p.role = 'student'
           join stages st  on st.id = sp.stage_id
          group by sp.stage_id, st.title
          order by sp.stage_id`,
      ),
      openSession(app.db),
    ]);

    const body: LiveSnapshot = {
      cohort: Number(active.rows[0]?.n ?? 0),
      minCohort: MIN_COHORT,
      stages: perStage.rows.map((r) => {
        const students = Number(r.n);
        return {
          stageId: r.stage_id,
          title: r.title,
          students,
          // Four students on a stage and "05 · 90%" is each of their scores.
          avgMastery: students < MIN_COHORT ? null : Number(r.avg_mastery ?? 0),
        };
      }),
      session,
      at: new Date().toISOString(),
    };
    return reply.send(LiveSnapshot.parse(body));
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/live/options
   *
   * What a question can be started with: LIVE items only (an item at draft or
   * review has not been approved for any student), and the sections.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/live/options", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const [items, sections] = await Promise.all([
      app.db.query(
        `select i.id::text as id, i.slug, i.type::text as type, i.stage_id,
                st.title as stage_title, o.description as objective
           from items i
           join stages st on st.id = i.stage_id
           left join objectives o on o.id = i.objective_id
          where i.status = 'live'
          order by i.stage_id, i.slug`,
      ),
      app.db.query(`select id::text as id, code from sections order by code`),
    ]);
    const body: LiveOptions = {
      items: items.rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        type: r.type,
        stageId: r.stage_id,
        stageTitle: r.stage_title,
        objective: r.objective ?? null,
      })),
      sections: sections.rows.map((r) => ({ id: r.id, code: r.code })),
    };
    return reply.send(LiveOptions.parse(body));
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/live/sessions
   *
   * Put one live item to the room. Audited with the actor and a reason: it
   * changes what students may answer.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/live/sessions", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const parsed = LiveStartBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("A question needs a live item, who may answer it, and a reason: say why, in a few words.");
    }
    const b = parsed.data;

    const session = await withTransaction(app.db, async (client) => {
      const item = await client.query(
        `select id::text as id, slug, status::text as status, stage_id from items where id = $1`,
        [b.itemId],
      );
      const it = item.rows[0];
      if (!it) throw errors.notFound("No such item.");
      if (it.status !== "live") {
        throw conflict(
          `Only a live item can be put to the room. ${it.slug} is at ${it.status}; an item reaches live on Items.`,
        );
      }

      let sectionCode: string | null = null;
      if (b.sectionId) {
        const sec = await client.query(`select code from sections where id = $1`, [b.sectionId]);
        if (!sec.rows[0]) throw errors.notFound("No such section.");
        sectionCode = sec.rows[0].code as string;
      }

      const running = await openSession(client);
      if (running) {
        throw conflict(`A question is already running (${running.itemSlug}). End it before starting another.`);
      }

      let sessionId: string;
      try {
        const ins = await client.query(
          `insert into live_sessions (item_id, section_id, started_by)
           values ($1, $2, $3) returning id::text as id`,
          [b.itemId, b.sectionId, id!.userId],
        );
        sessionId = ins.rows[0].id as string;
      } catch (e) {
        // Two teachers pressing Start in the same second: the index decides.
        if ((e as { code?: string }).code === "23505") {
          throw conflict("A question was started a moment ago. End it before starting another.");
        }
        throw e;
      }

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'live.start', 'item', $2, $3)`,
        [
          id!.userId,
          it.id,
          JSON.stringify({
            sessionId,
            slug: it.slug,
            stageId: it.stage_id,
            sectionId: b.sectionId,
            section: sectionCode,
            reason: b.reason,
          }),
        ],
      );
      return openSession(client);
    });

    return reply.status(201).send({ session });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/live/sessions/:id/end
   *
   * An ended session is a record: the database refuses any later change.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/live/sessions/:id/end", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const sessionId = (req.params as { id: string }).id;
    if (!z.string().uuid().safeParse(sessionId).success) throw errors.notFound("No such question.");
    const parsed = LiveEndBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Say why you are ending it, in a few words.");

    const endedAt = await withTransaction(app.db, async (client) => {
      const cur = await client.query(
        `select s.ended_at, s.item_id::text as item_id, i.slug,
                (select count(*)::int from live_responses r where r.session_id = s.id) as answered
           from live_sessions s join items i on i.id = s.item_id
          where s.id = $1
          for update of s`,
        [sessionId],
      );
      const s = cur.rows[0];
      if (!s) throw errors.notFound("No such question.");
      if (s.ended_at) throw conflict(`${s.slug} has already ended.`);

      const { rows } = await client.query(
        `update live_sessions set ended_at = clock_timestamp(), ended_by = $2
          where id = $1 returning ended_at`,
        [sessionId, id!.userId],
      );
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'live.end', 'item', $2, $3)`,
        [
          id!.userId,
          s.item_id,
          JSON.stringify({ sessionId, slug: s.slug, answered: Number(s.answered), reason: parsed.data.reason }),
        ],
      );
      return rows[0]!.ended_at as Date;
    });

    return reply.send({ ok: true, endedAt });
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
         (select count(*)::int from attempts a where ${ACTIVE_ATTEMPT})   as in_progress,
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
   * before -- otherwise the projector becomes a way to copy the room. The
   * question itself is not served here yet: that is `/app/live`'s half.
   * -------------------------------------------------------- */
  app.get("/api/v1/live", async (req, reply) => {
    const id = await identityFrom(req, env);
    if (!id) throw errors.unauthorized("Sign in first.");

    const { rows } = await app.db.query(
      `select count(distinct a.user_id)::int as cohort from attempts a where ${ACTIVE_ATTEMPT}`,
    );
    const cohort = Number(rows[0]?.cohort ?? 0);

    return reply.send({
      cohort,
      suppressed: cohort < MIN_COHORT,
      minCohort: MIN_COHORT,
    });
  });
}
