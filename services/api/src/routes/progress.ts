import type { FastifyInstance } from "fastify";
import { identityFrom, requireStaff } from "../auth.js";
import type { Env } from "../env.js";
import { authoringOf } from "./content.js";

/**
 * GET /api/v1/console/progress   (staff)
 *
 * The live half of the console's /changelog (instructor, 7 Oct 2026, night:
 * "all the progress of the entire system"): whether Prelim-worth of data is
 * fit to run on students, by the five conditions of CLAUDE.md "Where we are".
 * The build phases and the planned work come from the repository, at build
 * time (scripts/changelog.mjs); only what the database knows is asked here.
 *
 * Each condition says HOW it is known. Three are measured here; one is proved
 * by `bank-feasibility.spec.ts` (the authored bank fills the Prelim and the
 * four checks, so it holds once that bank is live); one only a person can
 * check (a real student reads, sits a check, sees the next unlock).
 * `measuredOk` is never called "ready": the page says what is unmeasured.
 */
export function registerProgressRoutes(app: FastifyInstance, env: Env): void {
  app.get("/api/v1/console/progress", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const stages = await app.db.query(
      `select s.id, s.title,
              (select count(*)::int from content_blocks cb where cb.stage_id = s.id) as blocks,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.meta->>'kind' in ('scaffold','planned')) as scaffold_blocks
         from stages s where s.act = 1 order by s.ordinal`,
    );
    // The act-1 bank: every current question of stages 01-04, live or not.
    // Retired versions are history, not bank.
    const bank = await app.db.query(
      `select count(*) filter (where i.status = 'live')::int as live,
              count(*) filter (where i.status <> 'retired')::int as bank,
              count(*) filter (where i.status = 'review')::int as review,
              count(*) filter (where i.status = 'draft')::int as draft
         from items i join stages s on s.id = i.stage_id where s.act = 1`,
    );
    const inv = await app.db.query(
      `select count(*) filter (where severity = 'fail' and offending_count::int > 0)::int as failures,
              count(*) filter (where severity = 'warn' and offending_count::int > 0)::int as warnings
         from run_invariants()`,
    );

    const st = stages.rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      authoring: authoringOf(Number(r.blocks), Number(r.scaffold_blocks)),
    }));
    const b = bank.rows[0]!;
    const act1 = { live: Number(b.live), bank: Number(b.bank), review: Number(b.review), draft: Number(b.draft) };
    const invariants = { failures: Number(inv.rows[0]!.failures), warnings: Number(inv.rows[0]!.warnings) };

    const authored = st.filter((s) => s.authoring === "authored").length;
    const itemsOk = act1.bank > 0 && act1.live === act1.bank;
    const conditions = [
      {
        id: "stages", how: "measured" as const, ok: st.length > 0 && authored === st.length,
        label: "Stages 00-04 authored and readable",
        detail: `${authored} of ${st.length} authored`,
      },
      {
        id: "items", how: "measured" as const, ok: itemsOk,
        label: "Act 1's questions approved to live",
        detail: `${act1.live} of ${act1.bank} live; ${act1.review} at review, ${act1.draft} draft`,
      },
      {
        id: "fill", how: "test" as const, ok: itemsOk,
        label: "The Prelim and the four stage checks fill",
        detail: itemsOk
          ? "the authored bank is live, and bank-feasibility.spec.ts proves it fills them"
          : "not until act 1's bank is live: a check samples live questions only",
      },
      {
        id: "student", how: "person" as const, ok: null,
        label: "A real student reads a stage, sits its check, and sees the next unlock",
        detail: "checked by a person on the deployment; not measured here",
      },
      {
        id: "invariants", how: "measured" as const, ok: invariants.failures === 0,
        label: "The database's invariants are clean",
        detail: `${invariants.failures} failures, ${invariants.warnings} warnings`,
      },
    ];

    return reply.send({
      checkedAt: new Date().toISOString(),
      prelim: {
        stages: st,
        act1,
        invariants,
        conditions,
        measuredOk: conditions.every((c) => c.how === "person" || c.ok === true),
      },
    });
  });
}
