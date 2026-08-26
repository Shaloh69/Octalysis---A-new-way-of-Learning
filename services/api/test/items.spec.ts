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
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa",
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

  it("re-rolls: a different seed gives a different instance", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/items?status=live", headers: auth(teacherToken),
    });
    // Find a parameterized item -- static items legitimately resolve the same
    // stem every time, so seeding one proves nothing about re-rolling.
    const p = list.json().items.find((i: { type: string }) => i.type === "P");
    if (!p) return; // no P items seeded in this world

    const a = await app.inject({
      method: "GET",
      url: `/api/v1/console/items/${p.id}/preview?seed=seed-one`,
      headers: auth(teacherToken),
    });
    const b = await app.inject({
      method: "GET",
      url: `/api/v1/console/items/${p.id}/preview?seed=seed-two`,
      headers: auth(teacherToken),
    });
    expect(a.json().item.stem).not.toBe(b.json().item.stem);
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
