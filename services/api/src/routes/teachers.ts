import type { FastifyInstance } from "fastify";
import type pg from "pg";
import {
  ClassAssignBody,
  ClassUpdateBody,
  TeacherImportBody,
  TeacherStatusBody,
  type Subject,
  type TeacherClass,
  type TeacherDetail,
  type TeacherRow,
  type TeachersResponse,
} from "@octa/contracts";
import { identityFrom, requireAdmin } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";
import type { SupabaseAdmin } from "./auth.js";

/**
 * Teachers, subjects and classes: the ADMIN's routes (T1, 7 Oct 2026;
 * docs/TEACHERS-AND-SUBJECTS-PLAN.md; db/addendum-teachers.sql).
 *
 * Every route is `requireAdmin()`. The admin is also a teacher, so they appear
 * in the list with their own classes. Every write is audited under `admin.*`
 * (the /audit page files those under Accounts) with the reason given.
 *
 * A teacher is never deleted and an admin is never disabled: the record is
 * evidence, and there is one admin to lock out. Disabling is the supported
 * path, as for students: a claimed account gets `profiles.deleted_at` (and,
 * when a Supabase project is configured, its login is banned); an unclaimed
 * roster row gets `status = 'disabled'`, so the ID cannot be claimed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StaffRow {
  key: string;
  user_id: string | null;
  employee_id: string | null;
  full_name: string;
  email: string | null;
  role: "teacher" | "admin";
  status: "active" | "unclaimed" | "disabled";
  last_sign_in_at: string | null;
  tokens_month: string | number | null;
}

/** Every teacher: a staff profile, a roster row, or both (claimed). */
const STAFF_SQL = `
  with staff as (
    select p.id as user_id, p.full_name, p.role::text as role, p.deleted_at, u.email,
           to_jsonb(u) ->> 'last_sign_in_at' as last_sign_in_at
      from profiles p join auth.users u on u.id = p.id
     where p.role in ('teacher','admin')
  )
  select coalesce(s.user_id::text, 'employee:' || d.employee_id) as key,
         s.user_id::text as user_id, d.employee_id,
         coalesce(s.full_name, d.full_name) as full_name,
         coalesce(s.email, d.email) as email,
         coalesce(s.role, d.role::text) as role,
         case when s.user_id is not null then case when s.deleted_at is null then 'active' else 'disabled' end
              when d.status = 'disabled' then 'disabled'
              else 'unclaimed' end as status,
         s.last_sign_in_at,
         (select coalesce(sum(coalesce(st.tokens_in, 0) + coalesce(st.tokens_out, 0)), 0)
            from assistant_steps st
           where st.owner_id = s.user_id and st.created_at >= date_trunc('month', now())) as tokens_month
    from staff s
    full outer join teacher_directory d on d.claimed_by = s.user_id`;

const CLASS_SQL = `
  select c.id::text, c.section_id::text, s.code as section_code, c.subject_code, c.term,
         c.book_id::text, c.teacher_id::text, c.ended_at,
         concat_ws(', ', coalesce(b.title, db.title), coalesce(b.edition, db.edition) || ' ed.') as book_label,
         (select count(*)::int from student_directory sd where sd.section_id = c.section_id) as students
    from classes c
    join sections s on s.id = c.section_id
    left join subject_books b on b.id = c.book_id
    left join subject_books db on db.subject_code = c.subject_code and db.is_default`;

function toClass(r: Record<string, unknown>): TeacherClass {
  return {
    id: r.id as string,
    sectionId: r.section_id as string,
    sectionCode: r.section_code as string,
    subjectCode: r.subject_code as string,
    term: r.term as string,
    bookId: (r.book_id as string | null) ?? null,
    bookLabel: (r.book_label as string | null) || null,
    students: Number(r.students ?? 0),
    endedAt: r.ended_at ? new Date(r.ended_at as string).toISOString() : null,
  };
}

function toTeacher(r: StaffRow, classes: TeacherClass[]): TeacherRow {
  return {
    key: r.key,
    userId: r.user_id,
    employeeId: r.employee_id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    status: r.status,
    classes,
    tokensThisMonth: Number(r.tokens_month ?? 0),
    lastSignInAt: r.last_sign_in_at ? new Date(r.last_sign_in_at).toISOString() : null,
  };
}

async function loadSubjects(db: pg.Pool): Promise<Subject[]> {
  const subjects = await db.query<{ code: string; title: string }>("select code, title from subjects order by code");
  const books = await db.query(
    "select id::text, subject_code, title, author, edition, is_default from subject_books order by subject_code, is_default desc, edition",
  );
  return subjects.rows.map((s) => ({
    code: s.code,
    title: s.title,
    books: books.rows
      .filter((b) => b.subject_code === s.code)
      .map((b) => ({ id: b.id, title: b.title, author: b.author, edition: b.edition, isDefault: b.is_default })),
  }));
}

async function loadSections(db: pg.Pool) {
  const r = await db.query<{ id: string; code: string; term: string }>("select id::text, code, term from sections order by code");
  return r.rows;
}

async function loadAll(db: pg.Pool): Promise<{ staff: StaffRow[]; classes: Record<string, unknown>[] }> {
  const staff = await db.query<StaffRow>(`${STAFF_SQL} order by 4`);
  const classes = await db.query(`${CLASS_SQL} order by s.code, c.subject_code, c.term`);
  return { staff: staff.rows, classes: classes.rows };
}

/** One teacher by key: a user id, or `employee:<id>` for an unclaimed row. */
async function findTeacher(db: pg.Pool | pg.PoolClient, key: string): Promise<StaffRow | null> {
  const r = await db.query<StaffRow>(`select * from (${STAFF_SQL}) t where t.key = $1`, [key]);
  return r.rows[0] ?? null;
}

function audit(client: pg.PoolClient, actor: string, action: string, targetType: string, targetId: string, payload: unknown) {
  return client.query(
    `insert into audit_log (actor_id, action, target_type, target_id, payload) values ($1, $2, $3, $4, $5)`,
    [actor, action, targetType, targetId, JSON.stringify(payload)],
  );
}

export function registerTeacherRoutes(app: FastifyInstance, env: Env, admin: SupabaseAdmin | null): void {
  /* GET /api/v1/console/teachers  (admin) */
  app.get("/api/v1/console/teachers", async (req, reply) => {
    requireAdmin(await identityFrom(req, env));
    const { staff, classes } = await loadAll(app.db);
    const teachers = staff.map((t) =>
      toTeacher(t, classes.filter((c) => t.user_id !== null && c.teacher_id === t.user_id).map(toClass)),
    );
    const body: TeachersResponse = {
      teachers,
      counts: {
        total: teachers.length,
        active: teachers.filter((t) => t.status === "active").length,
        unclaimed: teachers.filter((t) => t.status === "unclaimed").length,
        disabled: teachers.filter((t) => t.status === "disabled").length,
      },
      unassigned: classes.filter((c) => c.teacher_id === null && c.ended_at === null).map(toClass),
      sections: await loadSections(app.db),
      subjects: await loadSubjects(app.db),
    };
    return reply.send(body);
  });

  /* GET /api/v1/console/teachers/:key  (admin) */
  app.get<{ Params: { key: string } }>("/api/v1/console/teachers/:key", async (req, reply) => {
    requireAdmin(await identityFrom(req, env));
    const t = await findTeacher(app.db, req.params.key);
    if (!t) throw errors.notFound("That teacher does not exist.");
    const classes = t.user_id
      ? (await app.db.query(`${CLASS_SQL} where c.teacher_id = $1 order by c.ended_at nulls first, s.code`, [t.user_id])).rows.map(toClass)
      : [];
    const usage = t.user_id
      ? (await app.db.query(
          `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, coalesce(engine, 'unknown') as engine,
                  coalesce(sum(tokens_in), 0)::int as tokens_in, coalesce(sum(tokens_out), 0)::int as tokens_out,
                  coalesce(sum(cost_usd), 0)::float8 as cost
             from assistant_steps where owner_id = $1 and created_at >= now() - interval '12 months'
            group by 1, 2 order by 1, 2`,
          [t.user_id],
        )).rows.map((u) => ({
          month: u.month as string, engine: u.engine as string,
          tokensIn: Number(u.tokens_in), tokensOut: Number(u.tokens_out), costUsd: Number(u.cost),
        }))
      : [];
    const month = new Date().toISOString().slice(0, 7);
    const thisMonth = usage.filter((u) => u.month === month);
    const live = classes.filter((c) => c.endedAt === null);
    const body: TeacherDetail = {
      teacher: toTeacher(t, classes),
      stats: {
        classes: live.length,
        students: live.reduce((n, c) => n + c.students, 0),
        tokensThisMonth: thisMonth.reduce((n, u) => n + u.tokensIn + u.tokensOut, 0),
        costThisMonth: thisMonth.reduce((n, u) => n + u.costUsd, 0),
      },
      usage,
      sections: await loadSections(app.db),
      subjects: await loadSubjects(app.db),
    };
    return reply.send(body);
  });

  /*
   * POST /api/v1/console/teachers/import  (admin; dry run by default)
   *
   * The teacher roster, as the student import: the same plan for the dry run
   * and the apply. insert / unchanged / update / conflict, and a conflict says
   * why: `claimed` (a claimed row is never overwritten), `duplicate` (one ID
   * twice in the file).
   */
  app.post("/api/v1/console/teachers/import", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireAdmin(id);
    const parsed = TeacherImportBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("That roster could not be read. Each row needs an employee ID and a name.");
    const { rows, apply } = parsed.data;

    const existing = await app.db.query<{ employee_id: string; full_name: string; email: string | null; role: string; status: string }>(
      "select employee_id, full_name, email, role::text as role, status::text as status from teacher_directory where employee_id = any($1)",
      [rows.map((r) => r.employeeId)],
    );
    const known = new Map(existing.rows.map((r) => [r.employee_id, r]));
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.employeeId, (seen.get(r.employeeId) ?? 0) + 1);

    const plan = rows.map((r) => {
      const cur = known.get(r.employeeId);
      const base = {
        employeeId: r.employeeId, fullName: r.fullName, email: r.email ?? null, role: r.role,
        current: cur ? { fullName: cur.full_name, email: cur.email, role: cur.role, status: cur.status } : null,
      };
      if (seen.get(r.employeeId)! > 1) return { ...base, action: "conflict" as const, why: "duplicate" as const };
      if (!cur) return { ...base, action: "insert" as const };
      if (cur.full_name === r.fullName && (cur.email ?? null) === (r.email ?? null) && cur.role === r.role) {
        return { ...base, action: "unchanged" as const };
      }
      if (cur.status === "claimed") return { ...base, action: "conflict" as const, why: "claimed" as const };
      return { ...base, action: "update" as const };
    });
    const count = (a: string) => plan.filter((p) => p.action === a).length;
    const summary = { insert: count("insert"), update: count("update"), unchanged: count("unchanged"), conflict: count("conflict") };
    if (!apply) return reply.send({ dryRun: true, summary, plan });

    await withTransaction(app.db, async (client) => {
      for (const p of plan) {
        if (p.action !== "insert" && p.action !== "update") continue;
        // `status` is left alone on update: re-importing never re-enables a row.
        await client.query(
          `insert into teacher_directory (employee_id, full_name, email, role)
           values ($1, $2, $3, $4::user_role)
           on conflict (employee_id) do update
             set full_name = excluded.full_name, email = excluded.email, role = excluded.role`,
          [p.employeeId, p.fullName, p.email, p.role],
        );
      }
      await audit(client, id.userId, "admin.teacher_import", "teacher_directory", "roster", {
        summary,
        inserted: plan.filter((p) => p.action === "insert").map((p) => p.employeeId),
        updated: plan.filter((p) => p.action === "update").map((p) => p.employeeId),
      });
    });
    return reply.send({ dryRun: false, summary, plan });
  });

  /*
   * POST /api/v1/console/teachers/:key/status  { active, reason, confirm }  (admin)
   *
   * Disable or re-enable a teacher. Never an admin, never yourself. The
   * employee ID (or, for a staff account with none, the full name) is typed
   * to confirm, and the server checks it.
   */
  app.post<{ Params: { key: string } }>("/api/v1/console/teachers/:key/status", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireAdmin(id);
    const parsed = TeacherStatusBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Say why, in a few words, and type the employee ID to confirm.");
    const b = parsed.data;

    const t = await findTeacher(app.db, req.params.key);
    if (!t) throw errors.notFound("That teacher does not exist.");
    if (t.role === "admin") throw errors.forbidden("An admin is never disabled here.");
    if (t.user_id === id.userId) throw errors.forbidden("You cannot disable your own account.");
    if (b.confirm !== (t.employee_id ?? t.full_name)) {
      throw errors.badRequest("The confirmation does not match. Nothing was changed.");
    }

    await withTransaction(app.db, async (client) => {
      if (t.user_id) {
        await client.query(
          b.active
            ? "update profiles set deleted_at = null where id = $1"
            : "update profiles set deleted_at = coalesce(deleted_at, now()) where id = $1",
          [t.user_id],
        );
      } else {
        await client.query("update teacher_directory set status = $2 where employee_id = $1 and status <> 'claimed'", [
          t.employee_id, b.active ? "unclaimed" : "disabled",
        ]);
      }
      await audit(client, id.userId, b.active ? "admin.teacher_enable" : "admin.teacher_disable", "teacher", t.employee_id ?? t.key, {
        reason: b.reason, fullName: t.full_name, claimed: t.user_id !== null,
      });
    });
    // After the commit: a login ban outlives the token the teacher holds (up to an hour).
    if (t.user_id && admin?.setBanned) {
      await admin.setBanned(t.user_id, !b.active).catch((err: unknown) =>
        req.log.error({ err }, "teacher ban could not be set; the API still refuses them"),
      );
    }
    return reply.send({ ok: true, active: b.active });
  });

  /*
   * POST /api/v1/console/classes  (admin)
   *
   * Assign a class: one section, one subject, one term, a teacher (or none),
   * a book of that subject (or null: its default). An existing class of the
   * same section, subject and term is re-assigned and re-opened, not doubled.
   */
  app.post("/api/v1/console/classes", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireAdmin(id);
    const parsed = ClassAssignBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("A class needs a section, a subject, a term and a reason.");
    const b = parsed.data;

    const row = await withTransaction(app.db, async (client) => {
      if (b.teacherId) {
        const staff = await client.query("select 1 from profiles where id = $1 and role in ('teacher','admin') and deleted_at is null", [b.teacherId]);
        if (!staff.rowCount) throw errors.badRequest("That teacher cannot hold a class (not an active staff account).");
      }
      if (b.bookId) {
        const book = await client.query("select 1 from subject_books where id = $1 and subject_code = $2", [b.bookId, b.subjectCode]);
        if (!book.rowCount) throw errors.badRequest("That book is not one of this subject's books.");
      }
      const subject = await client.query("select 1 from subjects where code = $1", [b.subjectCode]);
      if (!subject.rowCount) throw errors.badRequest("That subject does not exist.");
      const r = await client.query<{ id: string }>(
        `insert into classes (section_id, subject_code, teacher_id, term, book_id)
         values ($1, $2, $3, $4, $5)
         on conflict (section_id, subject_code, term) do update
           set teacher_id = excluded.teacher_id, book_id = excluded.book_id, ended_at = null
         returning id::text`,
        [b.sectionId, b.subjectCode, b.teacherId, b.term, b.bookId],
      );
      await audit(client, id.userId, "admin.class_assign", "class", r.rows[0]!.id, {
        reason: b.reason, sectionId: b.sectionId, subjectCode: b.subjectCode, term: b.term,
        teacherId: b.teacherId, bookId: b.bookId,
      });
      return r.rows[0]!;
    });
    return reply.status(201).send({ ok: true, id: row.id });
  });

  /* PATCH /api/v1/console/classes/:id  { bookId?, teacherId?, ended?, reason }  (admin) */
  app.patch<{ Params: { id: string } }>("/api/v1/console/classes/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireAdmin(id);
    if (!UUID.test(req.params.id)) throw errors.notFound("That class does not exist.");
    const parsed = ClassUpdateBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Say why, in a few words. The reason goes to the audit log.");
    const b = parsed.data;

    await withTransaction(app.db, async (client) => {
      const cur = await client.query<{ subject_code: string }>("select subject_code from classes where id = $1 for update", [req.params.id]);
      const cls = cur.rows[0];
      if (!cls) throw errors.notFound("That class does not exist.");
      if (b.bookId) {
        const book = await client.query("select 1 from subject_books where id = $1 and subject_code = $2", [b.bookId, cls.subject_code]);
        if (!book.rowCount) throw errors.badRequest("That book is not one of this subject's books.");
      }
      if (b.teacherId) {
        const staff = await client.query("select 1 from profiles where id = $1 and role in ('teacher','admin') and deleted_at is null", [b.teacherId]);
        if (!staff.rowCount) throw errors.badRequest("That teacher cannot hold a class (not an active staff account).");
      }
      await client.query(
        `update classes
            set book_id = case when $2 then $3::uuid else book_id end,
                teacher_id = case when $4 then $5::uuid else teacher_id end,
                ended_at = case when $6::boolean is null then ended_at
                                when $6 then coalesce(ended_at, now()) else null end
          where id = $1`,
        [req.params.id, b.bookId !== undefined, b.bookId ?? null, b.teacherId !== undefined, b.teacherId ?? null, b.ended ?? null],
      );
      await audit(client, id.userId, "admin.class_update", "class", req.params.id, {
        reason: b.reason,
        ...(b.bookId !== undefined ? { bookId: b.bookId } : {}),
        ...(b.teacherId !== undefined ? { teacherId: b.teacherId } : {}),
        ...(b.ended !== undefined ? { ended: b.ended } : {}),
      });
    });
    return reply.send({ ok: true });
  });
}
