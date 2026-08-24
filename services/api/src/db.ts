import pg from "pg";

/**
 * Database access.
 *
 * The API connects with credentials that bypass RLS -- generation, grading and
 * lock resolution have to see the answer key and every student's row. That makes
 * authorization THIS layer's job, not Postgres's, and it is why every function
 * here that touches a student's data takes an explicit `userId` and filters on
 * it.
 *
 * RLS is still the backstop for everything the browser reaches through
 * supabase-js directly. The two layers guard different doors; neither is
 * sufficient alone.
 */

export type Db = pg.Pool;

let pool: pg.Pool | null = null;

export function getPool(connectionString: string): pg.Pool {
  pool ??= new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

/** Run a set of statements in one transaction, rolling back on any throw. */
export async function withTransaction<T>(
  db: Db,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run inside a transaction that is permitted to change `profiles.role`.
 *
 * The `block_role_change` trigger refuses a role change unless this GUC is set.
 * Guarding on an explicit application signal rather than on the connection's
 * identity is deliberate: `current_setting('role')` is 'service_role' under
 * PostgREST but 'none' over a direct pg connection, so an identity-based guard
 * would work or not depending on which client library made the call (V-21).
 */
export async function withRoleChangeAllowed<T>(
  db: Db,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(db, async (client) => {
    await client.query("set local app.allow_role_change = 'on'");
    return fn(client);
  });
}
