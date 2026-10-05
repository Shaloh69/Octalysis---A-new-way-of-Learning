import type { FastifyInstance } from "fastify";
import { identityFrom, isStaff } from "../auth.js";
import { errors } from "../errors.js";
import type { Env } from "../env.js";

/**
 * The stage map and the stage reader.
 *
 * Hard rule 4: the client RENDERS a lock, it never COMPUTES one. Every node's
 * state on this route comes from `is_stage_unlocked()`, and every locked node
 * carries a reason and a distance authored here, server-side.
 *
 * The map is also not a second source of truth for the curriculum. Nodes and
 * edges come from `stages` and `stages.prereq` -- the same rows the lock
 * function reads. If the map and the database ever disagree, the map is wrong.
 */

const MASTERY_THRESHOLD = 0.7;

interface StageRow {
  id: string;
  act: number;
  ordinal: number;
  title: string;
  summary: string | null;
  est_minutes: number;
  prereq: string[];
  published: boolean;
  gradeable: boolean;
  archetype: string;
  levels: number[];
  mastery: string | null;
  unlocked: boolean;
  block_count: number;
  /**
   * Each objective's id and Computer Level Hierarchy level, for the solar
   * system's layout (docs/redesign/SOLAR-SYSTEM-SPEC.md 1.1: a planet's orbit
   * ring is the mean of its own moons' levels, and a moon is one objective).
   *
   * RLS: `ob_read` lets an authenticated user read objectives of any PUBLISHED
   * stage -- unlocked is deliberately not required, which is why a locked stage
   * can already show its objectives on /api/v1/stages/:id and why
   * PAGE-SPECS 2 can promise a preview of the next locked stage's objectives.
   * This query filters to the same published set, so it exposes nothing the
   * per-stage route did not already. No description text is selected: the map
   * needs the shape, not the content.
   */
  objectives: Array<Moon & { level: number | null; description: string }> | null;
}

/**
 * A moon's mastery (WEB-REVAMP 3.7a): `correct` is the distinct questions of it
 * answered right in attempts that count, `mastered` is the database's verdict
 * (`moon_mastered()`, 2 of them), and `questions` its live questions: 0 means
 * it cannot be mastered yet (fail-closed). All three come from the database;
 * the client prints them and never recomputes one.
 */
interface Moon {
  id: string;
  correct: number;
  mastered: boolean;
  questions: number;
}

/** The objective's own live questions, counted per question across versions (V-3). */
const MOON_SQL = `'correct', moon_correct($1, o.id),
                  'mastered', moon_mastered($1, o.id),
                  'questions', (select count(distinct i.family_id)::int from items i
                                 where i.objective_id = o.id and i.status = 'live')`;

type StageState = "locked" | "available" | "in_progress" | "mastered";

interface LockReason {
  kind: string;
  blockingStages: string[];
  /*
   * The distance (DESIGN-MANDATE 1), in moons since 30 Sep 2026 (WEB-REVAMP
   * 3.7a): the blocking planet's moons mastered of its total, the ones still to
   * master, and which of those have no questions yet (fail-closed).
   */
  moonsMastered?: number;
  moonsTotal?: number;
  missingMoons?: string[];
  unwrittenMoons?: string[];
  message: string;
}

/** Objectives in the syllabus's order: 06.1, 06.2 ... 06.10. */
function byObjective(a: { id: string }, b: { id: string }): number {
  const [sa, oa] = a.id.split(".").map(Number);
  const [sb, ob] = b.id.split(".").map(Number);
  return (sa ?? 0) - (sb ?? 0) || (oa ?? 0) - (ob ?? 0);
}

/** "01.3", "01.3 and 01.5", "01.2, 01.3 and 01.5". */
function inWords(ids: string[]): string {
  return ids.length <= 1 ? (ids[0] ?? "") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

function stateOf(unlocked: boolean, mastery: number): StageState {
  if (!unlocked) return "locked";
  if (mastery >= MASTERY_THRESHOLD) return "mastered";
  if (mastery > 0) return "in_progress";
  return "available";
}

/**
 * The lock REASON, authored here with the distance, because DESIGN-MANDATE 1
 * requires every lock to say why and how far off. ONE author for the map and
 * the reader (29 Sep 2026): the reader's lock card prints this verbatim, and a
 * second wording of the same fact would drift from the first.
 *
 * Since 30 Sep 2026 a planet opens when every moon of its gradeable
 * prerequisites is mastered (`is_stage_unlocked()`, WEB-REVAMP 3.7a), so the
 * reason names the moons still missing, and says which have no questions yet:
 * those hold the planet shut until they are written (fail-closed).
 *
 * `prereq` must already be the GRADEABLE prerequisites only, the ones
 * `is_stage_unlocked()` counts (WEB-REVAMP 3.7). `moonsOf` returns a planet's
 * moons with the database's own verdicts; nothing here recounts one.
 */
function lockReasonFor(
  prereq: string[],
  moonsOf: (id: string) => Moon[],
  titleOf: (id: string) => string | undefined,
): LockReason {
  const short = prereq.filter((p) => {
    const moons = moonsOf(p);
    return moons.length === 0 || moons.some((m) => !m.mastered);
  });
  if (short.length > 0) {
    // The planet furthest from open: the smallest share of its moons mastered.
    const worst = short
      .map((id) => {
        const moons = [...moonsOf(id)].sort(byObjective);
        const done = moons.filter((m) => m.mastered).length;
        return { id, moons, done, share: moons.length ? done / moons.length : 0 };
      })
      .sort((a, b) => a.share - b.share || a.id.localeCompare(b.id))[0]!;
    const title = titleOf(worst.id) ?? `Stage ${worst.id}`;

    if (worst.moons.length === 0) {
      return {
        kind: "prereq",
        blockingStages: short,
        moonsMastered: 0,
        moonsTotal: 0,
        missingMoons: [],
        unwrittenMoons: [],
        message: `Unlocks when Stage ${worst.id} (${title}) has its moons: none are published yet.`,
      };
    }

    const missing = worst.moons.filter((m) => !m.mastered);
    const unwritten = missing.filter((m) => m.questions === 0).map((m) => m.id);
    let message =
      `Unlocks when every moon of Stage ${worst.id} (${title}) is mastered: ` +
      `${worst.done} of ${worst.moons.length} are. Still to master: ${missing.map((m) => m.id).join(", ")}.`;
    if (unwritten.length > 0) {
      message += ` ${inWords(unwritten)} ${unwritten.length === 1 ? "has" : "have"} no questions yet.`;
    }
    return {
      kind: "prereq",
      blockingStages: short,
      moonsMastered: worst.done,
      moonsTotal: worst.moons.length,
      missingMoons: missing.map((m) => m.id),
      unwrittenMoons: unwritten,
      message,
    };
  }
  // Prerequisites are met, so a teacher override or a lock window is holding
  // it. The student does not need the mechanism, only the fact.
  return {
    kind: "override",
    blockingStages: [],
    message: "Your instructor has this stage closed right now.",
  };
}

export function registerStageRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/stages   -- the whole map, resolved for this student
   * -------------------------------------------------------- */
  app.get("/api/v1/stages", async (req, reply) => {
    const id = await identityFrom(req, env);
    const staff = isStaff(id);

    const { rows } = await app.db.query<StageRow>(
      `select s.id, s.act, s.ordinal, s.title, s.summary, s.est_minutes,
              s.prereq, s.published, s.gradeable, s.archetype, s.levels,
              sp.mastery,
              is_stage_unlocked($1, s.id) as unlocked,
              (select count(*)::int from content_blocks cb where cb.stage_id = s.id) as block_count,
              (select coalesce(
                        jsonb_agg(jsonb_build_object('id', o.id, 'level', o.level,
                                                     'description', o.description,
                                                     ${MOON_SQL})
                                  order by o.id),
                        '[]'::jsonb)
                 from objectives o where o.stage_id = s.id) as objectives
         from stages s
         left join stage_progress sp on sp.user_id = $1 and sp.stage_id = s.id
        where s.published or $2
        order by s.ordinal`,
      [id.userId, staff],
    );

    const moonsOf = new Map(
      rows.map((r) => [
        r.id,
        (r.objectives ?? []).map((o) => ({
          id: o.id,
          correct: Number(o.correct),
          mastered: o.mastered === true,
          questions: Number(o.questions),
        })),
      ]),
    );
    const gradeable = new Map(rows.map((r) => [r.id, r.gradeable]));

    const nodes = rows.map((r) => {
      const mastery = Number(r.mastery ?? 0);
      const state = stateOf(r.unlocked, mastery);
      const lockReason =
        state === "locked"
          ? lockReasonFor(
              (r.prereq ?? []).filter((p) => gradeable.get(p) !== false),
              (p) => moonsOf.get(p) ?? [],
              (p) => rows.find((x) => x.id === p)?.title,
            )
          : null;

      const moons = (r.objectives ?? []).filter((o) => o.level !== null);
      return {
        id: r.id,
        act: r.act,
        ordinal: r.ordinal,
        title: r.title,
        summary: r.summary,
        estMinutes: r.est_minutes,
        archetype: r.archetype,
        levels: r.levels ?? [],
        gradeable: r.gradeable,
        published: r.published,
        prereq: r.prereq ?? [],
        blockCount: r.block_count,
        /*
         * Id, ring AND the objective's own sentence.
         *
         * This used to be levels only, on the reasoning that "a moon needs an
         * identity and a ring; the objective's text arrives with the stage
         * itself". That was true while moons were decoration. §5's focused tier
         * made them SELECTION TARGETS, and a selection target with no name is
         * a row reading "05.1 L0" -- which is what the sidebar rendered six
         * times over before this.
         *
         * Not invented content: `objectives.description` is authored data
         * already in the database, which is exactly where hard rule 5 says
         * stage prose must come from. Nor is it newly exposed -- the per-stage
         * route already returns descriptions for a LOCKED stage on purpose
         * (the read-only preview of what is next), so the map payload showing
         * the same sentences reveals nothing that was being withheld.
         */
        objectives: moons,
        /*
         * "N of M subtopics mastered" (3.1 item 6): a planet's moons are its
         * objectives, on a GRADEABLE planet only. Orientation has none to master
         * (decided 25 Sep 2026: cosmetic asteroids instead), so null, not 0 of 5.
         */
        moons: r.gradeable
          ? { mastered: moons.filter((o) => o.mastered).length, total: moons.length }
          : null,
        state,
        mastery: Number(mastery.toFixed(3)),
        lockReason,
      };
    });

    // Edges derived from the SAME prereq arrays the lock function reads.
    const present = new Set(nodes.map((n) => n.id));
    const edges = nodes.flatMap((n) =>
      n.prereq.filter((p) => present.has(p)).map((from) => ({ from, to: n.id })),
    );

    return reply.send({ nodes, edges, generatedAt: new Date().toISOString() });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/stages/:id  -- the reader
   *
   * Content blocks are returned only when the stage is BOTH published and
   * unlocked. That is V-7: unlocked is not the same as published, and the
   * `cb_read` policy enforces the same pair at the database level.
   * -------------------------------------------------------- */
  app.get("/api/v1/stages/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    const stageId = (req.params as { id: string }).id;
    const staff = isStaff(id);

    const { rows } = await app.db.query(
      `select s.*, sp.mastery, is_stage_unlocked($1, s.id) as unlocked
         from stages s
         left join stage_progress sp on sp.user_id = $1 and sp.stage_id = s.id
        where s.id = $2`,
      [id.userId, stageId],
    );
    const stage = rows[0];
    if (!stage) throw errors.notFound("That stage does not exist.");
    if (!stage.published && !staff) throw errors.notFound("That stage does not exist.");

    const objectives = await app.db.query(
      `select o.id, o.code, o.bloom_level, o.level, o.competency, o.description,
              moon_correct($2, o.id) as correct, moon_mastered($2, o.id) as mastered,
              (select count(distinct i.family_id)::int from items i
                where i.objective_id = o.id and i.status = 'live') as questions
         from objectives o where o.stage_id = $1 order by o.id`,
      [stageId, id.userId],
    );
    const moonOf = (o: { correct: number; mastered: boolean; questions: number }) => ({
      correct: Number(o.correct),
      mastered: o.mastered === true,
      questions: Number(o.questions),
    });

    const mastery = Number(stage.mastery ?? 0);

    // A locked stage returns its shape -- title, objectives, why it is locked --
    // but NOT its content. The read-only preview of what is next is deliberate
    // (Petal 6: scarcity that still respects autonomy); the prose is not.
    if (!stage.unlocked && !staff) {
      // The prerequisites' masteries and titles, read exactly as the map reads
      // them (published stages only), so both routes print the same sentence.
      const prereq: string[] = stage.prereq ?? [];
      const pre = await app.db.query<{ id: string; title: string; gradeable: boolean }>(
        `select s.id, s.title, s.gradeable from stages s where s.id = any($1) and s.published`,
        [prereq],
      );
      const known = new Map(pre.rows.map((r) => [r.id, r]));
      // The prerequisites' moons, read exactly as the map reads them.
      const preMoons = await app.db.query<{ stage_id: string } & Moon>(
        `select o.stage_id, o.id, moon_correct($1, o.id) as correct, moon_mastered($1, o.id) as mastered,
                (select count(distinct i.family_id)::int from items i
                  where i.objective_id = o.id and i.status = 'live') as questions
           from objectives o where o.stage_id = any($2)`,
        [id.userId, prereq],
      );
      return reply.send({
        id: stage.id,
        title: stage.title,
        archetype: stage.archetype,
        levels: stage.levels ?? [],
        estMinutes: stage.est_minutes,
        gradeable: stage.gradeable,
        locked: true,
        state: "locked" satisfies StageState,
        masteryThreshold: MASTERY_THRESHOLD,
        lockReason: lockReasonFor(
          prereq.filter((p) => known.get(p)?.gradeable !== false),
          (p) =>
            preMoons.rows
              .filter((m) => m.stage_id === p)
              .map((m) => ({ id: m.id, correct: Number(m.correct), mastered: m.mastered === true, questions: Number(m.questions) })),
          (p) => known.get(p)?.title,
        ),
        objectives: objectives.rows.map((o) => ({
          id: o.id,
          description: o.description,
          bloom: o.bloom_level,
          ...moonOf(o),
        })),
        blocks: [],
      });
    }

    // A figure block carries its drawing, and only the APPROVED one
    // (docs/FIGURES-AND-AUDIO.md). A figure nobody has approved is left out
    // whole, caption included: a caption under an empty frame teaches nothing.
    const blocks = await app.db.query(
      `select cb.ordinal, cb.kind, cb.body_md, cb.meta, cb.version,
              f.id as figure_id, f.title as figure_title, f.approved_svg as figure_svg
         from content_blocks cb
         left join figures f on cb.kind = 'figure' and f.id = cb.meta->>'id'
        where cb.stage_id = $1
          and (cb.kind <> 'figure' or f.approved_svg is not null)
        order by cb.ordinal`,
      [stageId],
    );

    /*
     * The stage's check, if it has one.
     *
     * A stage assessment is an `assessments` row whose blueprint is scoped to
     * this stage. Without this the reader had no assessment id to start, so the
     * question engine -- the longest thing in the project to build -- had no
     * way in from the student app at all.
     *
     * Scoped to the student's own section, or to a section-less assessment that
     * applies to everyone. `attempts_allowed` comes back so the reader can say
     * how many tries remain rather than discovering it on a rejected POST.
     */
    const assessment = await app.db.query(
      `select a.id, a.title, a.attempts_allowed, a.opens_at, a.closes_at,
              (select count(*)::int from attempts at
                where at.assessment_id = a.id and at.user_id = $2) as used
         from assessments a
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'stage' and b.stage_id = $1
          and (a.section_id is null or a.section_id = (
                select section_id from profiles where id = $2))
        order by a.created_at desc
        limit 1`,
      [stageId, id?.userId ?? null],
    );
    const a0 = assessment.rows[0];

    return reply.send({
      id: stage.id,
      title: stage.title,
      summary: stage.summary,
      archetype: stage.archetype,
      levels: stage.levels ?? [],
      estMinutes: stage.est_minutes,
      gradeable: stage.gradeable,
      locked: false,
      // Staff read a locked stage's content too; its state still says locked.
      state: stateOf(stage.unlocked, mastery),
      masteryThreshold: MASTERY_THRESHOLD,
      lockReason: null,
      mastery: Number(mastery.toFixed(3)),
      objectives: objectives.rows.map((o) => ({
        id: o.id,
        description: o.description,
        bloom: o.bloom_level,
        level: o.level,
        competency: o.competency,
        ...moonOf(o),
      })),
      blocks: blocks.rows.map((b) => ({
        ordinal: Number(b.ordinal),
        kind: b.kind,
        body: b.body_md,
        meta: b.meta ?? {},
        version: Number(b.version),
        ...(b.kind === "figure"
          ? { figure: { id: b.figure_id as string, title: b.figure_title as string, svg: b.figure_svg as string } }
          : {}),
      })),
      assessment: a0
        ? {
            id: a0.id,
            title: a0.title,
            attemptsAllowed: Number(a0.attempts_allowed),
            attemptsUsed: Number(a0.used ?? 0),
            opensAt: a0.opens_at,
            closesAt: a0.closes_at,
          }
        : null,
    });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/stages/:id/read  -- an UNGRADED stage read to its end
   *
   * Instructor, 5 Oct 2026: "if orientation is done reading, automatically
   * mark it as mastered then move to the next stage". Orientation (00) is the
   * one ungraded stage: it has no questions, so reading it is the whole of it.
   * The server records it (the state a student sees is the database's) and
   * names the next stage by curriculum order. A graded stage is refused: its
   * mastery is its moons', and reading never stands in for them. Idempotent.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/stages/:id/read",
    { config: { rateLimit: { max: 20 * app.limitScale, timeWindow: "1 minute" } } },
    async (req) => {
      const id = await identityFrom(req, env);
      const stageId = (req.params as { id: string }).id;
      if (!/^\d{2}$/.test(stageId)) throw errors.notFound("That stage does not exist.");
      if (!id.studentId) throw errors.forbidden("Your account is not linked to a student ID.");

      const { rows } = await app.db.query<{ gradeable: boolean; published: boolean; unlocked: boolean; next: string | null }>(
        `select s.gradeable, s.published, is_stage_unlocked($1, s.id) as unlocked,
                (select n.id from stages n where n.published and n.ordinal > s.ordinal
                  order by n.ordinal limit 1) as next
           from stages s where s.id = $2`,
        [id.userId, stageId],
      );
      const stage = rows[0];
      if (!stage || !stage.published) throw errors.notFound("That stage does not exist.");
      if (!stage.unlocked) throw errors.forbidden("This stage is locked.");
      if (stage.gradeable) throw errors.conflict("A graded stage is mastered through its moons, not by reading it.");

      await app.db.query(
        `insert into stage_progress (user_id, stage_id, mastery, attempts, last_seen_at)
         values ($1, $2, 1, 0, now())
         on conflict (user_id, stage_id) do update set mastery = 1, last_seen_at = now()`,
        [id.userId, stageId],
      );
      return { stageId, state: "mastered" as const, next: stage.next };
    },
  );

  /* ----------------------------------------------------------
   * GET /api/v1/progress  -- the 7x3 competency grid + depth
   * -------------------------------------------------------- */
  app.get("/api/v1/progress", async (req, reply) => {
    const id = await identityFrom(req, env);

    const { rows } = await app.db.query(
      `select o.level, o.competency,
              avg(coalesce(sp.mastery, 0))::numeric(4,3) as mastery,
              count(*)::int as objectives
         from objectives o
         join stages s on s.id = o.stage_id
         left join stage_progress sp on sp.user_id = $1 and sp.stage_id = o.stage_id
        where o.level is not null and o.competency is not null and s.published
        group by o.level, o.competency`,
      [id.userId],
    );

    const grid: Array<{ level: number; competency: string; mastery: number; objectives: number }> = [];
    for (let level = 6; level >= 0; level--) {
      for (const competency of ["read", "trace", "build"]) {
        const hit = rows.find((r) => Number(r.level) === level && r.competency === competency);
        grid.push({
          level,
          competency,
          mastery: hit ? Number(hit.mastery) : 0,
          objectives: hit ? Number(hit.objectives) : 0,
        });
      }
    }

    // Depth is how far down the machine the student can currently SEE: the
    // lowest level they have any mastery at. It is not a score.
    const reached = grid.filter((g) => g.mastery > 0).map((g) => g.level);
    const depth = reached.length > 0 ? Math.min(...reached) : 6;

    return reply.send({ grid, depth, thresholdForMastery: MASTERY_THRESHOLD });
  });
}
