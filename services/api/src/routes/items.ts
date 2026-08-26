import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import { resolveItem, type BankItem } from "../engine/resolve.js";
import type { Env } from "../env.js";

/**
 * P7 — the item bank: review, preview, version, retire.
 *
 * `PHASES.md` calls the bank "the real project": the code is ~12 weeks, the
 * bank is continuous, and no amount of code substitutes for it. Until this
 * existed there was no way for a teacher to see an item, let alone approve one,
 * which made "approve every one by hand before it goes live" impossible to
 * actually do.
 *
 * FOUR RULES, and three of them are refusals.
 *
 * 1. **Items are versioned, never edited in place.** (Hard rule 6.) A new
 *    version is a new row sharing `family_id`; the old row is retired, not
 *    deleted. `PUT /items/:id` does not exist and must not.
 *
 * 2. **A live item cannot be edited at all.** Not even to fix a typo. It gets a
 *    new version, and the caller is told that stats do not carry over — in
 *    those words, because `apps/console/CLAUDE.md` requires the confirm dialog
 *    to say exactly that.
 *
 * 3. **Nothing goes live without a reviewer who is not the author.** Approving
 *    your own item is how a wrong key reaches a live bank, and a wrong key in a
 *    live bank is a grading incident rather than a bug.
 *
 * 4. **Preview is the real engine.** The same `resolveItem()` a student's paper
 *    goes through, with a caller-supplied seed so a teacher can re-roll and see
 *    the spread of variants their students will get. A preview that used a
 *    different code path would be a preview of something else.
 */

const ListQuery = z.object({
  stageId: z.string().regex(/^\d{2}$/).optional(),
  status: z.enum(["draft", "review", "live", "retired"]).optional(),
  flagged: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const StatusBody = z.object({
  status: z.enum(["draft", "review", "live", "retired"]),
  reason: z.string().trim().max(500).optional(),
});

const ItemFields = z.object({
  slug: z.string().trim().min(3).max(80),
  stageId: z.string().regex(/^\d{2}$/),
  objectiveId: z.string().trim().max(20).nullable().optional(),
  type: z.enum(["S", "P", "G"]),
  bloom: z.enum(["remember", "understand", "apply", "analyze"]),
  targetDifficulty: z.number().min(0).max(1).optional(),
  stemTemplate: z.string().trim().min(5),
  paramsSchema: z.record(z.unknown()).nullable().optional(),
  solverRef: z.string().trim().max(80).nullable().optional(),
  tolerance: z.number().nullable().optional(),
  correctSpec: z.record(z.unknown()),
  distractorPool: z.unknown().optional(),
  rationaleTemplate: z.string().trim().nullable().optional(),
});

/**
 * Serialize a value bound for a `jsonb` column.
 *
 * `null` stays null; everything else becomes JSON text. See the note at the
 * carry-over site in the version route for why passing a parsed value through
 * is a trap rather than a shortcut.
 */
function jsonParam(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Map a database row to the engine's BankItem. */
function toBankItem(r: Record<string, unknown>): BankItem {
  return {
    id: r.id as string,
    slug: r.slug as string,
    stageId: r.stage_id as string,
    objectiveId: (r.objective_id as string | null) ?? null,
    type: r.type as BankItem["type"],
    bloom: r.bloom as string,
    stemTemplate: r.stem_template as string,
    solverRef: (r.solver_ref as string | null) ?? null,
    correctSpec: (r.correct_spec ?? {}) as Record<string, unknown>,
    distractorPool: r.distractor_pool,
    rationaleTemplate: (r.rationale_template as string | null) ?? null,
  };
}

export function registerItemRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/items
   * The bank, with psychometrics inline.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/items", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const q = ListQuery.safeParse(req.query);
    if (!q.success) throw errors.badRequest("That filter could not be read.");
    const { stageId, status, flagged, limit } = q.data;

    const { rows } = await app.db.query(
      `select i.id, i.family_id, i.slug, i.stage_id, i.objective_id, i.type,
              i.status, i.version, i.bloom, i.target_difficulty,
              i.stem_template, i.solver_ref, i.created_at,
              i.author_id, i.reviewed_by, i.reviewed_at,
              o.description as objective_text,
              st.n_exposures, st.p_value, st.discrimination, st.flagged, st.flag_reason,
              a.full_name as author_name, rv.full_name as reviewer_name
         from items i
         left join objectives  o  on o.id = i.objective_id
         left join item_stats  st on st.item_id = i.id
         left join profiles    a  on a.id = i.author_id
         left join profiles    rv on rv.id = i.reviewed_by
        where ($1::text is null or i.stage_id = $1)
          and ($2::text is null or i.status = $2::item_status)
          and ($3::bool is null or coalesce(st.flagged, false) = $3::bool)
        order by i.stage_id, i.slug, i.version desc
        limit $4`,
      [stageId ?? null, status ?? null, flagged === undefined ? null : flagged === "true", limit],
    );

    const summary = await app.db.query(
      `select i.status::text as status, count(*)::int as n from items i group by i.status`,
    );

    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        familyId: r.family_id,
        slug: r.slug,
        stageId: r.stage_id,
        objectiveId: r.objective_id,
        objectiveText: r.objective_text,
        type: r.type,
        status: r.status,
        version: Number(r.version),
        bloom: r.bloom,
        targetDifficulty: r.target_difficulty === null ? null : Number(r.target_difficulty),
        // The TEMPLATE, not a resolved instance. Safe for a list view: it holds
        // `{f}` slots rather than anyone's numbers, and no answer.
        stemTemplate: r.stem_template,
        solverRef: r.solver_ref,
        authorName: r.author_name,
        reviewerName: r.reviewer_name,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
        stats: {
          exposures: Number(r.n_exposures ?? 0),
          // p-value is DIFFICULTY: the proportion who got it right. High is easy.
          pValue: r.p_value === null ? null : Number(r.p_value),
          // Point-biserial. Below ~0.15 the item is not separating students who
          // know the material from those who do not, whatever its p-value says.
          discrimination: r.discrimination === null ? null : Number(r.discrimination),
          flagged: r.flagged === true,
          flagReason: r.flag_reason,
        },
      })),
      summary: Object.fromEntries(summary.rows.map((r) => [r.status, Number(r.n)])),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/items/:id/preview?seed=...
   *
   * Resolve a real instance through the real engine. Re-roll by changing seed.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/items/:id/preview", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const itemId = (req.params as { id: string }).id;
    const seed = String((req.query as { seed?: string }).seed ?? "preview-1");

    const { rows } = await app.db.query(
      `select id, slug, stage_id, objective_id, type, bloom, stem_template,
              solver_ref, correct_spec, distractor_pool, rationale_template
         from items where id = $1`,
      [itemId],
    );
    if (rows.length === 0) throw errors.notFound("No such item.");

    try {
      const resolved = resolveItem(toBankItem(rows[0]!), seed, {
        ordinal: 1,
        engineVersion: env.ENGINE_VERSION,
      });
      return reply.send({ seed, item: resolved });
    } catch (err) {
      // A solver that throws is a BROKEN ITEM, and saying so plainly is the
      // whole value of a preview. Returning 500 would read as "the console is
      // down" rather than "this item cannot be resolved".
      req.log.warn({ err, itemId }, "item preview failed to resolve");
      return reply.send({
        seed,
        item: null,
        error:
          err instanceof Error
            ? err.message
            : "This item could not be resolved. Check its solver and parameters.",
      });
    }
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/items          -- create a DRAFT
   * -------------------------------------------------------- */
  app.post("/api/v1/console/items", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = ItemFields.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest("That item could not be read. Check the required fields.");
    }
    const f = body.data;

    const { rows } = await app.db.query(
      `insert into items
         (slug, stage_id, objective_id, type, status, version, bloom,
          target_difficulty, stem_template, params_schema, solver_ref,
          solver_version, tolerance, correct_spec, distractor_pool,
          rationale_template, author_id)
       values ($1,$2,$3,$4::item_type,'draft',1,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning id, family_id`,
      [
        f.slug, f.stageId, f.objectiveId ?? null, f.type, f.bloom,
        f.targetDifficulty ?? 0.6, f.stemTemplate,
        f.paramsSchema ? JSON.stringify(f.paramsSchema) : null,
        f.solverRef ?? null,
        f.solverRef ? env.ENGINE_VERSION : null,
        f.tolerance ?? null,
        JSON.stringify(f.correctSpec),
        JSON.stringify(f.distractorPool ?? []),
        f.rationaleTemplate ?? null,
        id!.userId,
      ],
    );

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'item.create','item',$2,$3)`,
      [id!.userId, rows[0]!.id, JSON.stringify({ slug: f.slug, stageId: f.stageId })],
    );

    return reply.status(201).send({ id: rows[0]!.id, familyId: rows[0]!.family_id, version: 1 });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/items/:id/version   -- edit = NEW VERSION
   * -------------------------------------------------------- */
  app.post("/api/v1/console/items/:id/version", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const itemId = (req.params as { id: string }).id;

    const body = ItemFields.partial().safeParse(req.body);
    if (!body.success) throw errors.badRequest("That edit could not be read.");

    const result = await withTransaction(app.db, async (client) => {
      const cur = await client.query("select * from items where id = $1 for update", [itemId]);
      if (cur.rows.length === 0) throw errors.notFound("No such item.");
      const old = cur.rows[0]!;

      const next = await client.query(
        `select coalesce(max(version), 0) + 1 as v from items where family_id = $1`,
        [old.family_id],
      );
      const version = Number(next.rows[0]!.v);
      const f = body.data;

      const created = await client.query(
        `insert into items
           (family_id, slug, stage_id, objective_id, type, status, version, bloom,
            target_difficulty, stem_template, params_schema, solver_ref,
            solver_version, tolerance, correct_spec, distractor_pool,
            rationale_template, author_id)
         values ($1,$2,$3,$4,$5::item_type,'draft',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         returning id`,
        [
          old.family_id,
          f.slug ?? old.slug,
          f.stageId ?? old.stage_id,
          f.objectiveId === undefined ? old.objective_id : f.objectiveId,
          f.type ?? old.type,
          version,
          f.bloom ?? old.bloom,
          f.targetDifficulty ?? old.target_difficulty,
          f.stemTemplate ?? old.stem_template,
          // EVERY jsonb value is stringified, carried-over ones included.
          // node-pg hands back a parsed JS value for a jsonb column, and passing
          // that straight into the next query does NOT round-trip: an array
          // becomes a Postgres array literal `{a,b}` rather than JSON, and the
          // insert dies with "invalid input syntax for type json". Which is at
          // least loud -- an object would have serialized to `[object Object]`
          // and stored silently.
          jsonParam(f.paramsSchema === undefined ? old.params_schema : f.paramsSchema),
          f.solverRef === undefined ? old.solver_ref : f.solverRef,
          old.solver_version,
          f.tolerance === undefined ? old.tolerance : f.tolerance,
          jsonParam(f.correctSpec === undefined ? old.correct_spec : f.correctSpec),
          jsonParam(f.distractorPool === undefined ? old.distractor_pool : f.distractorPool),
          f.rationaleTemplate === undefined ? old.rationale_template : f.rationaleTemplate,
          id!.userId,
        ],
      );

      // The old row is RETIRED, never deleted. Every attempt_items row that
      // points at it must keep resolving, forever -- that is what makes a paper
      // regenerable months later.
      await client.query("update items set status = 'retired' where id = $1", [itemId]);

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1,'item.version','item',$2,$3)`,
        [
          id!.userId,
          created.rows[0]!.id,
          JSON.stringify({ familyId: old.family_id, from: itemId, version }),
        ],
      );

      return { id: created.rows[0]!.id, version, retired: itemId };
    });

    return reply.status(201).send({
      ...result,
      // Said in these words on purpose. apps/console/CLAUDE.md requires the
      // confirm dialog to say it, and the API says it too so a script author
      // cannot miss it.
      notice: "Statistics do not carry over. The new version starts with no exposures.",
    });
  });

  /* ----------------------------------------------------------
   * PATCH /api/v1/console/items/:id/status
   * -------------------------------------------------------- */
  app.patch("/api/v1/console/items/:id/status", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const itemId = (req.params as { id: string }).id;

    const body = StatusBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That status change could not be read.");

    const cur = await app.db.query(
      "select status, author_id, type, correct_spec from items where id = $1",
      [itemId],
    );
    if (cur.rows.length === 0) throw errors.notFound("No such item.");
    const item = cur.rows[0]!;

    if (body.data.status === "live") {
      // Rule 3. Approving your own item is how a wrong key reaches a live bank.
      if (item.author_id === id!.userId) {
        throw errors.forbidden(
          "An item cannot be approved by the person who wrote it. Ask another " +
            "member of staff to review it.",
        );
      }
      // A static item with no correct value would grade every student wrong,
      // silently, for as long as it stayed live.
      if (item.type === "S" && !(item.correct_spec as { value?: unknown })?.value) {
        throw errors.badRequest("This item has no correct answer recorded. It cannot go live.");
      }
    }

    await app.db.query(
      `update items
          set status = $2::item_status,
              reviewed_by = case when $2 = 'live' then $3 else reviewed_by end,
              reviewed_at = case when $2 = 'live' then now() else reviewed_at end
        where id = $1`,
      [itemId, body.data.status, id!.userId],
    );

    await app.db.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'item.status','item',$2,$3)`,
      [
        id!.userId,
        itemId,
        JSON.stringify({ from: item.status, to: body.data.status, reason: body.data.reason ?? null }),
      ],
    );

    return reply.send({ ok: true, status: body.data.status });
  });
}
