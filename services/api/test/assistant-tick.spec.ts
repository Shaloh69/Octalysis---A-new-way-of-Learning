import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { claimNext, HANDLERS, LEASE_MINUTES, type StepHandler } from "../src/assistant/tick.js";
import { KeysNotConfigured, listKeys, openKeys, putKey } from "../src/assistant/keys.js";
import { authenticated, closePool, runAs, setup, CONNECTION_STRING } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The assistant's tick and its key store (plan §9 B3; db/addendum-assistant-tick.sql;
 * .claude/rules/assistant.md "Keys", "The API calls the engines").
 *
 * Denials, each with its positive control:
 *   - /internal/assistant/tick refuses a call with no secret, a wrong secret,
 *     and every call when the server has no CRON_SECRET;
 *   - no client role may call assistant_tick() or assistant_tick_due();
 *   - a sealed key copied onto another teacher's row does not open;
 *   - with no ASSISTANT_KEY_SECRET no key is stored or opened.
 * And the tick's own rules: it claims only a RUNNING job's steps, one per
 * claim (skip locked), resumes a step whose lease ran out, records what ran,
 * and closes the job when its last step settles.
 *
 * Hard rule 8: watched red first (8 Oct 2026), see the session record.
 */

const CRON = "cron-secret-for-tests-0123456789";
const KEYSECRET = "k".repeat(48);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

let w: World;
let app: FastifyInstance;
let bare: FastifyInstance;
let db: pg.Pool;
let teacherB = "";
let book = "";
let ran: string[] = [];

const section: StepHandler = async (s) => {
  ran.push(s.id);
  return { status: "done", engine: "groq", model: "openai/gpt-oss-120b", output: { text: "drafted" }, tokensIn: 900, tokensOut: 120, ms: 4200, costUsd: null };
};

function env(extra: Record<string, string> = {}) {
  return loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? CONNECTION_STRING,
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: "test-secret-at-least-32-characters-long-000000",
    ...extra,
  } as NodeJS.ProcessEnv);
}

async function job(status: string, kinds: string[], engines = "{groq,cloudflare}"): Promise<{ job: string; steps: string[] }> {
  const j = await setup(
    `insert into assistant_jobs (book_id, owner_id, course, chapter, kind, status, engines)
     values ($1, $2, 'CPE 412', 15, 'chapter', $3, $4::text[]) returning id::text`,
    [book, w.teacher, status, engines],
  );
  const id = j.rows[0].id as string;
  const steps: string[] = [];
  for (const [i, kind] of kinds.entries()) {
    const s = await setup(
      `insert into assistant_steps (job_id, owner_id, course, seq, kind, idempotency_key)
       values ($1, $2, 'CPE 412', $3, $4, $5) returning id::text`,
      [id, w.teacher, i, kind, `${id}:${i}`],
    );
    steps.push(s.rows[0].id as string);
  }
  return { job: id, steps };
}

const tick = (headers: Record<string, string> = { "x-cron-secret": CRON }, on = app) =>
  on.inject({ method: "POST", url: "/internal/assistant/tick", headers });

async function settled(stepId: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 100; i++) {
    const r = await setup(`select * from assistant_steps where id = $1`, [stepId]);
    if (r.rows[0].status !== "running") return r.rows[0] as Record<string, unknown>;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error("step never settled");
}
const jobStatus = async (id: string) => (await setup(`select status from assistant_jobs where id = $1`, [id])).rows[0].status as string;

beforeAll(async () => {
  w = await resetWorld();
  const tb = await setup(
    `insert into auth.users (id, email, raw_app_meta_data)
     values (gen_random_uuid(), 'tick-b@octa-test.local', '{"role":"teacher"}'::jsonb) returning id::text`,
  );
  teacherB = tb.rows[0].id as string;
  await setup(`insert into profiles (id, full_name, role) values ($1, 'Tick Teacher B', 'teacher'::user_role)`, [teacherB]);
  const b = await setup(
    `insert into assistant_books (owner_id, course, title, pdf_sha256) values ($1, 'CPE 412', 'Stallings 10e', $2) returning id::text`,
    [w.teacher, sha("tick book")],
  );
  book = b.rows[0].id as string;

  app = await buildServer(env({ CRON_SECRET: CRON, ASSISTANT_KEY_SECRET: KEYSECRET }));
  await app.ready();
  // A second server with no CRON_SECRET: the tick must refuse everything.
  bare = await buildServer(env());
  await bare.ready();
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? CONNECTION_STRING, max: 4 });
});

beforeEach(async () => {
  ran = [];
  await setup(`delete from assistant_jobs where true`);
  await setup(`delete from assistant_engine_keys where true`);
});

afterAll(async () => {
  await app?.close();
  await bare?.close();
  await db?.end();
  await closePool();
});

/* -------------------------------------------------------------- the route */

describe("POST /internal/assistant/tick: who may call it", () => {
  it("DENIES a call with no secret", async () => {
    await job("running", ["section"]);
    const r = await tick({});
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: { code: "unauthorized", message: "Not allowed." } });
  });

  it("DENIES a wrong secret, and claims nothing", async () => {
    const { steps } = await job("running", ["section"]);
    expect((await tick({ "x-cron-secret": `${CRON}x` })).statusCode).toBe(401);
    expect((await tick({ "x-cron-secret": CRON.slice(0, -1) })).statusCode).toBe(401);
    expect((await setup(`select status from assistant_steps where id = $1`, [steps[0]])).rows[0].status).toBe("waiting");
  });

  it("DENIES every call when the server has no CRON_SECRET, even one bearing a secret", async () => {
    await job("running", ["section"]);
    expect((await tick({ "x-cron-secret": CRON }, bare)).statusCode).toBe(401);
    expect((await tick({ "x-cron-secret": "" }, bare)).statusCode).toBe(401);
  });

  it("positive control: the right secret is accepted (202) and, with nothing running, claims nothing", async () => {
    await job("waiting", ["section"]);
    const r = await tick();
    expect(r.statusCode).toBe(202);
    expect(r.json()).toMatchObject({ claimed: null });
  });
});

/* -------------------------------------------------------------- the claim */

describe("the tick's claim", () => {
  it("claims a RUNNING job's step, never a waiting or paused job's", async () => {
    await job("waiting", ["section"]);
    await job("paused", ["section"]);
    const live = await job("running", ["section"]);
    const r = await tick();
    expect(r.json()).toMatchObject({ claimed: live.steps[0], kind: "section" });
  });

  it("a kind with no handler yet fails its step, saying so, and closes the job as failed", async () => {
    const { job: id, steps } = await job("running", ["figure_summary"]);
    expect((await tick()).json()).toMatchObject({ claimed: steps[0] });
    const s = await settled(steps[0]!);
    expect(s).toMatchObject({ status: "failed", attempts: 1 });
    expect(s.error).toMatchObject({ code: "no_handler" });
    expect(await jobStatus(id)).toBe("failed");
  });

  it("records what ran (engine, model, tokens, time) and closes the job when its last step is done", async () => {
    // A "section" handler, as B5 will register one; removed again below.
    HANDLERS.section = section;
    const { job: id, steps } = await job("running", ["section", "section"]);
    await tick();
    const first = await settled(steps[0]!);
    expect(first).toMatchObject({ status: "done", engine: "groq", model: "openai/gpt-oss-120b", tokens_in: 900, tokens_out: 120, ms: 4200 });
    expect(first.output).toEqual({ text: "drafted" });
    expect(await jobStatus(id)).toBe("running");
    await tick();
    await settled(steps[1]!);
    expect(ran).toEqual(steps);
    expect(await jobStatus(id)).toBe("done");
    delete HANDLERS.section;
  });

  it("two claims at once take two different steps (skip locked)", async () => {
    const { steps } = await job("running", ["section", "section"]);
    const [a, b] = await Promise.all([claimNext(db), claimNext(db)]);
    expect(new Set([a.claimed?.id, b.claimed?.id])).toEqual(new Set(steps));
  });

  it("a claimed step names an engine and a model, as the schema requires of `running`", async () => {
    const { steps } = await job("running", ["section"], "{ollama_cloud,groq}");
    const { claimed } = await claimNext(db);
    expect(claimed).toMatchObject({ id: steps[0], chain: ["ollama_cloud", "groq"], attempts: 1 });
    const row = (await setup(`select status, engine, model from assistant_steps where id = $1`, [steps[0]])).rows[0];
    expect(row).toEqual({ status: "running", engine: "ollama_cloud", model: "(choosing)" });
  });

  it("resumes a step whose lease ran out (a sleep, a redeploy, a crash), and runs it again", async () => {
    const { steps } = await job("running", ["section"]);
    await setup(
      `update assistant_steps set status = 'running', engine = 'groq', model = 'm', attempts = 1,
              started_at = now() - make_interval(mins => $2) where id = $1`,
      [steps[0], LEASE_MINUTES + 1],
    );
    const r = await claimNext(db);
    expect(r.resumed).toBe(1);
    expect(r.claimed).toMatchObject({ id: steps[0], attempts: 2 });
  });

  it("leaves a step inside its lease alone", async () => {
    const { steps } = await job("running", ["section"]);
    await setup(
      `update assistant_steps set status = 'running', engine = 'groq', model = 'm', started_at = now() - interval '2 minutes' where id = $1`,
      [steps[0]],
    );
    expect(await claimNext(db)).toEqual({ claimed: null, resumed: 0 });
  });
});

/* ------------------------------------------------------- the SQL functions */

describe("assistant_tick() and assistant_tick_due()", () => {
  it("is due only while a job is running", async () => {
    await job("waiting", ["section"]);
    expect((await setup(`select assistant_tick_due() as d`)).rows[0].d).toBe(false);
    await job("running", ["section"]);
    expect((await setup(`select assistant_tick_due() as d`)).rows[0].d).toBe(true);
  });

  it("calls nothing on a database without pg_net or Vault (local Docker), even with a job running", async () => {
    await job("running", ["section"]);
    expect((await setup(`select assistant_tick() as id`)).rows[0].id).toBeNull();
  });

  it("DENIES a teacher calling either function; the owner (cron) may", async () => {
    await job("running", ["section"]);
    const asTeacher = authenticated(w.teacher, "teacher");
    const t1 = await runAs(asTeacher, `select assistant_tick()`);
    const t2 = await runAs(asTeacher, `select assistant_tick_due()`);
    expect(t1.error?.code).toBe("42501");
    expect(t2.error?.code).toBe("42501");
    expect((await setup(`select assistant_tick_due() as d`)).rows[0].d).toBe(true);
  });
});

/* -------------------------------------------------------------- the keys */

describe("the key store", () => {
  it("stores sealed bytes and the last four, never the key; opens it for its owner", async () => {
    const key = "gsk_live_abcdefghijklmnop1234";
    const s = await putKey(db, KEYSECRET, w.teacher, "groq", key);
    expect(s).toMatchObject({ engine: "groq", last4: "1234" });
    const row = (await setup(`select sealed, last4 from assistant_engine_keys where owner_id = $1`, [w.teacher])).rows[0];
    expect((row.sealed as Buffer).toString("latin1")).not.toContain(key);
    expect(row.last4).toBe("1234");
    expect(await listKeys(db, w.teacher)).toEqual([{ engine: "groq", last4: "1234", updatedAt: s.updatedAt }]);
    const opened = await openKeys(db, KEYSECRET, w.teacher);
    expect(opened.keys.groq?.key).toBe(key);
    expect(opened.unopened).toEqual([]);
  });

  it("DENIES teacher B a key copied from teacher A's row", async () => {
    await putKey(db, KEYSECRET, w.teacher, "groq", "gsk_teacher_A_key_000000");
    await setup(
      `insert into assistant_engine_keys (owner_id, engine, sealed, last4)
       select $2, engine, sealed, last4 from assistant_engine_keys where owner_id = $1`,
      [w.teacher, teacherB],
    );
    const b = await openKeys(db, KEYSECRET, teacherB);
    expect(b.keys.groq).toBeUndefined();
    expect(b.unopened).toEqual(["groq"]);
    // Positive control: A's own row still opens.
    expect((await openKeys(db, KEYSECRET, w.teacher)).keys.groq?.key).toBe("gsk_teacher_A_key_000000");
  });

  it("DENIES storing or opening any key without ASSISTANT_KEY_SECRET", async () => {
    await expect(putKey(db, undefined, w.teacher, "groq", "gsk_x_000000000000")).rejects.toBeInstanceOf(KeysNotConfigured);
    await expect(openKeys(db, undefined, w.teacher)).rejects.toBeInstanceOf(KeysNotConfigured);
    expect((await setup(`select count(*)::int n from assistant_engine_keys`)).rows[0].n).toBe(0);
  });
});
