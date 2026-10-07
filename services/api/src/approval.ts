import type pg from "pg";
import type { Identity } from "./auth.js";
import { errors } from "./errors.js";

/**
 * THE APPROVAL RULE (docs/COURSE-STUDIO-PLAN.md §3; instructor, 7 Oct 2026,
 * night): an approver is a teacher OF THE SUBJECT and never the author of
 * the version approved; the ADMIN may approve their own edit, recorded as
 * self-approved.
 *
 * The rule lives in the database (`approval_verdict()` and the
 * `enforce_content_approver` triggers, db/addendum-studio.sql) so nothing goes
 * round it. This asks the same function first, so a refusal says why in
 * words instead of surfacing a constraint error. One source of truth: the
 * route cannot disagree with the trigger, because it IS the trigger's answer.
 */

const SUBJECT = "CPE 412"; // content_subject_of(); CS2 keys the stages by subject

export async function assertMayApprove(
  db: pg.Pool | pg.PoolClient,
  id: Identity,
  author: string | null,
  stageId: string,
): Promise<{ selfApproved: boolean }> {
  const r = await db.query<{ v: string; subject: string }>(
    "select approval_verdict($1, $2, $3) as v, content_subject_of($3) as subject",
    [id.userId, author, stageId],
  );
  const { v, subject } = r.rows[0] ?? { v: "not_staff", subject: SUBJECT };
  if (v === "ok") return { selfApproved: author !== null && author === id.userId };
  if (v === "author") {
    throw errors.forbidden(
      `You wrote this version; another teacher of ${subject} approves it. (Only the admin may approve their own edit.)`,
    );
  }
  throw errors.forbidden(`Only a teacher of ${subject} or the admin approves its content.`);
}
