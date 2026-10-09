import type { Db } from "./db.js";
import { errors } from "./errors.js";
import type { Identity } from "./auth.js";

/**
 * T2: a teacher holds their own classes (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5; the same rule
 * db/addendum-class-scope.sql asks of RLS).
 *
 *   READ   a section's students: the actor holds a class on the section, ended or not; the admin
 *          reads every section.
 *   WRITE  a section's students: the actor holds a class on the section and it has NOT ended. The
 *          admin has no write on a class they do not hold.
 *
 * The API connects as the table owner and bypasses RLS, so THIS is the door the console actually
 * goes through; RLS is the backstop for a staff token used against the database directly. Both are
 * tested (`class-scope-rls.spec.ts`, `class-scope-api.spec.ts`).
 *
 * A record outside the reader's scope is NOT FOUND, never forbidden: a teacher must not be able to
 * learn that another section's student exists.
 */
export interface StaffScope {
  readonly userId: string;
  readonly admin: boolean;
  /** Section ids of every class the actor holds, ended or not. The admin's reach is wider: see `reads`. */
  readonly readIds: readonly string[];
  /** Section ids of the classes the actor holds that have not ended. */
  readonly writeIds: readonly string[];
  /** True when the actor reads this section (null = a student with no section: the admin alone). */
  reads(sectionId: string | null): boolean;
  /** True when the actor may write to this section's students. */
  writes(sectionId: string | null): boolean;
}

export async function staffScope(db: Db, id: Identity): Promise<StaffScope> {
  const { rows } = await db.query<{ section_id: string; open: boolean }>(
    `select section_id::text as section_id, (ended_at is null) as open
       from classes where teacher_id = $1`,
    [id.userId],
  );
  const readIds = [...new Set(rows.map((r) => r.section_id))];
  const writeIds = [...new Set(rows.filter((r) => r.open).map((r) => r.section_id))];
  const admin = id.role === "admin";
  return {
    userId: id.userId,
    admin,
    readIds,
    writeIds,
    reads: (s) => admin || (s !== null && readIds.includes(s)),
    writes: (s) => s !== null && writeIds.includes(s),
  };
}

/**
 * A SQL predicate on a section column, with its parameter appended to `params`.
 * The admin's read is `true` (and adds no parameter); everything else is `col = any($n)`.
 */
export function sectionFilter(
  scope: StaffScope,
  kind: "read" | "write",
  col: string,
  params: unknown[],
): string {
  if (kind === "read" && scope.admin) return "true";
  params.push(kind === "read" ? [...scope.readIds] : [...scope.writeIds]);
  return `${col} = any($${params.length}::uuid[])`;
}

/** The section a user is in (null: none, or no such user). */
async function sectionOf(db: Db, userId: string): Promise<{ found: boolean; section: string | null }> {
  const { rows } = await db.query<{ section_id: string | null }>(
    "select section_id::text as section_id from profiles where id = $1",
    [userId],
  );
  return rows.length === 0 ? { found: false, section: null } : { found: true, section: rows[0]!.section_id };
}

/** Throws NOT FOUND unless the actor reads this student. */
export async function assertReadsUser(db: Db, scope: StaffScope, userId: string, what = "No such student."): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw errors.notFound(what);
  const s = await sectionOf(db, userId);
  if (!s.found || !scope.reads(s.section)) throw errors.notFound(what);
}

/**
 * Throws unless the actor may WRITE to this student: NOT FOUND if they cannot even read them, and a
 * plain refusal (403) if they read the class but it has ended or is the admin's to read only.
 */
export async function assertWritesUser(db: Db, scope: StaffScope, userId: string, what = "No such student."): Promise<void> {
  await assertReadsUser(db, scope, userId, what);
  const s = await sectionOf(db, userId);
  if (!scope.writes(s.section)) throw errors.forbidden(readOnlyMessage(scope));
}

/** Throws NOT FOUND unless the actor reads this section. */
export function assertReadsSection(scope: StaffScope, sectionId: string | null, what = "No such section."): void {
  if (!scope.reads(sectionId)) throw errors.notFound(what);
}

/** Throws unless the actor may write to this section's students. */
export function assertWritesSection(scope: StaffScope, sectionId: string | null, what = "No such section."): void {
  assertReadsSection(scope, sectionId, what);
  if (!scope.writes(sectionId)) throw errors.forbidden(readOnlyMessage(scope));
}

/** An attempt's owner, or NOT FOUND (also for a malformed id). */
export async function attemptOwner(db: Db, attemptId: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) throw errors.notFound("No such attempt.");
  const { rows } = await db.query<{ user_id: string }>("select user_id::text as user_id from attempts where id = $1", [attemptId]);
  if (rows.length === 0) throw errors.notFound("No such attempt.");
  return rows[0]!.user_id;
}

function readOnlyMessage(scope: StaffScope): string {
  return scope.admin
    ? "This class is held by another teacher, so you can read it and not change it."
    : "This class has ended, so you can read it and not change it.";
}
