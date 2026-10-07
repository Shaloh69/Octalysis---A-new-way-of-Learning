import type { FastifyInstance } from "fastify";
import { WorkingCopyPublishBody, WorkingCopyPutBody } from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { assertMayApprove } from "../approval.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";
import { discardWorkingCopy, getWorkingCopy, publishWorkingCopy, saveWorkingCopy } from "../working-copy.js";

/**
 * The Studio's editor, server side (docs/STUDIO-EDITOR-PLAN.md; instructor
 * rulings, 8 Oct 2026): a chapter's WORKING COPY, saved as a draft students
 * never see, and Publish.
 *
 *   GET    /console/content/:stageId/working    the draft, or the live chapter when nothing is unpublished
 *   PUT    /console/content/:stageId/working    save the whole chapter as typed (autosave), naming the version loaded
 *   DELETE /console/content/:stageId/working    discard unpublished typing
 *   POST   /console/content/:stageId/publish    put it live: of the draft read (its hash), with a reason
 *
 * Typing is free for any teacher: nothing here changes what a student reads.
 * Publishing needs a teacher of the subject or the admin (the database's
 * `approval_verdict`), and a teacher may publish their own typed edit.
 */

const STAGE_ID = /^\d{2}$/;

function stageOf(req: { params: unknown }): string {
  const stageId = (req.params as { stageId: string }).stageId;
  if (!STAGE_ID.test(stageId)) throw errors.notFound("No such stage.");
  return stageId;
}

export function registerWorkingCopyRoutes(app: FastifyInstance, env: Env): void {
  app.get("/api/v1/console/content/:stageId/working", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    return reply.send(await getWorkingCopy(app.db, stageOf(req)));
  });

  app.put("/api/v1/console/content/:stageId/working", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = stageOf(req);
    const parsed = WorkingCopyPutBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest(
        "A save needs the version you opened and at least one topic, each a prose, brief, callout, code, quote or figure topic.",
      );
    }
    const saved = await withTransaction(app.db, (client) => saveWorkingCopy(client, stageId, id.userId, parsed.data));
    return reply.send({ ok: true, ...saved, savedAt: new Date().toISOString() });
  });

  app.delete("/api/v1/console/content/:stageId/working", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = stageOf(req);
    const gone = await withTransaction(app.db, async (client) => {
      const r = await discardWorkingCopy(client, stageId);
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload) values ($1, 'chapter.discard', 'stage', $2, $3)`,
        [id.userId, stageId, JSON.stringify(r)],
      );
      return r;
    });
    return reply.send({ ok: true, ...gone });
  });

  app.post("/api/v1/console/content/:stageId/publish", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = stageOf(req);
    const parsed = WorkingCopyPublishBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Publishing names the draft you read and says, in a few words, what changed.");
    try {
      const result = await withTransaction(app.db, async (client) => {
        const r = await publishWorkingCopy(client, stageId, id.userId, parsed.data, (row) =>
          // A typed draft has no author but its editor, who may publish it; any other draft keeps the author rule.
          assertMayApprove(client, id, row.origin === "console" ? null : row.authored_by, stageId).then(() => undefined),
        );
        await client.query(
          `insert into audit_log (actor_id, action, target_type, target_id, payload) values ($1, 'chapter.publish', 'stage', $2, $3)`,
          [
            id.userId, stageId,
            JSON.stringify({
              reason: parsed.data.reason, hash: parsed.data.hash, origin: r.origin, blocks: r.blocks,
              added: r.added, removed: r.removed, edited: r.edited, moved: r.moved,
              ...(r.selfApproved ? { selfApproved: true } : {}),
            }),
          ],
        );
        return r;
      });
      return reply.send({ ok: true, ...result });
    } catch (e) {
      // The database's own check, if it ever answers before the route's does: still a sentence.
      if ((e as { code?: string })?.code === "23514" && /may not approve/.test((e as Error).message)) {
        throw errors.forbidden("Only a teacher of CPE 412 or the admin approves its content.");
      }
      throw e;
    }
  });
}
