import pg from "pg";

/**
 * RLS test harness.
 *
 * The whole value of a denial test is that it fails for the RIGHT reason. The
 * failure mode this harness exists to prevent:
 *
 *   Connect as postgres, run `select * from items`, get 0 rows because the table
 *   is empty, and record a passing "students cannot read items" test against a
 *   database that is wide open.
 *
 * So two things are non-negotiable here.
 *
 * 1. We `SET LOCAL ROLE` to `anon` / `authenticated` / `service_role`. After that
 *    the current role is no longer superuser and no longer the table owner, so
 *    RLS genuinely applies. Connecting as postgres and querying directly would
 *    bypass every policy silently.
 *
 * 2. We set `request.jwt.claims` — the GUC PostgREST populates per request, and
 *    the one `auth.uid()` and `jwt_role()` read. Setting the role WITHOUT the
 *    claims gives `auth.uid() = null` and `jwt_role() = 'student'`, which makes
 *    "own row" policies match nothing and every denial test pass vacuously.
 *
 * `assertIdentity()` proves both before the suite runs. See hard rule 8.
 */

const { Pool } = pg;

export const CONNECTION_STRING =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa";

export const pool = new Pool({ connectionString: CONNECTION_STRING, max: 8 });

export type ActorRole = "student" | "teacher" | "admin";

export interface Actor {
  /** null for anon. */
  readonly userId: string | null;
  /** The Postgres role to SET LOCAL. */
  readonly dbRole: "anon" | "authenticated" | "service_role";
  /** app_metadata.role in the JWT claims. Ignored for anon and service_role. */
  readonly appRole: ActorRole | null;
  readonly label: string;
}

export const anon: Actor = {
  userId: null,
  dbRole: "anon",
  appRole: null,
  label: "anon",
};

export function authenticated(userId: string, appRole: ActorRole, label: string = appRole): Actor {
  return { userId, dbRole: "authenticated", appRole, label };
}

export const service: Actor = {
  userId: null,
  dbRole: "service_role",
  appRole: null,
  label: "service_role",
};

function claimsFor(actor: Actor): string {
  if (actor.dbRole === "anon") {
    return JSON.stringify({ role: "anon" });
  }
  if (actor.dbRole === "service_role") {
    return JSON.stringify({ role: "service_role" });
  }
  return JSON.stringify({
    sub: actor.userId,
    role: "authenticated",
    aud: "authenticated",
    app_metadata: { role: actor.appRole },
  });
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  /** Set when the statement raised. `null` when it succeeded. */
  error: { code: string | undefined; message: string } | null;
}

/**
 * Run `sql` as `actor` inside a rolled-back transaction.
 *
 * Always rolls back, so a test that accidentally writes cannot contaminate the
 * next test. Errors are captured rather than thrown — a denial test needs to
 * distinguish "returned zero rows" from "raised permission denied", and both are
 * legitimate ways for a policy to deny.
 */
export async function runAs<T = Record<string, unknown>>(
  actor: Actor,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${actor.dbRole}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [claimsFor(actor)]);

    try {
      const res = await client.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
        error: null,
      };
    } catch (err) {
      const e = err as { code?: string; message: string };
      return { rows: [], rowCount: 0, error: { code: e.code, message: e.message } };
    }
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

/**
 * Run privileged setup that COMMITS. Used only by fixtures.
 * Runs as the connection owner (superuser), which bypasses RLS — appropriate for
 * seeding, and never used by a test assertion.
 */
export async function setup(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Prove the harness is real before trusting a single denial result.
 *
 * Asserts that inside `runAs`, the database agrees about who we are. If this
 * fails, every other test in the suite is meaningless — which is exactly why it
 * runs first and throws rather than returning a boolean.
 */
export async function assertIdentity(actor: Actor): Promise<void> {
  const res = await runAs<{ uid: string | null; role: string; cur: string }>(
    actor,
    "select auth.uid()::text as uid, jwt_role()::text as role, current_user as cur",
  );

  if (res.error) {
    throw new Error(
      `[harness] identity probe raised for ${actor.label}: ${res.error.message}\n` +
        `The suite cannot trust any denial result until this succeeds.`,
    );
  }

  const row = res.rows[0];
  if (!row) throw new Error(`[harness] identity probe returned no rows for ${actor.label}`);

  if (row.cur !== actor.dbRole) {
    throw new Error(
      `[harness] SET LOCAL ROLE did not take for ${actor.label}: current_user is '${row.cur}', expected '${actor.dbRole}'.`,
    );
  }

  if (actor.dbRole === "authenticated") {
    if (row.uid !== actor.userId) {
      throw new Error(
        `[harness] auth.uid() is '${row.uid}', expected '${actor.userId}' for ${actor.label}.\n` +
          `request.jwt.claims is not reaching the policies. Every "own row" test would pass vacuously.`,
      );
    }
    if (row.role !== actor.appRole) {
      throw new Error(
        `[harness] jwt_role() is '${row.role}', expected '${actor.appRole}' for ${actor.label}.`,
      );
    }
  }

  if (actor.dbRole === "anon" && row.uid !== null) {
    throw new Error(`[harness] anon should have a null auth.uid(), got '${row.uid}'.`);
  }
}

/** True when the statement was denied — either zero rows, or a raised error. */
export function wasDenied(res: QueryResult): boolean {
  return res.error !== null || res.rowCount === 0;
}

/** A readable reason, for assertion messages. */
export function denialReason(res: QueryResult): string {
  if (res.error) return `raised ${res.error.code ?? "error"}: ${res.error.message}`;
  return `returned ${res.rowCount} rows`;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
