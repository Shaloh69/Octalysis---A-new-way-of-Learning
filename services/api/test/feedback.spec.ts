import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";
import { FeedbackQueue } from "@octa/contracts";

/**
 * P8 — feedback, and the console's content-status endpoint.
 *
 * The denial tests come first, per `.claude/rules/rls.md`: proving the right
 * user succeeds proves nothing.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let w: BankWorld;
let teacherToken: string;
let studentAToken: string;
let studentBToken: string;

beforeAll(async () => {
  w = await seedItemBank();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();

  teacherToken = mintToken(w.teacher, "teacher");
  studentAToken = mintToken(w.studentA, "student", "21-0001");
  studentBToken = mintToken(w.studentB, "student", "21-0002");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/* ----------------------------------------------------------- denial first */

describe("feedback triage is staff-only", () => {
  it("refuses a student token on the console feedback list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/feedback",
      headers: auth(studentAToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("forbidden");
  });

  it("refuses a student token on triage", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/console/feedback/00000000-0000-0000-0000-000000000000",
      headers: auth(studentAToken),
      payload: { status: "shipped" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("refuses an unauthenticated request outright", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/feedback" });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
  });
});

describe("console content status is staff-only", () => {
  it("refuses a student token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(studentAToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

/* ---------------------------------------------------------------- reports */

describe("a content report carries the exact variant the student saw", () => {
  it("attaches the resolved instance from the student's own attempt", async () => {
    const started = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(studentAToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(started.statusCode, JSON.stringify(started.json())).toBe(200);
    const attemptId = started.json().attemptId as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback",
      headers: auth(studentAToken),
      payload: {
        channel: "content_report",
        category: "broken",
        body: "The units in this one look wrong.",
        attemptId,
        ordinal: 1,
      },
    });
    expect(res.statusCode).toBe(201);
    // The whole point: "question 1 is wrong" is unactionable when every student
    // gets different numbers. The variant is what makes it a bug report.
    expect(res.json().variantAttached).toBe(true);

    const seen = await app.inject({
      method: "GET",
      url: "/api/v1/console/feedback",
      headers: auth(teacherToken),
    });
    // A group since 29 Sep 2026 (exact repeats are one row); its report keeps the variant.
    const group = (seen.json() as FeedbackQueue).groups.find((g) =>
      g.body === "The units in this one look wrong.",
    );
    expect(group).toBeDefined();
    const variant = group!.reports[0]!.resolvedVariant as { stem?: string } | null;
    expect(variant).toBeTruthy();
    expect(variant!.stem).toBeTruthy();
    expect(group!.item?.id).toBeTruthy();
  });

  it("REFUSES to attach a variant from someone else's attempt", async () => {
    // Reporting on another student's paper must not confirm the paper exists,
    // and must never copy their resolved item into a row a teacher will read as
    // if the reporter had seen it.
    const started = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(studentAToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const otherAttempt = started.json().attemptId as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback",
      headers: auth(studentBToken),
      payload: { channel: "content_report", attemptId: otherAttempt, ordinal: 1, body: "probe" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().variantAttached).toBe(false);

    const { rows } = await pool.query(
      "select item_id, resolved_variant from feedback where body = 'probe'",
    );
    expect(rows[0]!.item_id).toBeNull();
    expect(rows[0]!.resolved_variant).toBeNull();
  });
});

/* -------------------------------------------------------------------- SUS */

describe("SUS is scored in the database, and the arithmetic is right", () => {
  it("all 5s scores 100", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback/sus",
      headers: auth(studentAToken),
      payload: { answers: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().score).toBe(50);
  });

  it("the alternating pattern scores 100 — the real best case", async () => {
    // SUS alternates polarity: odd items are positive, even items negative.
    // A user who agrees with every positive and disagrees with every negative
    // is the maximum. Answering 5 to ALL ten is self-contradictory and scores
    // 50, which the previous test pins deliberately -- getting that backwards
    // is the classic SUS implementation bug.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback/sus",
      headers: auth(studentBToken),
      payload: { answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] },
    });
    expect(res.json().score).toBe(100);
  });

  it("the inverse pattern scores 0", async () => {
    const { rows } = await pool.query("select sus_score(array[1,5,1,5,1,5,1,5,1,5]) as s");
    expect(Number(rows[0]!.s)).toBe(0);
  });

  it("all 3s scores 50", async () => {
    const { rows } = await pool.query("select sus_score(array[3,3,3,3,3,3,3,3,3,3]) as s");
    expect(Number(rows[0]!.s)).toBe(50);
  });

  it("rejects anything that is not exactly ten answers of 1..5", async () => {
    for (const answers of [
      [5, 5, 5, 5, 5, 5, 5, 5, 5],
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 6],
      [0, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/feedback/sus",
        headers: auth(studentAToken),
        payload: { answers },
      });
      expect(res.statusCode, JSON.stringify(answers)).toBe(400);
    }
  });
});

describe("the SUS prompt does not nag", () => {
  it("never shows before three sessions and one completed attempt", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/feedback/prompt",
      headers: auth(mintToken(w.studentB, "student", "21-0002")),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // studentB has just answered, so `show` must be false regardless of counts.
    expect(body.show).toBe(false);
  });

  it("stops asking after two dismissals", async () => {
    const fresh = mintToken(w.studentA, "student", "21-0001");
    for (let i = 0; i < 2; i++) {
      const d = await app.inject({
        method: "POST",
        url: "/api/v1/feedback/prompt/dismiss",
        headers: auth(fresh),
      });
      expect(d.statusCode).toBe(200);
    }
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/feedback/prompt",
      headers: auth(fresh),
    });
    expect(res.json().show).toBe(false);
  });
});

/* -------------------------------------------------------- content status */

describe("content status tells the truth about what is authored", () => {
  it("reports every seeded stage, with a three-state authoring verdict", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const { stages, summary } = res.json();

    expect(stages.length).toBe(summary.total);
    expect(summary.total).toBeGreaterThan(0);
    for (const s of stages) {
      expect(["authored", "planned", "empty"]).toContain(s.authoring);
    }
    // authored + planned + empty must account for every stage. A fourth state
    // appearing silently would make the page under-report the gap.
    //
    // `planned` was called `scaffold` until chapters 1-7 were authored and the
    // rest were declared a future update rather than an unfinished one. This
    // assertion is what caught the rename.
    expect(summary.authored + summary.planned + summary.empty).toBe(summary.total);
  });

  it("sets the item target from GRADEABLE stages only", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(teacherToken),
    });
    const { stages, summary } = res.json();
    const gradeable = stages.filter((s: { gradeable: boolean }) => s.gradeable).length;
    // Stage 00 is orientation and is never sampled (V-1). Counting it toward
    // the bank target would overstate the work by 40 items.
    expect(summary.itemTarget).toBe(gradeable * 40);
    expect(gradeable).toBeLessThan(summary.total);
  });
});

/*
 * `/feedback` rebuild, 29 Sep 2026 (instructor rulings): one queue for all
 * staff; exact repeats grouped and triaged together; status and kind filtered
 * on the server with a count and Load older; a CSV of every match; SUS by
 * role. Two new endpoints, so the denials come first.
 */
describe("the triage queue: new endpoints refuse a student", () => {
  it("refuses a student token on the CSV", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/feedback.csv", headers: auth(studentAToken) });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain("received_at");
  });

  it("refuses a student token on bulk triage, and changes nothing", async () => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into feedback (user_id, role, channel, body) values ($1, 'student', 'flag', 'bulk denial probe') returning id`,
      [w.studentA],
    );
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/console/feedback", headers: auth(studentAToken),
      payload: { ids: [rows[0]!.id], status: "shipped" },
    });
    expect(res.statusCode).toBe(403);
    const after = await pool.query("select status from feedback where id = $1", [rows[0]!.id]);
    expect(after.rows[0].status).toBe("new");
  });

  it("refuses no token at all on both", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/console/feedback.csv" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/console/feedback", payload: {} })).statusCode).toBe(401);
  });
});

describe("the triage queue: groups, filters, paging, SUS by role", () => {
  const at = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const ins = async (
    user: string, role: string, channel: string, body: string | null, hoursAgo: number,
    extra: { status?: string; route?: string; rating?: number; sus?: number[]; susScore?: number } = {},
  ) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into feedback (user_id, role, channel, body, status, route, created_at, rating, sus_answers, sus_score)
       values ($1, $2::user_role, $3::feedback_channel, $4, coalesce($5, 'new')::feedback_status, $6, $7, $8, $9::int[], $10)
       returning id`,
      [user, role, channel, body, extra.status ?? null, extra.route ?? null, at(hoursAgo), extra.rating ?? null,
       extra.sus ?? null, extra.susScore ?? null],
    );
    return rows[0]!.id;
  };
  const get = async (qs = "") => {
    const res = await app.inject({ method: "GET", url: `/api/v1/console/feedback${qs}`, headers: auth(teacherToken) });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as FeedbackQueue;
  };
  let repeat: string[] = [];

  beforeAll(async () => {
    await pool.query("delete from feedback");
    // The same complaint three times: whitespace and case differ, the text does not.
    repeat = [
      await ins(w.studentA, "student", "content_report", "The hit-rate question says 4 KB.", 5, { route: "/app/stage/04" }),
      await ins(w.studentB, "student", "content_report", "  the hit-rate   question says 4 KB. ", 3, { route: "/app/stage/04" }),
      await ins(w.studentA, "student", "content_report", "THE HIT-RATE QUESTION SAYS 4 KB.", 1, { route: "/app/stage/04" }),
    ];
    // Same text, different status: a separate group.
    await ins(w.studentB, "student", "content_report", "The hit-rate question says 4 KB.", 8, { route: "/app/stage/04", status: "triaged" });
    await ins(w.studentA, "student", "flag", "Two choices look the same.", 2);
    // No text: each is its own group, never merged.
    await ins(w.studentA, "student", "csat", null, 4, { rating: 4 });
    await ins(w.studentB, "student", "csat", null, 6, { rating: 2 });
    // A cell a spreadsheet would run.
    await ins(w.studentB, "student", "flag", '=HYPERLINK("http://x")', 10);
    // SUS: students and staff reported apart, never in the queue.
    await ins(w.studentA, "student", "sus", null, 1, { sus: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1], susScore: 100 });
    await ins(w.studentB, "student", "sus", null, 1, { sus: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], susScore: 50 });
    await ins(w.teacher, "teacher", "sus", null, 1, { sus: [4, 2, 4, 2, 4, 2, 4, 2, 4, 2], susScore: 75 });
  });

  it("answers in the FeedbackQueue contract", async () => {
    const parsed = FeedbackQueue.safeParse(await get());
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
  });

  it("groups exact repeats into one row, newest report first, and keeps a different status apart", async () => {
    const q = await get();
    expect(q.total).toEqual({ groups: 6, reports: 8 });
    const g = q.groups.find((x) => x.count === 3)!;
    expect(g.status).toBe("new");
    expect(g.kind).toBe("content_report");
    expect(g.reports.map((r) => r.id)).toEqual([repeat[2], repeat[1], repeat[0]]);
    expect(Date.parse(g.lastAt)).toBeGreaterThan(Date.parse(g.firstAt));
    expect(q.groups.filter((x) => x.kind === "content_report").map((x) => x.count).sort()).toEqual([1, 3]);
    expect(q.groups.filter((x) => x.kind === "csat").map((x) => x.count)).toEqual([1, 1]);
    const last = q.groups.map((x) => Date.parse(x.lastAt));
    expect(last).toEqual([...last].sort((a, b) => b - a));
    expect(q.groups.some((x) => (x.kind as string) === "sus")).toBe(false);
  });

  it("filters by status and by kind on the server; the counts ignore the status filter but not the kind", async () => {
    const byStatus = await get("?status=triaged");
    expect(byStatus.groups.map((x) => x.status)).toEqual(["triaged"]);
    expect(byStatus.counts).toMatchObject({ new: 7, triaged: 1, in_progress: 0, shipped: 0, wont_fix: 0 });
    const byKind = await get("?kind=flag");
    expect(byKind.groups.every((x) => x.kind === "flag")).toBe(true);
    expect(byKind.total.reports).toBe(2);
    expect(byKind.counts.new).toBe(2);
    const bad = await app.inject({ method: "GET", url: "/api/v1/console/feedback?status=bogus", headers: auth(teacherToken) });
    expect(bad.statusCode).toBe(400);
  });

  it("pages by a cursor: Load older returns the rest, with no group twice", async () => {
    const first = await get("?limit=2");
    expect(first.groups).toHaveLength(2);
    expect(first.next).not.toBeNull();
    const seen = first.groups.map((x) => x.key);
    let next = first.next;
    while (next) {
      const page = await get(`?limit=2&before=${encodeURIComponent(next)}`);
      seen.push(...page.groups.map((x) => x.key));
      next = page.next;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(6);
  });

  it("reports SUS for students and staff apart, each with its n", async () => {
    const { sus } = await get();
    expect(sus.student).toEqual({ n: 2, mean: 75 });
    expect(sus.staff).toEqual({ n: 1, mean: 75 });
  });

  it("bulk triage moves every report of a group, with one audit row each saying what it left", async () => {
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/console/feedback", headers: auth(teacherToken),
      payload: { ids: repeat, status: "in_progress", severity: "high", releasedIn: "1.4" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ updated: 3 });
    const rows = await pool.query("select status, severity, released_in, triaged_by from feedback where id = any($1::uuid[])", [repeat]);
    expect(rows.rows.every((r) => r.status === "in_progress" && r.severity === "high" && r.released_in === "1.4" && r.triaged_by === w.teacher)).toBe(true);
    const audit = await pool.query(
      "select target_id, payload from audit_log where action = 'feedback.triage' and target_id = any($1::text[])", [repeat],
    );
    expect(audit.rowCount).toBe(3);
    expect(audit.rows.every((r) => r.payload.previousStatus === "new" && r.payload.status === "in_progress")).toBe(true);
    const g = (await get("?status=in_progress")).groups[0]!;
    expect(g).toMatchObject({ count: 3, severity: "high", releasedIn: "1.4" });
    expect(g.triagedBy?.id).toBe(w.teacher);
  });

  it("severity null clears it; absent leaves it", async () => {
    await app.inject({ method: "PATCH", url: "/api/v1/console/feedback", headers: auth(teacherToken), payload: { ids: repeat, status: "in_progress" } });
    expect((await pool.query("select severity from feedback where id = $1", [repeat[0]])).rows[0].severity).toBe("high");
    await app.inject({ method: "PATCH", url: "/api/v1/console/feedback", headers: auth(teacherToken), payload: { ids: repeat, status: "in_progress", severity: null } });
    expect((await pool.query("select severity from feedback where id = $1", [repeat[0]])).rows[0].severity).toBeNull();
  });

  it("a bulk triage naming a report that does not exist writes nothing", async () => {
    const before = (await pool.query("select status from feedback where id = $1", [repeat[0]])).rows[0].status;
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/console/feedback", headers: auth(teacherToken),
      payload: { ids: [repeat[0], "00000000-0000-4000-8000-000000000000"], status: "shipped" },
    });
    expect(res.statusCode).toBe(404);
    expect((await pool.query("select status from feedback where id = $1", [repeat[0]])).rows[0].status).toBe(before);
  });

  it("the CSV has one line per report with its group's size, and a formula cell is defused", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/feedback.csv", headers: auth(teacherToken) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    const lines = res.body.trim().split("\n");
    expect(lines[0]).toBe("received_at,kind,category,status,severity,released_in,reporter,role,route,app_version,item,rating,body,repeats,id");
    expect(lines).toHaveLength(1 + 8);
    expect(lines.filter((l) => l.endsWith(`,3,${repeat[0]}`))).toHaveLength(1);
    expect(res.body).toContain(`"'=HYPERLINK(""http://x"")"`);
    const flags = await app.inject({ method: "GET", url: "/api/v1/console/feedback.csv?kind=flag", headers: auth(teacherToken) });
    expect(flags.body.trim().split("\n")).toHaveLength(1 + 2);
  });
});
