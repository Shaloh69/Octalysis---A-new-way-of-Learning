import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * P7 — the item bank routes.
 *
 * The three refusals are the point of this file. An item bank whose UI lets you
 * edit a live item in place, or approve your own work, is a bank that will
 * eventually ship a wrong answer key to a real exam.
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
let adminToken: string;
let studentToken: string;
let adminUserId: string;

beforeAll(async () => {
  w = await seedItemBank();

  // A SECOND member of staff, so "you cannot approve your own item" is testable
  // rather than merely asserted.
  const { rows } = await pool.query(
    `insert into auth.users (id, email) values (gen_random_uuid(), 'octa-reviewer@octa-test.local')
     returning id`,
  );
  adminUserId = rows[0]!.id;
  await pool.query(
    `insert into profiles (id, full_name, role) values ($1, 'Second Reviewer', 'admin'::user_role)`,
    [adminUserId],
  );

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
  adminToken = mintToken(adminUserId, "admin");
  studentToken = mintToken(w.studentA, "student", "21-0001");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const DRAFT = {
  slug: "P-07-test-draft",
  stageId: "07",
  type: "S" as const,
  bloom: "understand" as const,
  stemTemplate: "Which mechanism lets a device write to memory without the CPU?",
  correctSpec: { value: "Direct memory access" },
  distractorPool: ["Programmed I/O", "Interrupt-driven I/O", "Memory-mapped I/O"],
};

/* ----------------------------------------------------------- denial first */

describe("the item bank is staff-only", () => {
  it("refuses a student on every item route", async () => {
    const calls = [
      app.inject({ method: "GET", url: "/api/v1/console/items", headers: auth(studentToken) }),
      app.inject({
        method: "POST", url: "/api/v1/console/items",
        headers: auth(studentToken), payload: DRAFT,
      }),
      app.inject({
        method: "PATCH",
        url: "/api/v1/console/items/00000000-0000-0000-0000-000000000000/status",
        headers: auth(studentToken), payload: { status: "live" },
      }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.statusCode).toBe(403);
    }
  });

  it("refuses a student the PREVIEW route, which carries the key", async () => {
    // The preview returns a fully resolved item including `correctValue`. It is
    // the single most dangerous route in the console, so it gets its own test.
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/items", headers: auth(teacherToken),
    });
    const anyItem = list.json().items[0];
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/console/items/${anyItem.id}/preview`,
      headers: auth(studentToken),
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.stringify(res.json())).not.toContain("correctValue");
  });
});

/* -------------------------------------------------------------- the bank */

describe("listing the bank", () => {
  it("returns items with psychometrics inline and never a resolved answer", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/items", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const { items, summary } = res.json();
    expect(items.length).toBeGreaterThan(0);
    expect(summary).toBeTruthy();

    for (const i of items) {
      expect(i.stats).toHaveProperty("exposures");
      expect(i.stats).toHaveProperty("pValue");
      expect(i.stats).toHaveProperty("discrimination");
    }
    // The LIST holds templates, not instances. A `{f}` slot is fine; a resolved
    // number with its answer beside it is not.
    const body = res.body;
    expect(body).not.toContain("correctValue");
    expect(body).not.toContain("correct_spec");
  });

  it("filters by stage and by status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/items?stageId=07&status=live",
      headers: auth(teacherToken),
    });
    const { items } = res.json();
    for (const i of items) {
      expect(i.stageId).toBe("07");
      expect(i.status).toBe("live");
    }
  });
});

describe("preview runs the REAL engine", () => {
  it("is deterministic: same seed, byte-identical instance", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/items?status=live", headers: auth(teacherToken),
    });
    const item = list.json().items[0];

    const a = await app.inject({
      method: "GET",
      url: `/api/v1/console/items/${item.id}/preview?seed=abc`,
      headers: auth(teacherToken),
    });
    const b = await app.inject({
      method: "GET",
      url: `/api/v1/console/items/${item.id}/preview?seed=abc`,
      headers: auth(teacherToken),
    });
    expect(a.body).toBe(b.body);
    expect(a.json().item.correctValue).toBeTruthy();
  });

  it("re-rolls: a parameterized item really does vary across seeds", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/items?status=live", headers: auth(teacherToken),
    });
    // Find a parameterized item -- static items legitimately resolve the same
    // stem every time, so seeding one proves nothing about re-rolling.
    const p = list.json().items.find((i: { type: string }) => i.type === "P");
    if (!p) return; // no P items seeded in this world

    /*
     * TWO SEEDS IS THE WRONG TEST, and this used to be two seeds.
     *
     * A parameter space is finite -- a bus-speed item might draw from eight
     * values -- so two independent draws collide roughly one run in eight, and
     * the suite failed intermittently with "expected X not to be X". A flaky
     * assertion in a project whose whole claim is that its gates are real is
     * worse than no assertion: it teaches you to re-run instead of read.
     *
     * The property actually wanted is not "these two differ" but "this item is
     * parameterized at all". Sample a dozen seeds and require more than one
     * distinct stem: true whenever the item varies, and false only when it is
     * secretly fixed -- which is the bug worth catching.
     */
    const stems = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({
        method: "GET",
        url: `/api/v1/console/items/${p.id}/preview?seed=seed-${i}`,
        headers: auth(teacherToken),
      });
      stems.add(r.json().item.stem as string);
    }
    expect(stems.size).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------- versioning and review */

describe("items are versioned, never edited in place", () => {
  let draftId: string;
  let familyId: string;

  it("creates a draft", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items",
      headers: auth(teacherToken), payload: DRAFT,
    });
    expect(res.statusCode).toBe(201);
    draftId = res.json().id;
    familyId = res.json().familyId;
    expect(res.json().version).toBe(1);
  });

  it("an edit creates v2 and RETIRES v1 — it does not update it", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/console/items/${draftId}/version`,
      headers: auth(teacherToken),
      payload: { stemTemplate: "Which mechanism moves a block without the CPU?" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().version).toBe(2);

    // In those exact words. apps/console/CLAUDE.md requires the confirm dialog
    // to say it, so the API says it too.
    expect(res.json().notice).toContain("Statistics do not carry over");

    const { rows } = await pool.query(
      "select id, version, status from items where family_id = $1 order by version",
      [familyId],
    );
    expect(rows).toHaveLength(2);
    // v1 is RETIRED, not deleted: attempt_items rows point at it and must keep
    // resolving forever.
    expect(rows[0]!.status).toBe("retired");
    expect(rows[1]!.status).toBe("draft");
  });

  it("there is no route that edits an item in place", async () => {
    const res = await app.inject({
      method: "PUT", url: `/api/v1/console/items/${draftId}`,
      headers: auth(teacherToken), payload: { stemTemplate: "rewritten" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("nothing goes live without a second pair of eyes", () => {
  let mineId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items",
      headers: auth(teacherToken),
      payload: { ...DRAFT, slug: "P-07-self-approval" },
    });
    mineId = res.json().id;
  });

  it("REFUSES to let the author approve their own item WHILE OTHER STAFF EXIST", async () => {
    // beforeAll created a second staff account, so the strict rule applies.
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/console/items/${mineId}/status`,
      headers: auth(teacherToken), payload: { status: "live" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/cannot be approved by the person who wrote it/i);

    const { rows } = await pool.query("select status from items where id = $1", [mineId]);
    expect(rows[0]!.status).toBe("draft");
  });

  it("REFUSES a self-approval even when alone, unless it is acknowledged", async () => {
    // Soft-delete the second reviewer: now the author is the only staff, which
    // is the real one-instructor deployment (decision D4).
    await pool.query("update profiles set deleted_at = now() where id = $1", [adminUserId]);
    try {
      const res = await app.inject({
        method: "PATCH", url: `/api/v1/console/items/${mineId}/status`,
        headers: auth(teacherToken), payload: { status: "live" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/re-checked the answer key/i);

      const { rows } = await pool.query("select status from items where id = $1", [mineId]);
      expect(rows[0]!.status).toBe("draft");
    } finally {
      await pool.query("update profiles set deleted_at = null where id = $1", [adminUserId]);
    }
  });

  it("ALLOWS an acknowledged self-approval when alone, and records it as one", async () => {
    // The rule cannot simply stop a solo instructor working -- a correctness
    // rule that makes the system unusable is a bug. It degrades to an explicit,
    // audited acknowledgement instead.
    await pool.query("update profiles set deleted_at = now() where id = $1", [adminUserId]);
    try {
      const res = await app.inject({
        method: "PATCH", url: `/api/v1/console/items/${mineId}/status`,
        headers: auth(teacherToken), payload: { status: "live", selfApproved: true },
      });
      expect(res.statusCode).toBe(200);

      const { rows } = await pool.query(
        `select payload from audit_log
          where action = 'item.status' and target_id = $1
          order by at desc limit 1`,
        [mineId],
      );
      // Distinguishable from a real review, forever, in one field.
      expect(rows[0]!.payload.selfApproved).toBe(true);
    } finally {
      await pool.query("update profiles set deleted_at = null where id = $1", [adminUserId]);
      await pool.query("update items set status = 'draft' where id = $1", [mineId]);
    }
  });

  it("the acknowledgement is IGNORED while another reviewer exists", async () => {
    // Otherwise the override would be a way around the rule rather than a
    // fallback for when there is nobody to ask.
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/console/items/${mineId}/status`,
      headers: auth(teacherToken), payload: { status: "live", selfApproved: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows a DIFFERENT member of staff to approve it, and records who", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/console/items/${mineId}/status`,
      headers: auth(adminToken), payload: { status: "live" },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await pool.query(
      "select status, reviewed_by, reviewed_at from items where id = $1",
      [mineId],
    );
    expect(rows[0]!.status).toBe("live");
    expect(rows[0]!.reviewed_by).toBe(adminUserId);
    expect(rows[0]!.reviewed_at).not.toBeNull();
  });

  it("REFUSES to publish a static item with no correct answer", async () => {
    // This item would mark every student wrong, silently, for as long as it
    // stayed live.
    const created = await app.inject({
      method: "POST", url: "/api/v1/console/items",
      headers: auth(teacherToken),
      payload: { ...DRAFT, slug: "P-07-no-key", correctSpec: {} },
    });
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/console/items/${created.json().id}/status`,
      headers: auth(adminToken), payload: { status: "live" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/no correct answer/i);
  });
});

describe("every change is auditable", () => {
  it("writes create, version and status changes to audit_log", async () => {
    const { rows } = await pool.query(
      `select action, count(*)::int as n from audit_log
        where action like 'item.%' group by action`,
    );
    const byAction = Object.fromEntries(rows.map((r) => [r.action, Number(r.n)]));
    expect(byAction["item.create"]).toBeGreaterThan(0);
    expect(byAction["item.version"]).toBeGreaterThan(0);
    expect(byAction["item.status"]).toBeGreaterThan(0);
  });
});

/* =====================================================================
 * Bulk review, import and export — approved for /items on 25 Sep 2026
 * (`PAGE-SPECS.md` planned them; the page never had them).
 *
 * DENIAL FIRST (hard rule 8). Every one of these routes either writes to the
 * bank or hands out answer keys, so the student and the anonymous caller are
 * tested before anything is tested working.
 * =================================================================== */

/** A stage-07 file in the authored shape, valid against the test world. */
function file07(items: Array<Record<string, unknown>>) {
  return { stageId: "07", items };
}
const NEW_S = {
  slug: "07-import-new-static",
  objective: "07.1",
  type: "S",
  bloom: "remember",
  stem: "Which SI prefix denotes one thousand?",
  correct: "kilo",
  distractors: ["mega", "milli", "micro"],
  rationale: "Kilo is 10^3.",
  source: "services/api/test/items.spec.ts",
};

describe("bulk review, import and export are staff-only", () => {
  it("refuses a student on every one of them", async () => {
    const calls = [
      app.inject({
        method: "POST", url: "/api/v1/console/items/bulk-status", headers: auth(studentToken),
        payload: { ids: ["00000000-0000-4000-8000-000000000000"], to: "review" },
      }),
      app.inject({
        method: "POST", url: "/api/v1/console/items/import", headers: auth(studentToken),
        payload: { dryRun: true, file: file07([NEW_S]) },
      }),
      app.inject({
        method: "POST", url: "/api/v1/console/items/import", headers: auth(studentToken),
        payload: { dryRun: false, file: file07([NEW_S]) },
      }),
      app.inject({
        method: "POST", url: "/api/v1/console/items/export", headers: auth(studentToken),
        payload: { ids: ["00000000-0000-4000-8000-000000000000"] },
      }),
    ];
    for (const res of await Promise.all(calls)) expect(res.statusCode).toBe(403);

    const { rows } = await pool.query("select 1 from items where slug = $1", [NEW_S.slug]);
    expect(rows, "a refused import must have written nothing").toHaveLength(0);
  });

  it("refuses an anonymous caller too", async () => {
    for (const url of ["bulk-status", "import", "export"]) {
      const res = await app.inject({
        method: "POST", url: `/api/v1/console/items/${url}`, payload: {},
      });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it("an export refused to a student carries no answer key", async () => {
    const live = await pool.query("select id from items where slug = 'S-07-prefix-1'");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/export", headers: auth(studentToken),
      payload: { ids: [live.rows[0]!.id] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain("kilo");
  });
});

describe("bulk review moves drafts into review — and nothing else", () => {
  let drafts: string[];
  let liveId: string;

  beforeAll(async () => {
    const made = await Promise.all(
      [1, 2].map((n) =>
        app.inject({
          method: "POST", url: "/api/v1/console/items", headers: auth(teacherToken),
          payload: { ...DRAFT, slug: `bulk-draft-${n}` },
        }),
      ),
    );
    drafts = made.map((r) => r.json().id as string);
    liveId = (await pool.query("select id from items where slug = 'S-07-prefix-2'")).rows[0]!.id;
  });

  it("REFUSES to publish in bulk: `to` may only be review", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/bulk-status", headers: auth(teacherToken),
      payload: { ids: drafts, to: "live" },
    });
    expect(res.statusCode).toBe(400);
    const { rows } = await pool.query("select status from items where id = any($1)", [drafts]);
    for (const r of rows) expect(r.status).toBe("draft");
  });

  it("moves the drafts, skips anything that is not a draft, and says why", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/bulk-status", headers: auth(teacherToken),
      payload: { ids: [...drafts, liveId], to: "review" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.moved.sort()).toEqual([...drafts].sort());
    expect(body.skipped).toEqual([{ id: liveId, reason: "is live, not a draft" }]);

    const { rows } = await pool.query("select id, status from items where id = any($1)", [
      [...drafts, liveId],
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    for (const d of drafts) expect(by[d]).toBe("review");
    expect(by[liveId], "a live item is untouched by a bulk move").toBe("live");
  });

  it("writes one audit row per item moved, marked as bulk", async () => {
    const { rows } = await pool.query(
      `select target_id, payload from audit_log
        where action = 'item.status' and target_id = any($1::text[])`,
      [drafts],
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.payload).toMatchObject({ from: "draft", to: "review", bulk: true });
    }
  });
});

describe("import: a dry run first, drafts only, and never a live item", () => {
  const count = async (sql: string, p: unknown[] = []) =>
    Number((await pool.query(sql, p)).rows[0]!.n);

  it("a dry run plans and writes NOTHING", async () => {
    const items0 = await count("select count(*) n from items");
    const audit0 = await count("select count(*) n from audit_log");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: true, file: file07([NEW_S]) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ dryRun: true, applied: false, counts: { create: 1 } });
    expect(await count("select count(*) n from items")).toBe(items0);
    expect(await count("select count(*) n from audit_log")).toBe(audit0);
  });

  it("names every broken rule, and a commit with a broken row writes nothing", async () => {
    const bad = [
      { ...NEW_S, slug: "07-import-no-key", correct: "" },
      { ...NEW_S, slug: "07-import-bad-objective", objective: "04.1" },
      { ...NEW_S, slug: "07-import-no-source", source: null },
      { slug: "07-import-bad-solver", objective: "07.3", type: "P", bloom: "apply", solver: "no-such-solver", source: "t" },
      { ...NEW_S, slug: "07-import-dupe-distractor", distractors: ["kilo", "mega", "milli"] },
      { ...NEW_S, slug: "BAD SLUG" },
    ];
    const dry = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: true, file: file07(bad) },
    });
    const rows = dry.json().rows as Array<{ slug: string; action: string; reasons: string[] }>;
    for (const r of rows) expect(r.action, r.slug).toBe("invalid");
    const reasons = rows.map((r) => r.reasons.join(" ")).join(" | ");
    expect(reasons).toContain("no correct answer");
    expect(reasons).toContain("belongs to stage 04");
    expect(reasons).toContain("no source");
    expect(reasons).toContain('unknown solver "no-such-solver"');
    expect(reasons).toContain("also appears as a distractor");
    expect(reasons).toContain("slug must be");

    const items0 = await count("select count(*) n from items");
    const commit = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: false, file: file07([NEW_S, ...bad]) },
    });
    expect(commit.statusCode).toBe(400);
    expect(await count("select count(*) n from items"), "all or nothing").toBe(items0);
  });

  it("refuses a stage beyond the examinable scope", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: true, file: { stageId: "15", items: [{ ...NEW_S, objective: "15.1" }] } },
    });
    expect(res.json().rows[0].action).toBe("invalid");
    expect(res.json().rows[0].reasons.join(" ")).toContain("beyond the examinable scope");
  });

  it("commits new items as DRAFTS authored by the importer, with the source audited", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: false, file: file07([NEW_S]) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ applied: true, counts: { create: 1 } });

    const { rows } = await pool.query(
      "select id, status, author_id, correct_spec from items where slug = $1",
      [NEW_S.slug],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status, "never review, never live").toBe("draft");
    expect(rows[0]!.author_id).toBe(w.teacher);
    expect(rows[0]!.correct_spec).toEqual({ value: "kilo" });

    const audit = await pool.query(
      "select payload from audit_log where action = 'item.create' and target_id = $1",
      [rows[0]!.id],
    );
    expect(audit.rows[0]!.payload).toMatchObject({ via: "import", source: NEW_S.source });
  });

  it("re-importing the same content is a no-op", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: true, file: file07([NEW_S]) },
    });
    expect(res.json().rows[0].action).toBe("unchanged");
  });

  it("a changed DRAFT becomes v2 and v1 is retired, never edited in place", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: false, file: file07([{ ...NEW_S, stem: "Which SI prefix denotes 10^3?" }]) },
    });
    expect(res.json().counts.version).toBe(1);
    const { rows } = await pool.query(
      "select version, status, stem_template from items where slug = $1 order by version",
      [NEW_S.slug],
    );
    expect(rows.map((r) => [r.version, r.status])).toEqual([[1, "retired"], [2, "draft"]]);
    expect(rows[0]!.stem_template, "v1 keeps its words").toBe(NEW_S.stem);
  });

  it("REFUSES a live item named by its own slug", async () => {
    // A live item whose slug IS valid in the authored format.
    const created = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: false, file: file07([{ ...NEW_S, slug: "07-import-goes-live" }]) },
    });
    expect(created.statusCode).toBe(200);
    await pool.query("update items set status = 'live' where slug = '07-import-goes-live'");

    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: {
        dryRun: false,
        file: file07([{ ...NEW_S, slug: "07-import-goes-live", stem: "Rewritten by an import" }]),
      },
    });
    expect(res.json().rows[0]).toMatchObject({ action: "refused" });
    expect(res.json().rows[0].reasons.join(" ")).toContain("live");
    const { rows } = await pool.query(
      "select status, stem_template from items where slug = '07-import-goes-live'",
    );
    expect(rows).toEqual([{ status: "live", stem_template: NEW_S.stem }]);
  });
});

describe("export", () => {
  it("returns the authored shape, and it imports back as unchanged", async () => {
    const { rows } = await pool.query(
      "select id from items where slug in ('07-import-new-static', '07-import-goes-live') and status <> 'retired'",
    );
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/export", headers: auth(teacherToken),
      payload: { ids: rows.map((r) => r.id) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.format).toBe("octa-items/1");
    expect(body.items).toHaveLength(2);
    const s = body.items.find((i: { slug: string }) => i.slug === "07-import-new-static");
    expect(s).toMatchObject({ stageId: "07", type: "S", correct: "kilo", objective: "07.1" });

    const back = await app.inject({
      method: "POST", url: "/api/v1/console/items/import", headers: auth(teacherToken),
      payload: { dryRun: true, file: body },
    });
    for (const r of back.json().rows) expect(r.action, r.slug).toBe("unchanged");
  });

  it("exports a parameterized and an ordering item in their own shapes", async () => {
    const { rows } = await pool.query(
      "select id, slug from items where slug in ('P-07-cycle-1', 'G-07-order-1')",
    );
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/items/export", headers: auth(teacherToken),
      payload: { ids: rows.map((r) => r.id) },
    });
    const items = res.json().items as Array<Record<string, unknown>>;
    expect(items.find((i) => i.type === "P")).toMatchObject({ solver: "cycle-time" });
    expect(items.find((i) => i.type === "P")).not.toHaveProperty("stem");
    expect(items.find((i) => i.type === "G")).toMatchObject({ take: 4 });
    expect((items.find((i) => i.type === "G")!.order as string[])[0]).toBe("pico");
  });
});
