import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import { loadAttempt, loadResolvedPaper } from "../repo/engine-repo.js";
import type { Env } from "../env.js";

/**
 * The teacher console API.
 *
 * Two rules run through all of it:
 *
 *   - Every write that changes student-visible state writes to `audit_log`
 *     with an actor and a reason. If a grade is ever challenged, that table is
 *     the evidence.
 *   - A lock override REQUIRES a reason. INV-22 checks for it, and a toggle
 *     that does not record why is a toggle nobody can explain in December.
 */

export function registerConsoleRoutes(app: FastifyInstance, env: Env): void {
  /* ----------------------------------------------------------
   * GET /api/v1/console/roster
   * -------------------------------------------------------- */
  app.get("/api/v1/console/roster", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select d.student_id, d.full_name, d.status, d.claimed_at,
              d.section_id, s.code as section_code,
              p.id as user_id, p.deleted_at,
              (select count(*)::int from attempts a where a.user_id = p.id) as attempts,
              (select round(avg(sp.mastery) * 100)::int
                 from stage_progress sp where sp.user_id = p.id) as avg_mastery
         from student_directory d
         left join sections s on s.id = d.section_id
         left join profiles p on p.student_id = d.student_id
        order by d.student_id`,
    );
    const sections = await app.db.query("select id, code, term from sections order by code");

    return reply.send({
      students: rows.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        status: r.status,
        claimedAt: r.claimed_at,
        sectionId: r.section_id,
        sectionCode: r.section_code,
        userId: r.user_id,
        // Two shapes of the same decision: a registered student's profile is
        // soft-deleted; a row nobody has claimed yet is disabled, which the
        // claim's `where status = 'unclaimed'` refuses.
        deactivated: r.deleted_at !== null || r.status === "disabled",
        attempts: Number(r.attempts ?? 0),
        avgMastery: r.avg_mastery === null ? null : Number(r.avg_mastery),
      })),
      sections: sections.rows.map((s) => ({ id: s.id, code: s.code, term: s.term })),
    });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/roster/import   (staff only, dry-run by default)
   *
   * Lived in routes/auth.ts until 25 Sep 2026, which mounts only when a
   * Supabase admin client is configured. The import needs no Supabase admin,
   * so on the local stack it simply did not exist: a 404 behind the button.
   * -------------------------------------------------------- */
  const RosterBody = z.object({
    /** The section for every row that does not name its own. Created if new. */
    sectionCode: z.string().trim().min(1),
    term: z.string().trim().min(1).default("2026-1"),
    rows: z
      .array(
        z.object({
          studentId: z.string().trim().min(1),
          fullName: z.string().trim().min(1),
          /** Optional third column. Must already exist; see `unknown-section`. */
          sectionCode: z.string().trim().min(1).optional(),
        }),
      )
      .max(500),
    apply: z.boolean().default(false),
  });

  /*
   * The plan, row by row, BEFORE anything is written (PAGE-SPECS.md
   * §/console/roster: "new / existing / conflicting"). Four outcomes:
   *
   *   insert     not on the roster yet
   *   unchanged  on the roster already, exactly as written
   *   update     on the roster, not registered, and the name or section differs
   *   conflict   will NOT be written, and says why:
   *                registered       the student has claimed this row. A claimed
   *                                 row is never overwritten; a section change
   *                                 for them is the section move, which asks why
   *                duplicate        the same ID twice in one file. Neither line
   *                                 is guessed at
   *                unknown-section  a row names a section that does not exist.
   *                                 Only the dialog's own section may be created
   *
   * The dry run and the apply compute the SAME plan from the same rows, so what
   * the teacher previewed is what is written.
   */
  app.post("/api/v1/console/roster/import", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = RosterBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That roster could not be read.");
    const { sectionCode, term, rows, apply } = body.data;

    const existing = await app.db.query<{
      student_id: string; full_name: string; status: string; section_code: string | null;
    }>(
      `select d.student_id, d.full_name, d.status, s.code as section_code
         from student_directory d left join sections s on s.id = d.section_id
        where d.student_id = any($1)`,
      [rows.map((r) => r.studentId)],
    );
    const known = new Map(existing.rows.map((r) => [r.student_id, r]));
    const sections = new Set(
      (await app.db.query<{ code: string }>("select code from sections")).rows.map((r) => r.code),
    );
    sections.add(sectionCode);
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.studentId, (seen.get(r.studentId) ?? 0) + 1);

    const plan = rows.map((r) => {
      const target = r.sectionCode ?? sectionCode;
      const cur = known.get(r.studentId);
      const current = cur
        ? { fullName: cur.full_name, sectionCode: cur.section_code, status: cur.status }
        : null;
      const base = { studentId: r.studentId, fullName: r.fullName, sectionCode: target, current };
      if (seen.get(r.studentId)! > 1) return { ...base, action: "conflict" as const, why: "duplicate" as const };
      if (!sections.has(target)) return { ...base, action: "conflict" as const, why: "unknown-section" as const };
      if (!cur) return { ...base, action: "insert" as const };
      const same = cur.full_name === r.fullName && cur.section_code === target;
      if (same) return { ...base, action: "unchanged" as const };
      if (cur.status === "claimed") return { ...base, action: "conflict" as const, why: "registered" as const };
      return { ...base, action: "update" as const };
    });

    const count = (a: string) => plan.filter((p) => p.action === a).length;
    const summary = {
      insert: count("insert"), update: count("update"),
      unchanged: count("unchanged"), conflict: count("conflict"),
    };

    // Dry run is the DEFAULT. A roster import that silently rewrites 40 rows
    // because someone forgot a flag is not recoverable without the audit log.
    if (!apply) {
      return reply.send({ dryRun: true, summary, plan });
    }

    await withTransaction(app.db, async (client) => {
      const { rows: own } = await client.query(
        `insert into sections (code, term) values ($1, $2)
         on conflict (code) do update set term = excluded.term
         returning id`,
        [sectionCode, term],
      );
      const { rows: all } = await client.query<{ id: string; code: string }>("select id, code from sections");
      const sectionId = new Map(all.map((s) => [s.code, s.id]));
      sectionId.set(sectionCode, own[0]!.id);

      for (const p of plan) {
        if (p.action !== "insert" && p.action !== "update") continue;
        // `status` is left alone on update: re-importing never reactivates a
        // row someone disabled. That is its own audited action.
        await client.query(
          `insert into student_directory (student_id, full_name, section_id, status)
           values ($1, $2, $3, 'unclaimed')
           on conflict (student_id) do update
             set full_name = excluded.full_name, section_id = excluded.section_id`,
          [p.studentId, p.fullName, sectionId.get(p.sectionCode)],
        );
      }

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'roster.import', 'section', $2, $3)`,
        [
          id.userId, sectionCode,
          JSON.stringify({
            summary,
            inserted: plan.filter((p) => p.action === "insert").map((p) => p.studentId),
            updated: plan.filter((p) => p.action === "update").map((p) => p.studentId),
          }),
        ],
      );
    });

    return reply.send({ dryRun: false, summary });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/roster/status   { studentId, active, reason }
   *
   * Deactivate and reactivate. V-20: a student is never deleted, because the
   * append-only trigger on `responses` blocks the cascade and because their
   * record is evidence. Deactivation is the supported path:
   *
   *   registered      profiles.deleted_at. `identityFrom()` then refuses every
   *                   API request they make, and `/auth/resolve` refuses their ID
   *   not registered  student_directory.status = 'disabled', so the ID cannot
   *                   be claimed
   *
   * Nothing they did is removed: attempts, responses and grades stay. A reason
   * is required both ways, because in December "why could this student not sign
   * in?" is answered from `audit_log` or not at all.
   * -------------------------------------------------------- */
  const StatusBody = z.object({
    studentId: z.string().trim().min(1),
    active: z.boolean(),
    reason: z.string().trim().min(3),
  });

  app.post("/api/v1/console/roster/status", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const parsed = StatusBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("Say why, in a few words. The reason goes to the audit log.");
    }
    const b = parsed.data;

    const result = await withTransaction(app.db, async (client) => {
      const { rows } = await client.query<{ full_name: string; status: string; user_id: string | null }>(
        `select d.full_name, d.status, p.id as user_id
           from student_directory d left join profiles p on p.student_id = d.student_id
          where d.student_id = $1
          for update of d`,
        [b.studentId],
      );
      const row = rows[0];
      if (!row) throw errors.badRequest("That student is not on the roster. Nothing was changed.");

      if (row.user_id) {
        await client.query(
          b.active
            ? "update profiles set deleted_at = null where id = $1"
            : "update profiles set deleted_at = coalesce(deleted_at, now()) where id = $1",
          [row.user_id],
        );
      } else if (row.status !== "claimed") {
        await client.query(
          "update student_directory set status = $2 where student_id = $1",
          [b.studentId, b.active ? "unclaimed" : "disabled"],
        );
      }

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, $2, 'student', $3, $4)`,
        [
          id.userId, b.active ? "roster.reactivate" : "roster.deactivate", b.studentId,
          JSON.stringify({ reason: b.reason, fullName: row.full_name, registered: row.user_id !== null }),
        ],
      );
      return { fullName: row.full_name, registered: row.user_id !== null };
    });

    return reply.send({ ok: true, active: b.active, ...result });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/roster/section   { studentIds, sectionId, reason }
   *
   * The bulk section move. A section is what section-scope lock overrides and
   * assessment windows read, so moving a student changes what they can open and
   * sit: a reason is required, and every student gets their own audit row.
   *
   * The roster row AND the profile move. `profiles.section_id` is what
   * `is_stage_unlocked()` and the assessments read; moving only the directory
   * would change the console and nothing a student sees.
   *
   * All or nothing: one unknown ID refuses the whole move.
   * -------------------------------------------------------- */
  const SectionBody = z.object({
    studentIds: z.array(z.string().trim().min(1)).min(1).max(500),
    sectionId: z.string().uuid(),
    reason: z.string().trim().min(3),
  });

  app.post("/api/v1/console/roster/section", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const parsed = SectionBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest("Pick a section and say why. The reason goes to the audit log.");
    }
    const b = parsed.data;
    const ids = [...new Set(b.studentIds)];

    const section = await app.db.query<{ code: string }>("select code from sections where id = $1", [b.sectionId]);
    if (section.rows.length === 0) throw errors.badRequest("That section does not exist. Nothing was changed.");
    const to = section.rows[0]!.code;

    await withTransaction(app.db, async (client) => {
      const { rows } = await client.query<{ student_id: string; code: string | null }>(
        `select d.student_id, s.code
           from student_directory d left join sections s on s.id = d.section_id
          where d.student_id = any($1)
          for update of d`,
        [ids],
      );
      const missing = ids.length - rows.length;
      if (missing > 0) {
        throw errors.badRequest(
          `${missing} of those students ${missing === 1 ? "is" : "are"} not on the roster. Nothing was changed.`,
        );
      }
      await client.query("update student_directory set section_id = $2 where student_id = any($1)", [ids, b.sectionId]);
      await client.query("update profiles set section_id = $2 where student_id = any($1)", [ids, b.sectionId]);
      for (const r of rows) {
        await client.query(
          `insert into audit_log (actor_id, action, target_type, target_id, payload)
           values ($1, 'roster.section', 'student', $2, $3)`,
          [id.userId, r.student_id, JSON.stringify({ reason: b.reason, from: r.code, to })],
        );
      }
    });

    return reply.send({ ok: true, moved: ids.length, sectionCode: to });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/locks
   * The students x stages matrix, and every section and global override.
   *
   * Who set an override and when come back with the reason (PAGE-SPECS.md
   * §/console/locks: "shows who overrode it, when, and why"). They were
   * selected here from the start and then dropped on the way out.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/locks", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const stages = await app.db.query(
      "select id, title, ordinal from stages order by ordinal",
    );

    const students = await app.db.query(
      `select p.id as user_id, p.student_id, p.full_name, p.section_id
         from profiles p
        where p.student_id is not null and p.deleted_at is null
        order by p.student_id`,
    );

    // Resolved state per cell, from is_stage_unlocked() -- the same authority
    // the student app reads. The console must not compute its own answer.
    const cells = await app.db.query(
      `select p.id as user_id, s.id as stage_id,
              is_stage_unlocked(p.id, s.id) as unlocked,
              coalesce(sp.mastery, 0) as mastery,
              sl.state as override, sl.reason, sl.created_at as set_at,
              actor.full_name as set_by
         from profiles p
         cross join stages s
         left join stage_progress sp on sp.user_id = p.id and sp.stage_id = s.id
         left join stage_locks sl
                on sl.scope = 'user' and sl.scope_user_id = p.id and sl.stage_id = s.id
         left join profiles actor on actor.id = sl.actor_id
        where p.student_id is not null and p.deleted_at is null`,
    );

    const sections = await app.db.query("select id, code, term from sections order by code");

    const scopeLocks = await app.db.query(
      `select sl.id, sl.scope, sl.scope_section_id, sec.code as section_code, sl.stage_id,
              sl.state, sl.reason, sl.unlock_at, sl.lock_at, sl.created_at,
              actor.full_name as set_by
         from stage_locks sl
         left join sections sec on sec.id = sl.scope_section_id
         left join profiles actor on actor.id = sl.actor_id
        where sl.scope in ('global', 'section') and sl.state <> 'auto'
        order by sl.stage_id, sl.scope, sec.code`,
    );

    const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

    return reply.send({
      stages: stages.rows.map((s) => ({ id: s.id, title: s.title, ordinal: Number(s.ordinal) })),
      students: students.rows.map((s) => ({
        userId: s.user_id,
        studentId: s.student_id,
        fullName: s.full_name,
        sectionId: s.section_id,
      })),
      cells: cells.rows.map((c) => {
        // null means "auto" -- the curriculum policy decides.
        const override = c.override === "auto" ? null : (c.override ?? null);
        return {
          userId: c.user_id,
          stageId: c.stage_id,
          unlocked: c.unlocked,
          mastery: Number(c.mastery),
          override,
          reason: override ? c.reason : null,
          // A staff account with no profile row still set it; say so rather
          // than leave the "who" blank.
          setBy: override ? (c.set_by ?? "a staff account") : null,
          setAt: override ? iso(c.set_at) : null,
        };
      }),
      sections: sections.rows.map((s) => ({ id: s.id, code: s.code, term: s.term })),
      scopeLocks: scopeLocks.rows.map((l) => ({
        id: l.id,
        scope: l.scope,
        sectionId: l.scope_section_id,
        sectionCode: l.section_code,
        stageId: l.stage_id,
        state: l.state,
        reason: l.reason,
        unlockAt: iso(l.unlock_at),
        lockAt: iso(l.lock_at),
        setBy: l.set_by ?? "a staff account",
        setAt: iso(l.created_at),
      })),
    });
  });

  /* ----------------------------------------------------------
   * One override, written. Shared by the single-cell and the bulk route so
   * the two can never disagree about what "auto" or "a repeat toggle" means.
   * -------------------------------------------------------- */
  interface LockWrite {
    scope: "global" | "section" | "user";
    stageId: string;
    state: "locked" | "unlocked" | "auto";
    userId?: string | undefined;
    sectionId?: string | undefined;
    reason: string;
    unlockAt?: string | undefined;
    lockAt?: string | undefined;
  }

  async function writeLock(
    client: PoolClient,
    b: LockWrite,
    actorId: string,
    audit: Record<string, unknown>,
  ): Promise<void> {
    if (b.state === "auto") {
      // "auto" means: stop overriding, let the curriculum decide. Delete the
      // row rather than storing a no-op.
      await client.query(
        `delete from stage_locks
          where scope = $1 and stage_id = $2
            and coalesce(scope_user_id::text, '') = coalesce($3::text, '')
            and coalesce(scope_section_id::text, '') = coalesce($4::text, '')`,
        [b.scope, b.stageId, b.userId ?? null, b.sectionId ?? null],
      );
    } else {
      await client.query(
        `insert into stage_locks
           (scope, scope_user_id, scope_section_id, stage_id, state, unlock_at, lock_at, reason, actor_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict do nothing`,
        [
          b.scope, b.userId ?? null, b.sectionId ?? null, b.stageId, b.state,
          b.unlockAt ?? null, b.lockAt ?? null, b.reason, actorId,
        ],
      );
      // A repeat toggle should update, not silently no-op.
      await client.query(
        `update stage_locks
            set state = $5, unlock_at = $6, lock_at = $7, reason = $8,
                actor_id = $9, created_at = now()
          where scope = $1 and stage_id = $4
            and coalesce(scope_user_id::text, '') = coalesce($2::text, '')
            and coalesce(scope_section_id::text, '') = coalesce($3::text, '')`,
        [
          b.scope, b.userId ?? null, b.sectionId ?? null, b.stageId, b.state,
          b.unlockAt ?? null, b.lockAt ?? null, b.reason, actorId,
        ],
      );
    }

    await client.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1, 'lock.set', 'stage', $2, $3)`,
      [actorId, b.stageId, JSON.stringify(audit)],
    );
  }

  /* ----------------------------------------------------------
   * POST /api/v1/console/locks
   * -------------------------------------------------------- */
  const LockBody = z.object({
    scope: z.enum(["global", "section", "user"]),
    stageId: z.string().regex(/^\d{2}$/),
    state: z.enum(["locked", "unlocked", "auto"]),
    userId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    // Not optional. INV-22 requires it, and a toggle nobody can explain in
    // December is worse than no toggle.
    reason: z.string().trim().min(3).max(500),
    unlockAt: z.string().datetime().optional(),
    lockAt: z.string().datetime().optional(),
  });

  app.post("/api/v1/console/locks", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = LockBody.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest(
        "A lock needs a scope, a stage, a state, and a reason of at least 3 characters.",
      );
    }
    const b = body.data;

    if (b.scope === "user" && !b.userId) throw errors.badRequest("A user-scope lock needs a userId.");
    if (b.scope === "section" && !b.sectionId) {
      throw errors.badRequest("A section-scope lock needs a sectionId.");
    }
    // The table's lock_window_ordered check would refuse this too -- as a 500
    // with nothing a teacher can act on. Say it in words first.
    if (b.unlockAt && b.lockAt && Date.parse(b.lockAt) <= Date.parse(b.unlockAt)) {
      throw errors.badRequest("The window has to close after it opens.");
    }
    // A foreign-key violation would surface as a 500 nobody can act on.
    if (b.scope === "user") {
      const { rows } = await app.db.query(
        "select 1 from profiles where id = $1 and student_id is not null and deleted_at is null",
        [b.userId],
      );
      if (rows.length === 0) throw errors.badRequest("That student is not on the roster. Nothing was changed.");
    }
    if (b.scope === "section") {
      const { rows } = await app.db.query("select 1 from sections where id = $1", [b.sectionId]);
      if (rows.length === 0) throw errors.badRequest("That section does not exist. Nothing was changed.");
    }

    await withTransaction(app.db, (client) => writeLock(client, b, id.userId, b));

    return reply.send({ ok: true });
  });

  /* ----------------------------------------------------------
   * POST /api/v1/console/locks/bulk
   *
   * Shift-click bulk (PAGE-SPECS.md §/console/locks). One reason for every
   * cell, ONE transaction -- half a bulk change is worse than none, because
   * nobody can tell afterwards which half landed -- and one audit row per
   * cell, so `/audit` still answers "who opened stage 06 for Juan" without
   * anyone having to know a bulk change was involved.
   * -------------------------------------------------------- */
  const BulkBody = z.object({
    state: z.enum(["locked", "unlocked", "auto"]),
    reason: z.string().trim().min(3).max(500),
    cells: z
      .array(z.object({ userId: z.string().uuid(), stageId: z.string().regex(/^\d{2}$/) }))
      .min(1)
      .max(5000),
  });

  app.post("/api/v1/console/locks/bulk", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = BulkBody.safeParse(req.body);
    if (!body.success) {
      throw errors.badRequest(
        "A bulk change needs a state, at least one cell, and a reason of at least 3 characters.",
      );
    }
    const b = body.data;

    const userIds = [...new Set(b.cells.map((c) => c.userId))];
    const known = await app.db.query(
      `select id from profiles
        where id = any($1::uuid[]) and student_id is not null and deleted_at is null`,
      [userIds],
    );
    const missing = userIds.length - known.rows.length;
    if (missing > 0) {
      throw errors.badRequest(
        `${missing} of those students ${missing === 1 ? "is" : "are"} not on the roster. Nothing was changed.`,
      );
    }

    const count = b.cells.length;
    await withTransaction(app.db, async (client) => {
      for (const c of b.cells) {
        const one: LockWrite = {
          scope: "user", userId: c.userId, stageId: c.stageId, state: b.state, reason: b.reason,
        };
        await writeLock(client, one, id.userId, { ...one, bulk: count });
      }
    });

    return reply.send({ ok: true, count });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/students/:userId
   *
   * The page the instructor will use most: every attempt, and the EXACT
   * variant the student saw, regenerated from their stored seed.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/students/:userId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const userId = (req.params as { userId: string }).userId;

    // A student is a profile with a student ID. Staff profiles are not records
    // this page can show. The section is the directory's, as on the roster, so
    // the two pages never disagree about where a student is.
    const profile = await app.db.query(
      `select p.id, p.student_id, p.full_name, p.deleted_at,
              coalesce(d.section_id, p.section_id) as section_id, s.code as section_code,
              d.claimed_at
         from profiles p
         left join student_directory d on d.student_id = p.student_id
         left join sections s on s.id = coalesce(d.section_id, p.section_id)
        where p.id = $1 and p.student_id is not null`,
      [userId],
    );
    if (profile.rows.length === 0) throw errors.notFound("No such student.");
    const sections = await app.db.query("select id, code, term from sections order by code");

    const attempts = await app.db.query(
      `select a.id, a.attempt_no, a.status, a.score, a.max_score,
              a.started_at, a.submitted_at, a.engine_version,
              s.title as assessment_title, b.scope
         from attempts a
         join assessments s on s.id = a.assessment_id
         join blueprints  b on b.id = s.blueprint_id
        where a.user_id = $1
        order by a.started_at desc`,
      [userId],
    );

    const progress = await app.db.query(
      `select stage_id, mastery, best_score, attempts, last_seen_at
         from stage_progress where user_id = $1 order by stage_id`,
      [userId],
    );

    return reply.send({
      student: {
        userId: profile.rows[0].id,
        studentId: profile.rows[0].student_id,
        fullName: profile.rows[0].full_name,
        sectionId: profile.rows[0].section_id,
        sectionCode: profile.rows[0].section_code,
        claimedAt: profile.rows[0].claimed_at,
        deactivated: profile.rows[0].deleted_at !== null,
      },
      // For the record's "Move to section…", the same list the roster reads.
      sections: sections.rows.map((s) => ({ id: s.id, code: s.code, term: s.term })),
      attempts: attempts.rows.map((a) => ({
        attemptId: a.id,
        attemptNo: Number(a.attempt_no),
        status: a.status,
        score: a.score === null ? null : Number(a.score),
        maxScore: a.max_score === null ? null : Number(a.max_score),
        startedAt: a.started_at,
        submittedAt: a.submitted_at,
        engineVersion: a.engine_version,
        assessmentTitle: a.assessment_title,
        scope: a.scope,
      })),
      progress: progress.rows.map((p) => ({
        stageId: p.stage_id,
        mastery: Number(p.mastery),
        bestScore: p.best_score === null ? null : Number(p.best_score),
        attempts: Number(p.attempts),
        lastSeenAt: p.last_seen_at,
      })),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/attempts/:attemptId
   *
   * Regenerate the exact paper from the stored seed. This is why the seed is
   * stored at all: months later, from `seed` plus `engine_version`, the paper
   * the student actually sat is reconstructed byte for byte.
   * -------------------------------------------------------- */
  app.get("/api/v1/console/attempts/:attemptId", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const attemptId = (req.params as { attemptId: string }).attemptId;

    const attempt = await loadAttempt(app.db, attemptId);
    if (!attempt) throw errors.notFound("No such attempt.");

    const items = await loadResolvedPaper(
      app.db,
      attempt.attemptId,
      attempt.seed,
      attempt.engineVersion,
    );

    const responses = await app.db.query(
      "select ordinal, raw_answer, is_correct, points, time_ms, answered_at from responses where attempt_id = $1",
      [attemptId],
    );
    const byOrdinal = new Map(responses.rows.map((r) => [Number(r.ordinal), r]));

    return reply.send({
      attemptId,
      status: attempt.status,
      engineVersion: attempt.engineVersion,
      // Staff see the key. That is the whole point of the drill-down, and
      // `ai_after_submit` grants staff the same read at the database level.
      items: items.map((i) => {
        const r = byOrdinal.get(i.ordinal);
        return {
          ordinal: i.ordinal,
          type: i.type,
          stageId: i.stageId,
          objectiveId: i.objectiveId,
          stem: i.stem,
          options: i.options,
          resolvedParams: i.resolvedParams,
          correctValue: i.correctValue,
          rationale: i.rationale,
          studentAnswer: r?.raw_answer ?? null,
          isCorrect: r ? r.is_correct : null,
          timeMs: r?.time_ms ?? null,
        };
      }),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/content
   *
   * Authoring status per stage. This exists because the honest answer to "is
   * the course ready" is per-chapter, and an aggregate hides it.
   *
   * A stage is PLANNED until someone writes its prose. `scripts/gen-stages.mjs`
   * emits a callout carrying `meta.kind='planned'` for every chapter that has
   * only its syllabus outline, so the gap is a queryable fact rather than
   * something a reader has to notice.
   *
   * Chapters 1-7 are authored. 8-18 carry their objectives and topic outline
   * and say plainly that the teaching text is coming -- which is the honest
   * state, and better than prose nobody has checked.
   *
   * (`scaffold` is still matched so an older sync is not misreported as done.)
   * -------------------------------------------------------- */
  app.get("/api/v1/console/content", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      `select s.id, s.title, s.act, s.ordinal, s.archetype, s.levels,
              s.est_minutes, s.published, s.gradeable,
              (select count(*)::int from content_blocks cb where cb.stage_id = s.id)
                as blocks,
              (select count(*)::int from content_blocks cb
                where cb.stage_id = s.id and cb.meta->>'kind' in ('scaffold','planned'))
                as scaffold_blocks,
              (select count(*)::int from objectives o where o.stage_id = s.id)
                as objectives,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status = 'live')
                as live_items,
              (select count(*)::int from items i
                where i.stage_id = s.id and i.status <> 'live')
                as draft_items
         from stages s
        order by s.ordinal`,
    );

    const stages = rows.map((r) => {
      const blocks = Number(r.blocks);
      const scaffold = Number(r.scaffold_blocks);
      return {
        id: r.id,
        title: r.title,
        act: Number(r.act),
        ordinal: Number(r.ordinal),
        archetype: r.archetype,
        levels: r.levels,
        estMinutes: Number(r.est_minutes),
        published: r.published,
        gradeable: r.gradeable,
        blocks,
        objectives: Number(r.objectives),
        liveItems: Number(r.live_items),
        draftItems: Number(r.draft_items),
        // Three states, and they are genuinely different:
        //   empty     nothing synced at all
        //   scaffold  objectives and a topic outline, no teaching text
        //   authored  real prose exists
        authoring: blocks === 0 ? "empty" : scaffold > 0 ? "planned" : "authored",
      };
    });

    const gradeable = stages.filter((s) => s.gradeable);
    return reply.send({
      stages,
      summary: {
        total: stages.length,
        authored: stages.filter((s) => s.authoring === "authored").length,
        planned: stages.filter((s) => s.authoring === "planned").length,
        empty: stages.filter((s) => s.authoring === "empty").length,
        objectives: stages.reduce((a, s) => a + s.objectives, 0),
        liveItems: stages.reduce((a, s) => a + s.liveItems, 0),
        // PHASES.md targets ~40 live items per gradeable stage. The bank is the
        // schedule, so the shortfall is stated as a number rather than implied.
        itemTarget: gradeable.length * 40,
      },
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/audit
   * -------------------------------------------------------- */
  app.get("/api/v1/console/audit", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 100), 500);

    const { rows } = await app.db.query(
      `select l.id, l.action, l.target_type, l.target_id, l.payload, l.at,
              p.full_name as actor_name
         from audit_log l
         left join profiles p on p.id = l.actor_id
        order by l.at desc
        limit $1`,
      [limit],
    );

    return reply.send({ entries: rows });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/audit/system  -- the invariant suite
   * -------------------------------------------------------- */
  app.get("/api/v1/console/audit/system", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const { rows } = await app.db.query(
      "select id, name, severity, offending_count, sample from run_invariants() order by id",
    );

    // On an unseeded database the bank-health checks legitimately have nothing
    // to check. They are notices, not failures.
    const EXPECTED_EMPTY = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);
    const results = rows.map((r) => ({
      id: r.id,
      name: r.name,
      severity: EXPECTED_EMPTY.has(r.id) && Number(r.offending_count) > 0 ? "notice" : r.severity,
      offendingCount: Number(r.offending_count),
      sample: r.sample,
    }));

    return reply.send({
      results,
      failing: results.filter((r) => r.severity === "fail" && r.offendingCount > 0).length,
      ranAt: new Date().toISOString(),
    });
  });

  /* ----------------------------------------------------------
   * GET /api/v1/console/gradebook.csv
   * -------------------------------------------------------- */
  app.get("/api/v1/console/gradebook.csv", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const stages = await app.db.query(
      "select id from stages where gradeable order by ordinal",
    );
    const stageIds = stages.rows.map((s) => s.id as string);

    const { rows } = await app.db.query(
      `select p.student_id, p.full_name, sp.stage_id, sp.mastery
         from profiles p
         left join stage_progress sp on sp.user_id = p.id
        where p.student_id is not null and p.deleted_at is null
        order by p.student_id`,
    );

    const byStudent = new Map<string, { name: string; mastery: Map<string, number> }>();
    for (const r of rows) {
      const entry = byStudent.get(r.student_id) ?? { name: r.full_name, mastery: new Map() };
      if (r.stage_id) entry.mastery.set(r.stage_id, Number(r.mastery));
      byStudent.set(r.student_id, entry);
    }

    const escape = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const lines = [["student_id", "full_name", ...stageIds.map((s) => `stage_${s}`)].join(",")];
    for (const [studentId, entry] of byStudent) {
      lines.push(
        [
          escape(studentId),
          escape(entry.name),
          ...stageIds.map((s) => String(Math.round((entry.mastery.get(s) ?? 0) * 100))),
        ].join(","),
      );
    }

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="octa-gradebook.csv"')
      .send(lines.join("\n"));
  });
}
