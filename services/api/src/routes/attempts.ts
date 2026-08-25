import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireOwnerOrStaff } from "../auth.js";
import { errors } from "../errors.js";
import { BlueprintUnsatisfiable } from "../engine/blueprint.js";
import {
  startAttempt,
  loadAttempt,
  loadResolvedPaper,
  recordAnswer,
  submitAttempt,
  updateStageProgress,
} from "../repo/engine-repo.js";
import { toStudentPaper, toStudentVerdict } from "../serialize/student.js";
import type { Env } from "../env.js";

/**
 * The three attempt endpoints.
 *
 * EVERY response body on this router goes through `serialize/student.ts`. There
 * is no route here that returns a `ResolvedItem` directly, and there must never
 * be one -- ad hoc stripping per endpoint is how a leak gets shipped.
 */

const StartBody = z.object({ assessmentId: z.string().uuid() });

const AnswerBody = z.object({
  ordinal: z.number().int().positive(),
  answer: z.union([
    z.object({ index: z.number().int().nonnegative() }),
    z.object({ value: z.union([z.string(), z.number()]) }),
    z.object({ order: z.array(z.string()) }),
  ]),
  timeMs: z.number().int().nonnegative().optional(),
});

export function registerAttemptRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * POST /api/v1/attempts
   * Start (or resume) an attempt. Returns the paper, key stripped.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/attempts",
    { config: { rateLimit: { max: 10 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      const body = StartBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest("An assessment id is required.");

      if (!id.studentId) {
        throw errors.forbidden("Your account is not linked to a student ID.");
      }

      try {
        const { attempt, items, resumed } = await startAttempt(app.db, {
          userId: id.userId,
          studentId: id.studentId,
          assessmentId: body.data.assessmentId,
          engineVersion: env.ENGINE_VERSION,
        });

        return reply.send({
          attemptId: attempt.attemptId,
          attemptNo: attempt.attemptNo,
          resumed,
          totalItems: items.length,
          // The ONE serializer. Never `items` directly.
          items: toStudentPaper(items),
        });
      } catch (err) {
        if (err instanceof BlueprintUnsatisfiable) {
          // The student must not see bank internals, but the log must.
          req.log.error({ err: err.message }, "blueprint unsatisfiable");
          throw errors.internal(err.message);
        }
        throw err;
      }
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/attempts/:id/answer
   * Grade one answer server-side.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/attempts/:id/answer",
    { config: { rateLimit: { max: 120 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      const attemptId = (req.params as { id: string }).id;

      const body = AnswerBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest("That answer could not be read.");

      const attempt = await loadAttempt(app.db, attemptId);
      if (!attempt) throw errors.notFound("That does not exist, or you cannot see it.");
      requireOwnerOrStaff(id, attempt.userId);

      const outcome = await recordAnswer(app.db, {
        attempt,
        ordinal: body.data.ordinal,
        rawAnswer: body.data.answer,
        ...(body.data.timeMs !== undefined ? { timeMs: body.data.timeMs } : {}),
      });

      // On a final-scope assessment the verdict is withheld until submit, so a
      // running score is not queryable mid-exam. `rs_own` in db/schema.sql
      // enforces the same rule for direct database reads (V-22).
      if (!outcome.revealVerdict) {
        return reply.send({
          ordinal: body.data.ordinal,
          recorded: true,
          verdictWithheld: true,
        });
      }

      return reply.send({
        recorded: true,
        alreadyAnswered: outcome.alreadyAnswered,
        // Spread last: the verdict carries its own `ordinal`, and it is the
        // authoritative one because it came from the resolved item.
        ...toStudentVerdict(outcome.item, outcome.result),
      });
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/attempts/:id/submit
   * -------------------------------------------------------- */
  app.post("/api/v1/attempts/:id/submit", async (req, reply) => {
    const id = await identityFrom(req, env);
    const attemptId = (req.params as { id: string }).id;

    const attempt = await loadAttempt(app.db, attemptId);
    if (!attempt) throw errors.notFound("That does not exist, or you cannot see it.");
    requireOwnerOrStaff(id, attempt.userId);

    const result = await submitAttempt(app.db, attempt);

    // Mastery feeds is_stage_unlocked(). Only for stage-scope assessments --
    // the final does not unlock anything.
    if (attempt.blueprintScope === "stage" && result.items.length > 0 && !result.alreadySubmitted) {
      const stageId = result.items[0]!.stageId;
      await updateStageProgress(app.db, {
        userId: attempt.userId,
        stageId,
        mastery: result.mastery,
        score: result.score,
      });
    }

    return reply.send({
      attemptId,
      alreadySubmitted: result.alreadySubmitted,
      score: result.score,
      maxScore: result.maxScore,
      mastery: Number(result.mastery.toFixed(3)),
      byObjective: result.byObjective,
      // After submit the key is legitimately visible -- this is the review
      // screen, and `ai_after_submit` allows the same read at the DB level.
      review: result.items.map((item) =>
        toStudentVerdict(item, result.results.get(item.ordinal) ?? { isCorrect: false, points: 0 }),
      ),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/attempts/:id
   * Resume. Key stripped while in progress.
   * -------------------------------------------------------- */
  app.get("/api/v1/attempts/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    const attemptId = (req.params as { id: string }).id;

    const attempt = await loadAttempt(app.db, attemptId);
    if (!attempt) throw errors.notFound("That does not exist, or you cannot see it.");
    requireOwnerOrStaff(id, attempt.userId);

    const items = await loadResolvedPaper(
      app.db,
      attempt.attemptId,
      attempt.seed,
      attempt.engineVersion,
    );

    const { rows: answered } = await app.db.query(
      "select ordinal from responses where attempt_id = $1 order by ordinal",
      [attemptId],
    );

    return reply.send({
      attemptId,
      status: attempt.status,
      totalItems: items.length,
      answeredOrdinals: answered.map((r) => Number(r.ordinal)),
      items: toStudentPaper(items),
    });
  });
}
