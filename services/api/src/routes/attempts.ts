import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AttemptEventBody, SubmitBody } from "@octa/contracts";
import { identityFrom, requireOwnerOrStaff } from "../auth.js";
import { errors } from "../errors.js";
import { BlueprintUnsatisfiable } from "../engine/blueprint.js";
import {
  startAttempt,
  loadAttempt,
  loadRecordedAnswers,
  loadResolvedPaper,
  recordAnswer,
} from "../repo/engine-repo.js";
import {
  toStudentAnswer,
  toStudentPaper,
  toStudentRecorded,
  toStudentVerdict,
} from "../serialize/student.js";
import { loadItemFigures } from "../repo/figures-repo.js";
import type { Env } from "../env.js";
import { finishAttempt, recordAutoSubmit, submitLeftPapers } from "../sitting.js";

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

      // Ruling 4: a paper the student left is submitted before anything is
      // resumed or started, so a reload never reopens one.
      await submitLeftPapers(app.db, id.userId);

      try {
        const { attempt, items, resumed } = await startAttempt(app.db, {
          userId: id.userId,
          studentId: id.studentId,
          assessmentId: body.data.assessmentId,
          engineVersion: env.ENGINE_VERSION,
        });

        // A resumed paper restores what the student already recorded (instructor
        // ruling, 29 Sep 2026): their own answers, and the verdicts they were
        // already shown -- on a stage check only; a final withholds them.
        const recorded = resumed ? await loadRecordedAnswers(app.db, attempt.attemptId) : [];

        return reply.send({
          attemptId: attempt.attemptId,
          attemptNo: attempt.attemptNo,
          resumed,
          totalItems: items.length,
          // The ONE serializer. Never `items` directly.
          items: toStudentPaper(items, await loadItemFigures(app.db, items.map((i) => i.itemId))),
          answered: toStudentRecorded(items, recorded, attempt.blueprintScope !== "final"),
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
          alreadyAnswered: outcome.alreadyAnswered,
          answer: toStudentAnswer(outcome.recordedAnswer),
        });
      }

      return reply.send({
        recorded: true,
        alreadyAnswered: outcome.alreadyAnswered,
        // The answer that COUNTS, which after a repeat is not the one just sent.
        answer: toStudentAnswer(outcome.recordedAnswer),
        // Spread last: the verdict carries its own `ordinal`, and it is the
        // authoritative one because it came from the resolved item.
        ...toStudentVerdict(outcome.item, outcome.result),
      });
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/attempts/:id/events
   *
   * The student left the paper (full screen, or the page), or came back
   * (instructor ruling 3, 30 Sep 2026). OWNER ONLY: staff may read a sitting,
   * never write one, and nobody records a leave for someone else. Only while
   * the attempt is in progress: after submit there is nothing to leave.
   * The time is the server's. attempt_events is append-only.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/attempts/:id/events",
    { config: { rateLimit: { max: 60 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      const attemptId = (req.params as { id: string }).id;
      if (!z.string().uuid().safeParse(attemptId).success) {
        throw errors.notFound("That does not exist, or you cannot see it.");
      }
      const body = AttemptEventBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest("That event could not be read.");

      const attempt = await loadAttempt(app.db, attemptId);
      // Not found for anyone but the owner, staff included: "forbidden" would
      // confirm the attempt exists to a student probing for ids.
      if (!attempt || attempt.userId !== id.userId) {
        throw errors.notFound("That does not exist, or you cannot see it.");
      }
      if (attempt.status !== "in_progress") {
        throw errors.conflict("That paper is no longer open.");
      }

      await app.db.query("insert into attempt_events (attempt_id, kind) values ($1, $2)", [
        attemptId,
        body.data.kind,
      ]);
      return reply.status(201).send({ recorded: true });
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

    const body = SubmitBody.safeParse(req.body ?? {});
    if (!body.success) throw errors.badRequest("That submit could not be read.");

    // Mastery feeds is_stage_unlocked() (stage checks only): finishAttempt.
    const { result } = await finishAttempt(app.db, attempt);
    // Ruling 4: the page handed it in because the student left. Only the
    // student's own paper, and only the first time.
    if (body.data.left && !result.alreadySubmitted && attempt.userId === id.userId) {
      await app.db.query("insert into attempt_events (attempt_id, kind) values ($1, $2)", [attemptId, body.data.left]);
      await recordAutoSubmit(app.db, attemptId);
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

    const recorded = await loadRecordedAnswers(app.db, attemptId);

    return reply.send({
      attemptId,
      status: attempt.status,
      totalItems: items.length,
      answeredOrdinals: recorded.map((r) => r.ordinal),
      items: toStudentPaper(items, await loadItemFigures(app.db, items.map((i) => i.itemId))),
      // The student's own answers, so a paper handed in by a reload can show
      // "You answered" beside each question (ruling 4). Verdicts follow the
      // resume rule: a final withholds them until it is submitted.
      answered: toStudentRecorded(
        items,
        recorded,
        attempt.status === "submitted" || attempt.blueprintScope !== "final",
      ),
    });
  });
}
