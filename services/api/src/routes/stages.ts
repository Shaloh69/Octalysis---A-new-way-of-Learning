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
  objectives: Array<{ id: string; level: number | null; description: string }> | null;
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
                                                     'description', o.description)
                                  order by o.id),
                        '[]'::jsonb)
                 from objectives o where o.stage_id = s.id) as objectives
         from stages s
         left join stage_progress sp on sp.user_id = $1 and sp.stage_id = s.id
        where s.published or $2
        order by s.ordinal`,
      [id.userId, staff],
    );

    const masteryOf = new Map(rows.map((r) => [r.id, Number(r.mastery ?? 0)]));

    const nodes = rows.map((r) => {
      const mastery = Number(r.mastery ?? 0);
      const unlocked = r.unlocked;

      let state: "locked" | "available" | "in_progress" | "mastered";
      if (!unlocked) state = "locked";
      else if (mastery >= MASTERY_THRESHOLD) state = "mastered";
      else if (mastery > 0) state = "in_progress";
      else state = "available";

      // The lock REASON is authored here, with the distance, because
      // DESIGN-MANDATE 1 requires every lock to say why and how far off.
      let lockReason: {
        kind: string;
        blockingStages: string[];
        requiredMastery?: number;
        currentMastery?: number;
        message: string;
      } | null = null;

      if (state === "locked") {
        const short = r.prereq.filter((p) => (masteryOf.get(p) ?? 0) < MASTERY_THRESHOLD);
        if (short.length > 0) {
          const worst = short
            .map((p) => ({ id: p, m: masteryOf.get(p) ?? 0 }))
            .sort((a, b) => a.m - b.m)[0]!;
          const title = rows.find((x) => x.id === worst.id)?.title ?? `Stage ${worst.id}`;
          lockReason = {
            kind: "prereq",
            blockingStages: short,
            requiredMastery: MASTERY_THRESHOLD,
            currentMastery: worst.m,
            message:
              `Unlocks when Stage ${worst.id} (${title}) reaches ` +
              `${Math.round(MASTERY_THRESHOLD * 100)}%. You're at ${Math.round(worst.m * 100)}%.`,
          };
        } else {
          // Prerequisites are met, so a teacher override or a lock window is
          // holding it. The student does not need the mechanism, only the fact.
          lockReason = {
            kind: "override",
            blockingStages: [],
            message: "Your instructor has this stage closed right now.",
          };
        }
      }

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
        objectives: (r.objectives ?? [])
          .filter((o): o is { id: string; level: number; description: string } =>
            o.level !== null),
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
      `select id, code, bloom_level, level, competency, description
         from objectives where stage_id = $1 order by id`,
      [stageId],
    );

    // A locked stage returns its shape -- title, objectives, why it is locked --
    // but NOT its content. The read-only preview of what is next is deliberate
    // (Petal 6: scarcity that still respects autonomy); the prose is not.
    if (!stage.unlocked && !staff) {
      return reply.send({
        id: stage.id,
        title: stage.title,
        archetype: stage.archetype,
        levels: stage.levels ?? [],
        estMinutes: stage.est_minutes,
        locked: true,
        objectives: objectives.rows.map((o) => ({
          id: o.id,
          description: o.description,
          bloom: o.bloom_level,
        })),
        blocks: [],
      });
    }

    const blocks = await app.db.query(
      `select ordinal, kind, body_md, meta, version
         from content_blocks where stage_id = $1 order by ordinal`,
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
      locked: false,
      mastery: Number(Number(stage.mastery ?? 0).toFixed(3)),
      objectives: objectives.rows.map((o) => ({
        id: o.id,
        description: o.description,
        bloom: o.bloom_level,
        level: o.level,
        competency: o.competency,
      })),
      blocks: blocks.rows.map((b) => ({
        ordinal: Number(b.ordinal),
        kind: b.kind,
        body: b.body_md,
        meta: b.meta ?? {},
        version: Number(b.version),
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
