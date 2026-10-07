import type pg from "pg";
import { ApiEngineId } from "@octa/contracts/assistant";
import { last4, open, seal, SealError } from "./seal.js";

/**
 * A teacher's engine keys in `assistant_engine_keys` (db/addendum-assistant.sql).
 * RLS lets no client role read the table, its owner included; only the API's
 * connection does, and it stores sealed bytes. The plaintext exists in this
 * process only while a step runs, and is never returned, logged or stored.
 *
 * The route that calls `putKey` (B4) answers with `last4` and the date only.
 */

export class KeysNotConfigured extends Error {
  constructor() {
    super("ASSISTANT_KEY_SECRET is not set: engine keys can be neither stored nor used");
    this.name = "KeysNotConfigured";
  }
}

function need(secret: string | undefined): string {
  if (!secret) throw new KeysNotConfigured();
  return secret;
}

export interface KeySummary {
  engine: ApiEngineId;
  last4: string;
  updatedAt: string;
}

/** Adds or replaces one engine's key for one teacher. */
export async function putKey(db: pg.Pool, secret: string | undefined, ownerId: string, engine: ApiEngineId, plaintext: string): Promise<KeySummary> {
  const key = plaintext.trim();
  const sealed = seal(need(secret), { ownerId, engine }, key);
  const r = await db.query<{ updated_at: Date }>(
    `insert into assistant_engine_keys (owner_id, engine, sealed, last4)
     values ($1, $2, $3, $4)
     on conflict (owner_id, engine) do update
       set sealed = excluded.sealed, last4 = excluded.last4, updated_at = now()
     returning updated_at`,
    [ownerId, engine, sealed, last4(key)],
  );
  return { engine, last4: last4(key), updatedAt: r.rows[0]!.updated_at.toISOString() };
}

export async function removeKey(db: pg.Pool, ownerId: string, engine: ApiEngineId): Promise<boolean> {
  const r = await db.query(`delete from assistant_engine_keys where owner_id = $1 and engine = $2`, [ownerId, engine]);
  return (r.rowCount ?? 0) > 0;
}

/** What the page may show: never a key, never the sealed bytes. */
export async function listKeys(db: pg.Pool, ownerId: string): Promise<KeySummary[]> {
  const r = await db.query<{ engine: ApiEngineId; last4: string; updated_at: Date }>(
    `select engine, last4, updated_at from assistant_engine_keys where owner_id = $1 order by engine`,
    [ownerId],
  );
  return r.rows.map((x) => ({ engine: x.engine, last4: x.last4, updatedAt: x.updated_at.toISOString() }));
}

export interface OpenedKeys {
  keys: Partial<Record<ApiEngineId, { key: string; keyId: string }>>;
  /** Keys that are stored and did not open, by engine: shown to the teacher as "add it again". */
  unopened: ApiEngineId[];
}

/** Opens one teacher's keys for one step. A key that will not open is left
 *  out (its engine is then skipped as having no key) and named in `unopened`. */
export async function openKeys(db: pg.Pool, secret: string | undefined, ownerId: string): Promise<OpenedKeys> {
  const s = need(secret);
  const r = await db.query<{ id: string; engine: string; sealed: Buffer }>(
    `select id::text, engine, sealed from assistant_engine_keys where owner_id = $1`,
    [ownerId],
  );
  const out: OpenedKeys = { keys: {}, unopened: [] };
  for (const row of r.rows) {
    const engine = ApiEngineId.safeParse(row.engine);
    if (!engine.success) continue;
    try {
      out.keys[engine.data] = { key: open(s, { ownerId, engine: engine.data }, row.sealed), keyId: row.id };
    } catch (e) {
      if (!(e instanceof SealError)) throw e;
      out.unopened.push(engine.data);
    }
  }
  return out;
}
