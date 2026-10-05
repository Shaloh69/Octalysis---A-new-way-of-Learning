import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom } from "../auth.js";
import { errors } from "../errors.js";
import { BlueprintUnsatisfiable } from "../engine/blueprint.js";
import { ensureJourney, loadRecordedAnswers, startAttempt } from "../repo/engine-repo.js";
import { toStudentPaper, toStudentRecorded } from "../serialize/student.js";
import { loadItemFigures } from "../repo/figures-repo.js";
import type { Env } from "../env.js";

/**
 * A moon's journey (WEB-REVAMP 3.2 item 5, 3.7a; instructor decisions 30 Sep 2026).
 *
 * Practice on one objective's own live questions. NOT a paper under hard rule
 * 9: no start prompt, no full screen, no leave recording, never graded. Its
 * correct answers count toward the moon (objective_progress), which is what
 * opens the next planet. Answering and submitting use the ordinary attempt
 * routes; this one only finds or begins the journey, and every body it returns
 * goes through the ONE serializer.
 *
 * Left midway, a journey resumes where it stopped, with the answers already
 * given; once submitted, the next entry is a new paper.
 */

const ObjectiveId = z.string().regex(/^\d{2}\.\d{1,2}$/);

export function registerJourneyRoutes(app: FastifyInstance, env: Env): void {
  app.post(
    "/api/v1/objectives/:id/journey",
    { config: { rateLimit: { max: 10 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      const parsed = ObjectiveId.safeParse((req.params as { id: string }).id);
      if (!parsed.success) throw errors.notFound("That moon does not exist.");
      const objectiveId = parsed.data;

      if (!id.studentId) {
        throw errors.forbidden("Your account is not linked to a student ID.");
      }

      // The lock is the database's to decide (hard rule 4): a moon is entered
      // only while its planet is open to this student.
      const { rows } = await app.db.query<{
        stage_id: string; published: boolean; unlocked: boolean; live: number;
      }>(
        `select o.stage_id, s.published, is_stage_unlocked($1, o.stage_id) as unlocked,
                (select count(*)::int from items i
                  where i.objective_id = o.id and i.status = 'live') as live
           from objectives o join stages s on s.id = o.stage_id
          where o.id = $2`,
        [id.userId, objectiveId],
      );
      const moon = rows[0];
      if (!moon || !moon.published) throw errors.notFound("That moon does not exist.");
      if (!moon.unlocked) throw errors.forbidden("This moon's planet is locked.");
      // Fail-closed (3.7a): nothing to practise, and nothing is created for it.
      if (moon.live === 0) throw errors.conflict("This moon has no questions yet.");

      const assessmentId = await ensureJourney(app.db, {
        objectiveId,
        stageId: moon.stage_id,
        liveQuestions: moon.live,
        saltSecret: env.EXAM_SALT_SECRET,
      });

      try {
        const { attempt, items, resumed } = await startAttempt(app.db, {
          userId: id.userId,
          studentId: id.studentId,
          assessmentId,
          engineVersion: env.ENGINE_VERSION,
        });
        const recorded = resumed ? await loadRecordedAnswers(app.db, attempt.attemptId) : [];
        return reply.send({
          objectiveId,
          attemptId: attempt.attemptId,
          attemptNo: attempt.attemptNo,
          resumed,
          totalItems: items.length,
          // The ONE serializer. Never `items` directly.
          items: toStudentPaper(items, await loadItemFigures(app.db, items.map((i) => i.itemId))),
          answered: toStudentRecorded(items, recorded, true),
        });
      } catch (err) {
        if (err instanceof BlueprintUnsatisfiable) {
          req.log.error({ err: err.message }, "journey unsatisfiable");
          throw errors.internal(err.message);
        }
        throw err;
      }
    },
  );
}
