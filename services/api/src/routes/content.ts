import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { AppError, errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";
import { toFigure } from "./figures.js";
import { assertMayApprove } from "../approval.js";

/**
 * `/content`: authoring status, the block editor, and planet-summary review.
 * `design/templates/console/content/SPEC.md`; instructor rulings, 28 Sep 2026.
 *
 * THREE RULES, each held below the API as well as in it.
 *
 * 1. **An edit is a new version, and the old text is kept.** The archive
 *    trigger on `content_blocks` writes every replaced version to
 *    `content_block_versions`; this file only NAMES the edit (who, why, via the
 *    console) with transaction-local settings. A staff client that goes around
 *    the API is archived too, as 'direct'.
 *
 * 2. **A quote from the book is not edited here.** A block carrying
 *    `meta.source` quotes the textbook verbatim and is checked word for word by
 *    `sync-content --verify`. The book is gitignored, so this server cannot run
 *    that check. Such a block is edited in its `.md` file.
 *
 * 3. **An approval is of one exact text.** Approve carries the hash of the
 *    draft the reviewer read; if sync has written a different draft since, the
 *    approval is refused. `stages.summary` is then written from the draft
 *    itself, and a trigger refuses any other text for every role.
 *
 * Sync never overwrites a console edit (`console_edited`); `sync-content
 * --pull` writes it back into the file.
 */

const STAGE_ID = /^\d{2}$/;

const EditBody = z.object({
  body: z.string().max(40_000),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(300),
});

export type Authoring = "empty" | "planned" | "authored";

export function authoringOf(blocks: number, scaffold: number): Authoring {
  // Three states, and they are genuinely different:
  //   empty     nothing synced at all
  //   planned   objectives and a topic outline, no teaching text
  //   authored  real prose exists
  return blocks === 0 ? "empty" : scaffold > 0 ? "planned" : "authored";
}

export function registerContentRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/content
   *
   * Authoring status per stage. This exists because the honest answer to "is
   * the course ready" is per-chapter, and an aggregate hides it.
   *
   * A stage is PLANNED until someone writes its prose. `scripts/gen-stages.mjs`
   * emits a callout carrying `meta.kind='planned'` for every chapter that has
   * only its syllabus outline, so the gap is a queryable fact rather than
   * something a reader has to notice. (`scaffold` is still matched so an older
   * sync is not misreported as done.)
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select s.id, s.title, s.act, s.ordinal, s.archetype, s.levels,
              s.est_minutes, s.published, s.gradeable,
              (select count(*)::int from content_blocks cb where cb.stage_id = s.id)
                as blocks,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.meta->>'kind' in ('scaffold','planned'))
                as scaffold_blocks,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.console_edited)
                as console_edited,
              (select count(*)::int from objectives o where o.stage_id = s.id)
                as objectives,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status = 'live')
                as live_items,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status <> 'live')
                as draft_items,
              (select count(*)::int from figures f
                where f.stage_id = s.id and f.status <> 'approved')
                as figures_waiting,
              (select count(*)::int from figures f
                where f.stage_id = s.id and f.status = 'approved')
                as figures_approved,
              ss.status as summary_status,
              cd.status as draft_status, cd.ever_approved as draft_ever_approved
         from stages s
         left join stage_summaries ss on ss.stage_id = s.id
         left join chapter_drafts cd on cd.stage_id = s.id
        order by s.ordinal`,
    );

    const stages = rows.map((r) => {
      const blocks = Number(r.blocks);
      return {
        id: r.id as string,
        title: r.title as string,
        act: Number(r.act),
        ordinal: Number(r.ordinal),
        archetype: r.archetype as string,
        levels: r.levels as number[],
        estMinutes: Number(r.est_minutes),
        published: r.published as boolean,
        gradeable: r.gradeable as boolean,
        blocks,
        consoleEdited: Number(r.console_edited),
        objectives: Number(r.objectives),
        liveItems: Number(r.live_items),
        draftItems: Number(r.draft_items),
        authoring: authoringOf(blocks, Number(r.scaffold_blocks)),
        summaryStatus: (r.summary_status ?? null) as "draft" | "approved" | "sent_back" | null,
        draftStatus: (r.draft_status ?? null) as "draft" | "approved" | "sent_back" | null,
        figuresWaiting: Number(r.figures_waiting),
        figuresApproved: Number(r.figures_approved),
      };
    });

    const gradeable = stages.filter((s) => s.gradeable);
    const countSummaries = (st: string | null) => stages.filter((s) => s.summaryStatus === st).length;
    return reply.send({
      stages,
      summary: {
        total: stages.length,
        authored: stages.filter((s) => s.authoring === "authored").length,
        planned: stages.filter((s) => s.authoring === "planned").length,
        empty: stages.filter((s) => s.authoring === "empty").length,
        objectives: stages.reduce((a, s) => a + s.objectives, 0),
        liveItems: stages.reduce((a, s) => a + s.liveItems, 0),
        // PHASES.md targets ~40 live items per gradeable stage. The bank is the
        // schedule, so the shortfall is stated as a number rather than implied.
        itemTarget: gradeable.length * 40,
        consoleEdited: stages.reduce((a, s) => a + s.consoleEdited, 0),
        chapters: {
          draft: stages.filter((s) => s.draftStatus === "draft").length,
          approved: stages.filter((s) => s.draftStatus === "approved").length,
          sentBack: stages.filter((s) => s.draftStatus === "sent_back").length,
        },
        figures: {
          waiting: stages.reduce((a, s) => a + s.figuresWaiting, 0),
          approved: stages.reduce((a, s) => a + s.figuresApproved, 0),
        },
        summaries: {
          draft: countSummaries("draft"),
          approved: countSummaries("approved"),
          sentBack: countSummaries("sent_back"),
          none: countSummaries(null),
        },
      },
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/content/summaries
   *
   * Every drafted summary, for the review queue. Staff only; the drafts are
   * unreviewed text and live in a staff-only table for exactly that reason.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content/summaries", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const { rows } = await app.db.query(
      `select ss.stage_id, s.title, s.act, ss.draft, ss.draft_hash, ss.status, ss.note,
              ss.reviewed_at, ss.updated_at, ss.authored_by::text as authored_by, p.full_name as reviewer
         from stage_summaries ss
         join stages s on s.id = ss.stage_id
         left join profiles p on p.id = ss.reviewed_by
        order by s.ordinal`,
    );
    return reply.send({ summaries: rows.map(toSummary) });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/content/:stageId
   *
   * One chapter for the editor: its blocks in order, each saying whether the
   * console may edit it and who last changed it, and its summary.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content/:stageId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = (req.params as { stageId: string }).stageId;
    if (!STAGE_ID.test(stageId)) throw errors.notFound("No such stage.");

    const { rows: st } = await app.db.query(
      `select s.id, s.title, s.act, s.archetype, s.levels, s.gradeable, s.published,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.meta->>'kind' in ('scaffold','planned')) as scaffold_blocks
         from stages s where s.id = $1`,
      [stageId],
    );
    const s = st[0];
    if (!s) throw errors.notFound("No such stage.");

    const { rows: blocks } = await app.db.query(
      `select cb.id, cb.ordinal, cb.kind, cb.body_md, cb.meta, cb.version, cb.updated_at,
              cb.console_edited,
              last.replaced_via, last.replaced_at, last.reason, p.full_name as editor,
              (select count(*)::int from content_block_versions v where v.block_id = cb.id) as history
         from content_blocks cb
         left join lateral (
           select v.replaced_via, v.replaced_at, v.reason, v.replaced_by
             from content_block_versions v
            where v.block_id = cb.id
            order by v.version desc limit 1
         ) last on true
         left join profiles p on p.id = last.replaced_by
        where cb.stage_id = $1
        order by cb.ordinal`,
      [stageId],
    );

    const { rows: sums } = await app.db.query(
      `select ss.stage_id, s.title, s.act, ss.draft, ss.draft_hash, ss.status, ss.note,
              ss.reviewed_at, ss.updated_at, ss.authored_by::text as authored_by, p.full_name as reviewer
         from stage_summaries ss
         join stages s on s.id = ss.stage_id
         left join profiles p on p.id = ss.reviewed_by
        where ss.stage_id = $1`,
      [stageId],
    );

    // Drafted lesson text, if any (5 Oct 2026): shown beside the live blocks.
    const { rows: drafts } = await app.db.query(
      `select cd.blocks, cd.draft_hash, cd.status, cd.note, cd.ever_approved, cd.reviewed_at, cd.updated_at,
              cd.authored_by::text as authored_by, p.full_name as reviewer
         from chapter_drafts cd left join profiles p on p.id = cd.reviewed_by
        where cd.stage_id = $1`,
      [stageId],
    );
    const dr = drafts[0];

    // The syllabus's objectives for this chapter, read-only (Studio's Objectives tab): they are the
    // syllabus's contract, transcribed verbatim, and check:objectives guards them.
    const { rows: objs } = await app.db.query(
      `select code, description, bloom_level, level, competency from objectives where stage_id = $1 order by code`,
      [stageId],
    );

    // The chapter's figures (6 Oct 2026), each drawn as it is under review.
    const { rows: figs } = await app.db.query(
      `select f.id, f.title, f.svg, f.svg_hash, f.status, f.note, f.ever_approved,
              f.approved_svg is not null as served, f.reviewed_at, f.authored_by::text as authored_by, p.full_name as reviewer
         from figures f left join profiles p on p.id = f.reviewed_by
        where f.stage_id = $1
        order by f.id`,
      [stageId],
    );

    return reply.send({
      objectives: objs.map((o) => ({
        code: o.code as string,
        description: o.description as string,
        bloom: o.bloom_level as string,
        level: o.level === null ? null : Number(o.level),
        competency: (o.competency ?? null) as string | null,
      })),
      figures: figs.map(toFigure),
      draft: dr
        ? {
            blocks: dr.blocks as Array<{ kind: string; body: string; meta: Record<string, unknown> }>,
            hash: dr.draft_hash as string,
            status: dr.status as "draft" | "approved" | "sent_back",
            note: (dr.note ?? null) as string | null,
            everApproved: dr.ever_approved === true,
            reviewer: (dr.reviewer ?? null) as string | null,
            reviewedAt: dr.reviewed_at ?? null,
            updatedAt: dr.updated_at,
            authoredBy: (dr.authored_by ?? null) as string | null,
          }
        : null,
      stage: {
        id: s.id,
        title: s.title,
        act: Number(s.act),
        archetype: s.archetype,
        levels: s.levels,
        gradeable: s.gradeable,
        published: s.published,
        authoring: authoringOf(blocks.length, Number(s.scaffold_blocks)),
      },
      blocks: blocks.map(toBlock),
      summary: sums[0] ? toSummary(sums[0]) : null,
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/content/blocks/:blockId/history
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content/blocks/:blockId/history", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const blockId = (req.params as { blockId: string }).blockId;
    if (!isUuid(blockId)) throw errors.notFound("No such block.");
    const { rows } = await app.db.query(
      `select v.version, v.kind, v.body_md, v.replaced_via, v.replaced_at, v.reason,
              p.full_name as editor
         from content_block_versions v
         left join profiles p on p.id = v.replaced_by
        where v.block_id = $1
        order by v.version desc`,
      [blockId],
    );
    return reply.send({
      versions: rows.map((r) => ({
        version: Number(r.version),
        kind: r.kind as string,
        body: (r.body_md ?? "") as string,
        via: r.replaced_via as "sync" | "console" | "direct",
        replacedAt: new Date(r.replaced_at).toISOString(),
        reason: (r.reason ?? null) as string | null,
        editor: (r.editor ?? null) as string | null,
      })),
    });
  });

  /* ----------------------------------------------------------
   * PUT /api/v1/console/content/blocks/:blockId   (staff)
   *
   * Changes what students read, now. Reason required, like every write that
   * changes student-visible state; the version the editor loaded is required
   * too, so two teachers saving the same block cannot silently overwrite each
   * other.
   * -------------------------------------------------------- */
  app.put("/api/v1/console/content/blocks/:blockId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const blockId = (req.params as { blockId: string }).blockId;
    if (!isUuid(blockId)) throw errors.notFound("No such block.");

    const parsed = EditBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("An edit needs the text, the version you opened, and a reason of at least 3 characters.");
    }
    const e = parsed.data;
    const body = e.body.replace(/\r\n/g, "\n").trim();
    if (body.length === 0) throw errors.badRequest("A block cannot be empty. To remove one, edit the chapter's .md file.");

    const saved = await withTransaction(app.db, async (client) => {
      const { rows } = await client.query(
        "select id, stage_id, ordinal, kind, body_md, meta, version from content_blocks where id = $1 for update",
        [blockId],
      );
      const cur = rows[0];
      if (!cur) throw errors.notFound("No such block.");

      const source = (cur.meta as Record<string, unknown>)?.source;
      if (typeof source === "string" && source.length > 0) {
        throw new AppError(
          "conflict",
          `This block quotes ${source} word for word and is checked against the book. ` +
            `Edit it in content/stages/${cur.stage_id}.md, where sync-content --verify can check it.`,
        );
      }
      if (Number(cur.version) !== e.version) {
        throw new AppError(
          "conflict",
          `Someone saved this block since you opened it (it is now version ${cur.version}). ` +
            `Reload to read their text before saving yours.`,
        );
      }
      if (cur.body_md === body) throw errors.badRequest("Nothing changed: the text is the same as the saved version.");

      // Names the edit for the archive trigger. Transaction-local, so it cannot
      // leak onto another request's connection.
      await client.query(
        `select set_config('app.edit_via', 'console', true),
                set_config('app.actor_id', $1, true),
                set_config('app.edit_reason', $2, true)`,
        [id!.userId, e.reason],
      );
      const { rows: upd } = await client.query(
        `update content_blocks set body_md = $2, console_edited = true
          where id = $1
        returning id, ordinal, kind, body_md, meta, version, updated_at, console_edited`,
        [blockId, body],
      );
      const b = upd[0]!;
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'content.edit', 'content_block', $2, $3)`,
        [
          id!.userId,
          blockId,
          JSON.stringify({
            stageId: cur.stage_id,
            ordinal: Number(cur.ordinal),
            version: Number(b.version),
            reason: e.reason,
            previousVersion: Number(cur.version),
          }),
        ],
      );
      // Counted afterwards: the trigger's archive row is not visible to the
      // UPDATE's own RETURNING.
      const { rows: h } = await client.query(
        "select count(*)::int as n from content_block_versions where block_id = $1",
        [blockId],
      );
      return {
        ...b, replaced_via: "console", replaced_at: new Date(), reason: e.reason,
        editor: null, history: Number(h[0]!.n),
      };
    });

    return reply.send({ block: toBlock(saved) });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/content/summaries/:stageId/approve   (staff)
   * -------------------------------------------------------- */
  app.post("/api/v1/console/content/summaries/:stageId/approve", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = (req.params as { stageId: string }).stageId;
    if (!STAGE_ID.test(stageId)) throw errors.notFound("No summary for that stage.");
    const parsed = z.object({ hash: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("An approval names the text it approves.");

    const result = await withTransaction(app.db, async (client) => {
      const { rows } = await client.query(
        "select draft, draft_hash, status, authored_by::text as authored_by from stage_summaries where stage_id = $1 for update",
        [stageId],
      );
      const cur = rows[0];
      if (!cur) throw errors.notFound("No summary has been drafted for that stage.");
      if (cur.draft_hash !== parsed.data.hash) {
        throw new AppError(
          "conflict",
          "This summary changed since you opened it. Read the new text before approving it.",
        );
      }
      if (cur.status === "approved") return { already: true };
      const { selfApproved } = await assertMayApprove(client, id!, cur.authored_by ?? null, stageId);

      await client.query(
        `update stage_summaries
            set status = 'approved', approved_hash = draft_hash, note = null,
                reviewed_by = $2, reviewed_at = now()
          where stage_id = $1`,
        [stageId, id!.userId],
      );
      await client.query("update stages set summary = $2 where id = $1", [stageId, cur.draft]);
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'summary.approve', 'stage', $2, $3)`,
        [id!.userId, stageId, JSON.stringify({ hash: cur.draft_hash, text: cur.draft, ...(selfApproved ? { selfApproved: true } : {}) })],
      );
      return { already: false };
    });

    return reply.send({ ok: true, alreadyApproved: result.already });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/content/summaries/:stageId/send-back   (staff)
   *
   * From a draft: it never reaches students. From an approved one: it leaves
   * their screens now. Either way the reason is kept for the author.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/content/summaries/:stageId/send-back", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = (req.params as { stageId: string }).stageId;
    if (!STAGE_ID.test(stageId)) throw errors.notFound("No summary for that stage.");
    const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("Sending a summary back needs a reason of at least 3 characters.");
    }

    await withTransaction(app.db, async (client) => {
      const { rows } = await client.query(
        "select status from stage_summaries where stage_id = $1 for update",
        [stageId],
      );
      const cur = rows[0];
      if (!cur) throw errors.notFound("No summary has been drafted for that stage.");
      const wasLive = cur.status === "approved";

      await client.query(
        `update stage_summaries
            set status = 'sent_back', approved_hash = null, note = $2,
                reviewed_by = $3, reviewed_at = now()
          where stage_id = $1`,
        [stageId, parsed.data.reason, id!.userId],
      );
      await client.query("update stages set summary = null where id = $1", [stageId]);
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'summary.send_back', 'stage', $2, $3)`,
        [id!.userId, stageId, JSON.stringify({ reason: parsed.data.reason, wasLive })],
      );
    });

    return reply.send({ ok: true });
  });
}

/* ------------------------------------------------------------------
 * Drafted lesson text (instructor ruling, 5 Oct 2026). A chapter drafted from
 * the textbook waits in `chapter_drafts` (staff-only) until approved here.
 * ---------------------------------------------------------------- */
const DraftBlock = z.object({ kind: z.string().min(1), body: z.string(), meta: z.record(z.string(), z.unknown()).default({}) });

export function registerChapterDraftRoutes(app: FastifyInstance, env: Env): void {
  /**
   * POST /api/v1/console/content/drafts/:stageId/approve   (staff)
   *
   * Bound to the text the reviewer read (its hash). Copies the drafted blocks
   * into `content_blocks` through the archive trigger (named a console edit,
   * with the reviewer as actor), removes blocks past the draft's end, marks the
   * draft approved and `ever_approved` (sync leaves the chapter alone from
   * now on), and writes one audit row. Idempotent.
   */
  app.post("/api/v1/console/content/drafts/:stageId/approve", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = (req.params as { stageId: string }).stageId;
    if (!STAGE_ID.test(stageId)) throw errors.notFound("No drafted text for that chapter.");
    const parsed = z.object({ hash: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("An approval names the text it approves.");

    const result = await withTransaction(app.db, async (client) => {
      const { rows } = await client.query(
        "select blocks, draft_hash, status, authored_by::text as authored_by from chapter_drafts where stage_id = $1 for update",
        [stageId],
      );
      const cur = rows[0];
      if (!cur) throw errors.notFound("No drafted text for that chapter.");
      if (cur.draft_hash !== parsed.data.hash) {
        throw new AppError("conflict", "This chapter's draft changed since you opened it. Read the new text before approving it.");
      }
      if (cur.status === "approved") return { already: true };
      const { selfApproved } = await assertMayApprove(client, id!, cur.authored_by ?? null, stageId);
      const blocks = z.array(DraftBlock).min(1).parse(cur.blocks);

      await client.query(
        `select set_config('app.edit_via', 'console', true),
                set_config('app.actor_id', $1, true),
                set_config('app.edit_reason', $2, true)`,
        [id!.userId, `Drafted lesson text approved (${cur.draft_hash})`],
      );
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        await client.query(
          `insert into content_blocks (stage_id, ordinal, kind, body_md, meta)
           values ($1, $2, $3, $4, $5::jsonb)
           on conflict (stage_id, ordinal) do update
             set kind = excluded.kind, body_md = excluded.body_md, meta = excluded.meta,
                 console_edited = false, source_hash = null`,
          [stageId, i + 1, b.kind, b.body, JSON.stringify(b.meta)],
        );
      }
      await client.query("delete from content_blocks where stage_id = $1 and ordinal > $2", [stageId, blocks.length]);
      await client.query(
        `update chapter_drafts
            set status = 'approved', approved_hash = draft_hash, ever_approved = true, note = null,
                reviewed_by = $2, reviewed_at = now()
          where stage_id = $1`,
        [stageId, id!.userId],
      );
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'chapter.approve', 'stage', $2, $3)`,
        [id!.userId, stageId, JSON.stringify({ hash: cur.draft_hash, blocks: blocks.length, ...(selfApproved ? { selfApproved: true } : {}) })],
      );
      return { already: false };
    });
    return reply.send({ ok: true, alreadyApproved: result.already });
  });

  /**
   * POST /api/v1/console/content/drafts/:stageId/send-back   (staff)
   *
   * The draft goes back to its author with the reason. What students read does
   * not change: a draft never reached them, and an earlier approved text stays.
   */
  app.post("/api/v1/console/content/drafts/:stageId/send-back", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const stageId = (req.params as { stageId: string }).stageId;
    if (!STAGE_ID.test(stageId)) throw errors.notFound("No drafted text for that chapter.");
    const parsed = z.object({ reason: z.string().trim().min(3).max(1000) }).safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Sending a chapter back needs a reason of at least 3 characters.");

    await withTransaction(app.db, async (client) => {
      const { rows } = await client.query("select status from chapter_drafts where stage_id = $1 for update", [stageId]);
      if (!rows[0]) throw errors.notFound("No drafted text for that chapter.");
      await client.query(
        `update chapter_drafts
            set status = 'sent_back', approved_hash = null, note = $2, reviewed_by = $3, reviewed_at = now()
          where stage_id = $1`,
        [stageId, parsed.data.reason, id!.userId],
      );
      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'chapter.send_back', 'stage', $2, $3)`,
        [id!.userId, stageId, JSON.stringify({ reason: parsed.data.reason })],
      );
    });
    return reply.send({ ok: true });
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function toBlock(r: Record<string, unknown>) {
  const meta = (r.meta ?? {}) as Record<string, string>;
  const source = typeof meta.source === "string" && meta.source.length > 0 ? meta.source : null;
  return {
    id: r.id as string,
    ordinal: Number(r.ordinal),
    kind: r.kind as string,
    body: (r.body_md ?? "") as string,
    meta,
    version: Number(r.version),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    consoleEdited: Boolean(r.console_edited),
    editable: source === null,
    source,
    historyCount: Number(r.history ?? 0),
    // The edit that made the current version, when one is recorded.
    lastEdit: r.replaced_via
      ? {
          via: r.replaced_via as "sync" | "console" | "direct",
          at: new Date(r.replaced_at as string).toISOString(),
          reason: (r.reason ?? null) as string | null,
          editor: (r.editor ?? null) as string | null,
        }
      : null,
  };
}

function toSummary(r: Record<string, unknown>) {
  return {
    stageId: r.stage_id as string,
    title: r.title as string,
    act: Number(r.act),
    draft: r.draft as string,
    hash: r.draft_hash as string,
    status: r.status as "draft" | "approved" | "sent_back",
    note: (r.note ?? null) as string | null,
    reviewer: (r.reviewer ?? null) as string | null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string).toISOString() : null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
    /** The teacher who wrote this version through the console; null: written from the files by sync. */
    authoredBy: (r.authored_by ?? null) as string | null,
  };
}
