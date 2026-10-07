import type { FastifyInstance } from "fastify";
import { MoonAddBody, MoonPendingBody, MoonsPublishBody } from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { assertMayApprove } from "../approval.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";
import {
  DryRun, MOON_ID, addMoon, discardPending, getMoons, publishMoons, removeDraft, savePending,
} from "../moons.js";

/**
 * The Studio's moons, server side (docs/STUDIO-EDITOR-PLAN.md "E2 -- the moons
 * plan"; instructor approval, 8 Oct 2026). A moon is an objective: a teacher may
 * edit its wording, add one as a DRAFT the lock does not count, and RETIRE one;
 * its evidence stays.
 *
 *   GET    /console/content/:stageId/moons           every moon of a chapter, with its pending change
 *   POST   /console/content/:stageId/moons           add a moon (a draft)
 *   PUT    /console/content/moons/:id/pending        save an edit or a retirement, naming the version loaded
 *   DELETE /console/content/moons/:id/pending        discard it
 *   DELETE /console/content/moons/:id                delete a never-used draft
 *   POST   /console/content/:stageId/moons/publish   put the named moons live (dryRun: say who would see a planet close)
 *
 * Typing is free for any staff member: nothing here changes what a student
 * reads. Publishing needs a teacher of the subject or the admin (the database's
 * `approval_verdict`), and a teacher may publish their own typed edit.
 */

const STAGE_ID = /^\d{2}$/;

function stageOf(req: { params: unknown }): string {
  const stageId = (req.params as { stageId: string }).stageId;
  if (!STAGE_ID.test(stageId)) throw errors.notFound("No such stage.");
  return stageId;
}
function moonOf(req: { params: unknown }): string {
  const id = (req.params as { id: string }).id;
  if (!MOON_ID.test(id)) throw errors.notFound("No such moon.");
  return id;
}

export function registerMoonRoutes(app: FastifyInstance, env: Env): void {
  app.get("/api/v1/console/content/:stageId/moons", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    return reply.send(await getMoons(app.db, stageOf(req)));
  });

  app.post("/api/v1/console/content/:stageId/moons", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = stageOf(req);
    const parsed = MoonAddBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("A moon needs a sentence of at least a few words, a bloom level, a level from 0 to 6 and read, trace or build.");
    }
    const made = await withTransaction(app.db, (client) => addMoon(client, stageId, id.userId, parsed.data));
    return reply.send({ ok: true, ...made });
  });

  app.put("/api/v1/console/content/moons/:id/pending", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const moonId = moonOf(req);
    const parsed = MoonPendingBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("Saving a change to a moon needs the version you opened and either its new wording, level, competency and bloom level, or a retirement.");
    }
    const saved = await withTransaction(app.db, (client) => savePending(client, moonId, id.userId, parsed.data));
    return reply.send({ ok: true, ...saved });
  });

  app.delete("/api/v1/console/content/moons/:id/pending", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const moonId = moonOf(req);
    const gone = await withTransaction(app.db, (client) => discardPending(client, moonId, id.userId));
    return reply.send({ ok: true, ...gone });
  });

  app.delete("/api/v1/console/content/moons/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const moonId = moonOf(req);
    await withTransaction(app.db, (client) => removeDraft(client, moonId, id.userId));
    return reply.send({ ok: true });
  });

  app.post("/api/v1/console/content/:stageId/moons/publish", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = stageOf(req);
    const parsed = MoonsPublishBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Publishing names the moons, the state you read, and says in a few words what changed.");
    try {
      const result = await withTransaction(app.db, (client) =>
        // A typed change has no author but its editor, who may publish it; the AI's (E3) will keep the author rule.
        publishMoons(client, stageId, id.userId, parsed.data, () => assertMayApprove(client, id, null, stageId)),
      );
      return reply.send(result);
    } catch (e) {
      if (e instanceof DryRun) return reply.send(e.result);
      // The database's own check, if it ever answers before the route's does: still a sentence.
      if ((e as { code?: string })?.code === "23514" && /may not approve/.test((e as Error).message)) {
        throw errors.forbidden("Only a teacher of CPE 412 or the admin approves its content.");
      }
      throw e;
    }
  });
}
