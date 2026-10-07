import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { AppError, errors } from "../errors.js";
import { assertMayApprove } from "../approval.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";

/* ----------------------------------------------------------------
 * Figures (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md).
 *
 * A figure is an SVG drawn for this course, written by sync-content to the
 * staff-only `figures` table as a draft. These two routes are the only way a
 * drawing reaches a student: an approval bound to the hash the reviewer saw
 * copies the drawing into `approved_svg` (a trigger refuses any other bytes)
 * and writes one audit row. /content and /items both call them, so a figure
 * is approved once wherever the reviewer meets it.
 * ---------------------------------------------------------------- */

const FIGURE_ID = /^[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

export function toFigure(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    title: r.title as string,
    svg: r.svg as string,
    hash: r.svg_hash as string,
    status: r.status as "draft" | "approved" | "sent_back",
    note: (r.note ?? null) as string | null,
    // Whether students see a drawing now: the last approved one, which may be
    // an older drawing than the one under review.
    served: r.served === true,
    everApproved: r.ever_approved === true,
    reviewer: (r.reviewer ?? null) as string | null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string).toISOString() : null,
  };
}

export function registerFigureRoutes(app: FastifyInstance, env: Env): void {
  /**
   * POST /api/v1/console/figures/:figureId/approve   (staff)
   *
   * Bound to the drawing on the reviewer's screen (its hash). Idempotent.
   */
  app.post("/api/v1/console/figures/:figureId/approve", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const figureId = (req.params as { figureId: string }).figureId;
    if (!FIGURE_ID.test(figureId)) throw errors.notFound("No such figure.");
    const parsed = z.object({ hash: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("An approval names the drawing it approves.");

    const result = await withTransaction(app.db, async (client) => {
      const { rows } = await client.query(
        "select svg, svg_hash, status, stage_id, authored_by::text as authored_by from figures where id = $1 for update",
        [figureId],
      );
      const cur = rows[0];
      if (!cur) throw errors.notFound("No such figure.");
      if (cur.svg_hash !== parsed.data.hash) {
        throw new AppError("conflict", "This figure was redrawn since you opened it. Look at the new drawing before approving it.");
      }
      if (cur.status === "approved") return { already: true };
      const { selfApproved } = await assertMayApprove(client, id!, cur.authored_by ?? null, cur.stage_id);
      await client.query(
        `update figures
            set status = 'approved', approved_hash = svg_hash, approved_svg = svg,
                ever_approved = true, note = null, reviewed_by = $2, reviewed_at = now()
          where id = $1`,
        [figureId, id!.userId],
      );
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'figure.approve', 'figure', $2, $3)`,
        [id!.userId, figureId, JSON.stringify({ hash: cur.svg_hash, ...(selfApproved ? { selfApproved: true } : {}) })],
      );
      return { already: false };
    });
    return reply.send({ ok: true, alreadyApproved: result.already });
  });

  /**
   * POST /api/v1/console/figures/:figureId/send-back   (staff)
   *
   * Back to its author with the reason. What students see does not change: a
   * drawing never approved never reached them, and an older approved one stays.
   */
  app.post("/api/v1/console/figures/:figureId/send-back", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const figureId = (req.params as { figureId: string }).figureId;
    if (!FIGURE_ID.test(figureId)) throw errors.notFound("No such figure.");
    const parsed = z.object({ reason: z.string().trim().min(3).max(1000) }).safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Sending a figure back needs a reason of at least 3 characters.");

    await withTransaction(app.db, async (client) => {
      const { rows } = await client.query("select status from figures where id = $1 for update", [figureId]);
      if (!rows[0]) throw errors.notFound("No such figure.");
      await client.query(
        `update figures
            set status = 'sent_back', note = $2, reviewed_by = $3, reviewed_at = now()
          where id = $1`,
        [figureId, parsed.data.reason, id!.userId],
      );
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'figure.send_back', 'figure', $2, $3)`,
        [id!.userId, figureId, JSON.stringify({ reason: parsed.data.reason })],
      );
    });
    return reply.send({ ok: true });
  });
}
