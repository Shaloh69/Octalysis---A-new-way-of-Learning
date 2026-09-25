import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  ITEM_FILE_FORMAT, ItemBulkStatusRequest, ItemExportRequest, ItemImportRequest,
  type ItemFile,
} from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import { resolveItem, type BankItem } from "../engine/resolve.js";
import { EXAMINABLE_THROUGH_STAGE, isStageExaminable } from "../engine/scope.js";
import { listSolvers } from "../engine/solvers.js";
import {
  countActions, planImport, toAuthored, type ExistingItem, type PlannedRow, type RowFields,
} from "../items/import-plan.js";
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
  /*
   * 2000, up from 500. The bank targets ~40 live items per gradeable chapter,
   * roughly 700, and /items filters, counts and pages the whole bank in the
   * browser: a list silently cut at 500 would have made every count on that
   * page wrong without saying so.
   */
  limit: z.coerce.number().int().min(1).max(2000).default(200),
});

const StatusBody = z.object({
  status: z.enum(["draft", "review", "live", "retired"]),
  reason: z.string().trim().max(500).optional(),
  /**
   * An explicit "I have re-checked this answer key myself".
   *
   * Only accepted when the author is the ONLY member of staff. It is not a way
   * around the review rule -- it is what the review rule degrades to when there
   * is nobody else, and it is recorded as such.
   */
  selfApproved: z.boolean().optional(),
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

/** A bank row's columns in the import planner's terms. */
function rowFields(r: Record<string, unknown>): RowFields {
  return {
    stageId: r.stage_id as string,
    objectiveId: (r.objective_id as string | null) ?? "",
    type: r.type as RowFields["type"],
    bloom: r.bloom as string,
    targetDifficulty: r.target_difficulty === null ? 0.6 : Number(r.target_difficulty),
    stemTemplate: r.stem_template as string,
    solverRef: (r.solver_ref as string | null) ?? null,
    correctSpec: (r.correct_spec ?? {}) as Record<string, unknown>,
    distractorPool: Array.isArray(r.distractor_pool) ? (r.distractor_pool as unknown[]) : [],
    rationale: (r.rationale_template as string | null) ?? null,
  };
}

/**
 * Plan an import against the bank as it stands, through `q` -- the pool for a
 * dry run, the locked transaction for a commit, so the plan that is applied is
 * the plan computed inside the lock rather than one read a moment earlier.
 */
async function planAgainstBank(
  q: Pick<pg.PoolClient, "query">,
  file: ItemFile,
  env: Env,
): Promise<PlannedRow[]> {
  const slugs = file.items.map((i) => i.slug);
  const objectiveIds = file.items.map((i) => i.objective);

  const existing = await q.query(
    `select distinct on (slug) id, family_id, slug, status::text as status, version, stage_id,
            objective_id, type::text as type, bloom, target_difficulty, stem_template,
            solver_ref, correct_spec, distractor_pool, rationale_template
       from items where slug = any($1::text[])
      order by slug, version desc`,
    [slugs],
  );
  const objectives = await q.query(
    "select id, stage_id from objectives where id = any($1::text[])",
    [objectiveIds],
  );

  return planImport(file, {
    existing: new Map(
      existing.rows.map((r): [string, ExistingItem] => [
        r.slug,
        {
          id: r.id,
          familyId: r.family_id,
          slug: r.slug,
          status: r.status,
          version: Number(r.version),
          fields: rowFields(r),
        },
      ]),
    ),
    objectives: new Map(objectives.rows.map((r) => [r.id as string, r.stage_id as string])),
    solvers: new Set(listSolvers(env.ENGINE_VERSION).map((s) => s.id)),
    examinable: isStageExaminable,
    examinableThrough: EXAMINABLE_THROUGH_STAGE,
  });
}

/** The public face of a planned row: what happens and why, never the columns. */
function publicRow(r: PlannedRow) {
  return { slug: r.slug, stageId: r.stageId, action: r.action, reasons: r.reasons };
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
      /*
       * Rule 3, and the one place it bends.
       *
       * Approving your own item is how a wrong key reaches a live bank. But
       * decision D4 makes teacher and admin the same person in this deployment,
       * so on a one-instructor install the strict rule means NOTHING can ever
       * go live -- a correctness rule that stops the system working is not a
       * correctness rule, it is a bug.
       *
       * So: if a second member of staff exists, the strict rule stands and
       * there is no override. If the author is the only one, they may publish
       * their own work by saying so explicitly, and it is recorded as a
       * self-approval rather than as a review. The moment a TA is added, this
       * tightens by itself -- no setting to remember to change.
       */
      if (item.author_id === id!.userId) {
        const staff = await app.db.query(
          `select count(*)::int as n from profiles
            where role in ('teacher','admin') and deleted_at is null and id <> $1`,
          [id!.userId],
        );
        const othersExist = Number(staff.rows[0]!.n) > 0;

        if (othersExist) {
          throw errors.forbidden(
            "An item cannot be approved by the person who wrote it. Ask another " +
              "member of staff to review it.",
          );
        }
        if (!body.data.selfApproved) {
          throw errors.badRequest(
            "You wrote this item, and you are the only member of staff. You can " +
              "publish it, but you must confirm you have re-checked the answer " +
              "key yourself. That confirmation is recorded.",
          );
        }
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
        JSON.stringify({
          from: item.status,
          to: body.data.status,
          reason: body.data.reason ?? null,
          // Distinguishable from a real review, forever, in one field.
          selfApproved:
            body.data.status === "live" && item.author_id === id!.userId ? true : undefined,
        }),
      ],
    );

    return reply.send({ ok: true, status: body.data.status });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/items/bulk-status
   *
   * Bulk review: DRAFTS INTO REVIEW, and nothing else. `PAGE-SPECS.md`'s "bulk
   * approve drafts", approved 25 Sep 2026. A draft's approval is its entry
   * into the review queue; publishing stays one decision per item, by rule 3,
   * which is why `to` is a literal the schema will not widen.
   *
   * Anything in `ids` that is not a draft is skipped and named, never moved:
   * a stale selection must not be able to drag a live item backwards.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/items/bulk-status", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = ItemBulkStatusRequest.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest(
        "Bulk review only sends drafts to review. Publish items one at a time.",
      );
    }
    const ids = [...new Set(body.data.ids)];

    const result = await withTransaction(app.db, async (client) => {
      const cur = await client.query(
        "select id, status::text as status from items where id = any($1::uuid[]) for update",
        [ids],
      );
      const status = new Map(cur.rows.map((r) => [r.id as string, r.status as string]));
      const moved: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const itemId of ids) {
        const st = status.get(itemId);
        if (st === undefined) skipped.push({ id: itemId, reason: "no such item" });
        else if (st !== "draft") skipped.push({ id: itemId, reason: `is ${st}, not a draft` });
        else moved.push(itemId);
      }

      if (moved.length > 0) {
        await client.query(
          "update items set status = 'review'::item_status where id = any($1::uuid[])",
          [moved],
        );
        // One row per item, as a single decision writes, so the audit log reads
        // the same whichever way an item reached review.
        await client.query(
          `insert into audit_log (actor_id, action, target_type, target_id, payload)
           select $1, 'item.status', 'item', x, $3::jsonb from unnest($2::uuid[]) x`,
          [id!.userId, moved, JSON.stringify({ from: "draft", to: "review", bulk: true })],
        );
      }
      return { moved, skipped };
    });

    return reply.send(result);
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/items/import
   *
   * An authored item file -- the shape of `content/items/NN.json`, or an
   * export -- into the bank. A dry run plans and writes nothing; the console
   * always sends one first and shows the plan.
   *
   * Everything imported lands as a DRAFT authored by the importer: never
   * review, never live. A commit with any invalid row writes nothing at all.
   * The rules are `import-plan.ts`'s; this route only reads and writes.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/console/items/import",
    { bodyLimit: 4 * 1024 * 1024 },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      requireStaff(id);

      const body = ItemImportRequest.safeParse(req.body);
      if (!body.success) {
        throw errors.badRequest(
          'That file could not be read as an item file. It needs an "items" list in the ' +
            "shape of content/items/NN.json.",
        );
      }
      const { dryRun, file } = body.data;

      if (dryRun) {
        const rows = await planAgainstBank(app.db, file, env);
        return reply.send({
          dryRun: true, applied: false, rows: rows.map(publicRow), counts: countActions(rows),
        });
      }

      const rows = await withTransaction(app.db, async (client) => {
        // One import at a time: two overlapping uploads of the same slug would
        // otherwise both plan a v2.
        await client.query("select pg_advisory_xact_lock(hashtext('octa:item-import'))");
        const plan = await planAgainstBank(client, file, env);

        const invalid = plan.filter((r) => r.action === "invalid").length;
        if (invalid > 0) {
          throw errors.badRequest(
            `${invalid} item${invalid === 1 ? " is" : "s are"} invalid, so nothing was ` +
              "imported. Run the dry run to see why.",
          );
        }

        for (const r of plan) {
          if (r.action !== "create" && r.action !== "version") continue;
          const f = r.fields!;
          const version = r.action === "version" ? r.replaces!.version + 1 : 1;
          const created = await client.query(
            `insert into items
               (family_id, slug, stage_id, objective_id, type, status, version, bloom,
                target_difficulty, stem_template, solver_ref, solver_version,
                correct_spec, distractor_pool, rationale_template, author_id)
             values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5::item_type, 'draft',
                     $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15)
             returning id`,
            [
              r.replaces?.familyId ?? null, r.slug, f.stageId, f.objectiveId, f.type, version,
              f.bloom, f.targetDifficulty, f.stemTemplate, f.solverRef,
              f.solverRef ? env.ENGINE_VERSION : null,
              JSON.stringify(f.correctSpec), JSON.stringify(f.distractorPool), f.rationale,
              id!.userId,
            ],
          );
          const newId = created.rows[0]!.id as string;

          if (r.action === "version") {
            // Retired, never deleted, never edited in place (hard rule 6). Only
            // a draft or review row reaches here -- the plan refuses live ones.
            await client.query("update items set status = 'retired' where id = $1", [
              r.replaces!.id,
            ]);
          }

          await client.query(
            `insert into audit_log (actor_id, action, target_type, target_id, payload)
             values ($1, $2, 'item', $3, $4)`,
            [
              id!.userId,
              r.action === "create" ? "item.create" : "item.version",
              newId,
              JSON.stringify({
                slug: r.slug,
                stageId: f.stageId,
                via: "import",
                // The items table has no column for it; the audit log keeps it.
                source: r.source ?? null,
                ...(r.action === "version"
                  ? { familyId: r.replaces!.familyId, from: r.replaces!.id, version }
                  : {}),
              }),
            ],
          );
        }
        return plan;
      });

      return reply.send({
        dryRun: false, applied: true, rows: rows.map(publicRow), counts: countActions(rows),
      });
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/console/items/export
   *
   * The named items in the authored file shape, so an export can be committed
   * to `content/items/` or imported back. POST because the console sends the
   * exact ids its filters show, and 700 uuids do not belong in a query string.
   *
   * CARRIES THE ANSWER KEYS -- that is what makes it an export. Staff only,
   * which `ai_after_submit` already grants in the database; the refusal test
   * checks a student gets no key back in the error either.
   * -------------------------------------------------------- */
  app.post("/api/v1/console/items/export", { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = ItemExportRequest.safeParse(req.body);
    if (!body.success) throw errors.badRequest("Choose at least one item to export.");

    const { rows } = await app.db.query(
      `select slug, stage_id, objective_id, type::text as type, bloom, target_difficulty,
              stem_template, solver_ref, correct_spec, distractor_pool, rationale_template
         from items where id = any($1::uuid[])
        order by stage_id, slug, version desc`,
      [body.data.ids],
    );

    return reply.send({
      format: ITEM_FILE_FORMAT,
      exportedAt: new Date().toISOString(),
      items: rows.map((r) => toAuthored(r.slug as string, rowFields(r))),
    });
  });
}
