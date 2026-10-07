import { timingSafeEqual, createHash } from "node:crypto";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type pg from "pg";
import type { AssistantStepKind } from "@octa/contracts/assistant";
import { errors } from "../errors.js";
import type { Env } from "../env.js";

/**
 * POST /internal/assistant/tick (plan §4-now; db/addendum-assistant-tick.sql).
 *
 * Called by Supabase Cron through pg_net once a minute, and only while some
 * assistant job is running, with `x-cron-secret: <CRON_SECRET>`. It claims the
 * next waiting step of a running job, answers 202 at once, and runs that step
 * after replying, so pg_net's short timeout never cuts a model call off.
 *
 * Memory (§4a): a step's state is saved before the call (claimed: running,
 * attempt counted) and after it (done / waiting / failed, with engine, model,
 * tokens, time, cost). A step left `running` by a sleep, a redeploy or a crash
 * is put back to waiting once its lease has passed, and runs again.
 *
 * B3 builds the tick and the claim; the step handlers (what a "section" or a
 * "figure_summary" step sends and checks) are B5's. Until a kind has one, its
 * step fails, saying so. No route creates a job yet (B4), so on the deployment
 * nothing is running and cron never calls this.
 */

/** A step running longer than this is presumed dead and resumed. */
export const LEASE_MINUTES = 15;

export interface ClaimedStep {
  id: string;
  jobId: string;
  ownerId: string;
  course: string;
  seq: number;
  kind: AssistantStepKind;
  idempotencyKey: string;
  attempts: number;
  chain: string[];
}

export interface StepOutcome {
  status: "done" | "waiting" | "failed";
  engine?: string;
  model?: string;
  keyId?: string | null;
  output?: unknown;
  error?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  ms?: number;
  costUsd?: number | null;
}

export type StepHandler = (step: ClaimedStep) => Promise<StepOutcome>;

/** Resumes stale steps, then claims one. Null when there is nothing to do. */
export async function claimNext(db: pg.Pool): Promise<{ claimed: ClaimedStep | null; resumed: number }> {
  const resumed = await db.query(
    `update assistant_steps s
        set status = 'waiting', started_at = null
       from assistant_jobs j
      where j.id = s.job_id and j.status = 'running'
        and s.status = 'running' and s.started_at < now() - make_interval(mins => $1)`,
    [LEASE_MINUTES],
  );
  // `running` must name an engine and a model (as_ran_on_something). Until the
  // chain has chosen, the step names the chain's first engine and says the model
  // is not chosen; the result overwrites both with what actually ran.
  const r = await db.query(
    `with next as (
       select s.id, j.engines
         from assistant_steps s
         join assistant_jobs j on j.id = s.job_id
        where j.status = 'running' and s.status = 'waiting'
        order by j.updated_at, j.id, s.seq
        limit 1
        for update of s skip locked
     )
     update assistant_steps s
        set status = 'running', started_at = now(), attempts = s.attempts + 1,
            engine = coalesce(next.engines[1], 'claude_api'), model = '(choosing)'
       from next
      where s.id = next.id
     returning s.id::text, s.job_id::text, s.owner_id::text, s.course, s.seq, s.kind,
               s.idempotency_key, s.attempts, next.engines`,
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return {
    resumed: resumed.rowCount ?? 0,
    claimed: row
      ? {
          id: row.id as string, jobId: row.job_id as string, ownerId: row.owner_id as string,
          course: row.course as string, seq: row.seq as number, kind: row.kind as AssistantStepKind,
          idempotencyKey: row.idempotency_key as string, attempts: row.attempts as number,
          chain: (row.engines as string[] | null) ?? [],
        }
      : null,
  };
}

/** Saves what the step came to, then closes the job if it has no work left. */
export async function settle(db: pg.Pool, step: ClaimedStep, o: StepOutcome): Promise<void> {
  if (o.status === "waiting") {
    await db.query(
      `update assistant_steps set status = 'waiting', started_at = null, error = $2 where id = $1`,
      [step.id, o.error === undefined ? null : JSON.stringify(o.error)],
    );
  } else {
    await db.query(
      `update assistant_steps
          set status = $2, engine = coalesce($3, engine), model = coalesce($4, model), key_id = $5,
              output = $6, error = $7, tokens_in = $8, tokens_out = $9, ms = $10, cost_usd = $11,
              finished_at = now()
        where id = $1`,
      [
        step.id, o.status, o.engine ?? null, o.model ?? null, o.keyId ?? null,
        o.output === undefined ? null : JSON.stringify(o.output),
        o.error === undefined ? null : JSON.stringify(o.error),
        o.tokensIn ?? null, o.tokensOut ?? null, o.ms ?? null, o.costUsd ?? null,
      ],
    );
  }
  await db.query(
    `update assistant_jobs j
        set status = case when exists (select 1 from assistant_steps s where s.job_id = j.id and s.status = 'failed')
                          then 'failed' else 'done' end,
            updated_at = now()
      where j.id = $1 and j.status = 'running'
        and not exists (select 1 from assistant_steps s where s.job_id = j.id and s.status in ('waiting','running'))`,
    [step.jobId],
  );
  await db.query(`update assistant_jobs set updated_at = now() where id = $1 and status = 'running'`, [step.jobId]);
}

/** B5 fills this. A kind with no handler fails its step, saying why. */
export const HANDLERS: Partial<Record<AssistantStepKind, StepHandler>> = {};

export async function runStep(db: pg.Pool, step: ClaimedStep, handlers: Partial<Record<AssistantStepKind, StepHandler>>, log: FastifyBaseLogger): Promise<StepOutcome> {
  const handler = handlers[step.kind];
  let outcome: StepOutcome;
  if (!handler) {
    outcome = { status: "failed", error: { code: "no_handler", message: `no handler for "${step.kind}" steps yet (plan §9 B5)` } };
  } else {
    try {
      outcome = await handler(step);
    } catch (e) {
      // A handler's own bug: the step fails, saying so; the message only, never a stack.
      log.error({ step: step.id, kind: step.kind }, "assistant step handler threw");
      outcome = { status: "failed", error: { code: "handler_error", message: e instanceof Error ? e.message.slice(0, 300) : "handler failed" } };
    }
  }
  await settle(db, step, outcome);
  return outcome;
}

function secretMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== "string" || given.length === 0) return false;
  // Hash both so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function registerAssistantTick(
  app: FastifyInstance,
  env: Env,
  handlers: Partial<Record<AssistantStepKind, StepHandler>> = HANDLERS,
): void {
  if (!env.CRON_SECRET) app.log.warn("CRON_SECRET not set: /internal/assistant/tick refuses every call");
  let busy = false;

  app.post("/internal/assistant/tick", {
    config: { rateLimit: { max: 30 * app.limitScale, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!secretMatches(req.headers["x-cron-secret"], env.CRON_SECRET)) throw errors.unauthorized("Not allowed.");
    if (busy) return reply.status(202).send({ claimed: null, busy: true });
    const { claimed, resumed } = await claimNext(app.db);
    if (!claimed) return reply.status(202).send({ claimed: null, resumed });
    busy = true;
    reply.status(202).send({ claimed: claimed.id, kind: claimed.kind, resumed });
    // After the reply: the model call may take a minute and a half.
    void runStep(app.db, claimed, handlers, req.log)
      .catch(() => req.log.error({ step: claimed.id }, "assistant step could not be settled; its lease will resume it"))
      .finally(() => {
        busy = false;
      });
    return reply;
  });
}
