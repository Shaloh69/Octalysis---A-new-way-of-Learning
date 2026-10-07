import type { FastifyInstance } from "fastify";
import type pg from "pg";
import {
  BookCreateBody, BookDefaultBody, BookUpdateBody, SubjectCreateBody, SubjectRenameBody,
  type StudioSubjectsResponse,
} from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction } from "../db.js";
import type { Env } from "../env.js";

/**
 * Course Studio, CS1: subjects and their books (docs/COURSE-STUDIO-PLAN.md
 * §3; ruling 3, 7 Oct 2026, night: "every teacher, fully").
 *
 * EVERY teacher writes them, here, under `requireStaff()`, each write with a
 * reason and an `audit_log` row. The RLS on `subjects` and `subject_books`
 * stays "no client write" (addendum-teachers.sql): a staff token cannot go
 * round this file. Nothing is deleted: classes refer to a subject and a
 * book, so a wrong one is renamed or edited. A subject's code is its key and
 * is never changed; a new code is a new subject.
 *
 * Only CPE 412 has chapters until CS2 keys the stages by subject.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The subject whose chapters the `stages` table holds (CS2 keys them by subject). */
export const CONTENT_SUBJECT = "CPE 412";

function audit(client: pg.PoolClient, actor: string, action: string, targetType: string, targetId: string, payload: unknown) {
  return client.query(
    `insert into audit_log (actor_id, action, target_type, target_id, payload) values ($1, $2, $3, $4, $5)`,
    [actor, action, targetType, targetId, JSON.stringify(payload)],
  );
}

const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";

export function registerSubjectRoutes(app: FastifyInstance, env: Env): void {
  /* GET /api/v1/console/subjects  (staff) */
  app.get("/api/v1/console/subjects", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const subjects = await app.db.query<{ code: string; title: string; total: number; assigned: number }>(
      `select s.code, s.title,
              (select count(*)::int from classes c where c.subject_code = s.code and c.ended_at is null) as total,
              (select count(*)::int from classes c where c.subject_code = s.code and c.ended_at is null and c.teacher_id is not null) as assigned
         from subjects s order by s.code`,
    );
    const books = await app.db.query(
      "select id::text, subject_code, title, author, edition, is_default from subject_books order by subject_code, is_default desc, edition nulls last, title",
    );
    const mine = await app.db.query<{ subject_code: string }>(
      "select distinct subject_code from classes where teacher_id = $1 and ended_at is null",
      [id.userId],
    );
    const role = id.role === "admin" ? "admin" : "teacher";
    const body: StudioSubjectsResponse = {
      subjects: subjects.rows.map((s) => ({
        code: s.code,
        title: s.title,
        books: books.rows
          .filter((b) => b.subject_code === s.code)
          .map((b) => ({ id: b.id, title: b.title, author: b.author, edition: b.edition, isDefault: b.is_default })),
        classes: { total: Number(s.total), assigned: Number(s.assigned) },
        hasChapters: s.code === CONTENT_SUBJECT,
      })),
      me: {
        role,
        approves: role === "admin" ? subjects.rows.map((s) => s.code) : mine.rows.map((r) => r.subject_code),
      },
    };
    return reply.send(body);
  });

  /* POST /api/v1/console/subjects  { code, title, reason }  (staff) */
  app.post("/api/v1/console/subjects", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const parsed = SubjectCreateBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("A subject needs a course code (like CPE 413), a title and a reason.");
    const b = parsed.data;
    try {
      await withTransaction(app.db, async (client) => {
        await client.query("insert into subjects (code, title) values ($1, $2)", [b.code, b.title]);
        await audit(client, id.userId, "subject.create", "subject", b.code, { reason: b.reason, title: b.title });
      });
    } catch (e) {
      if (isUnique(e)) throw errors.conflict(`${b.code} already exists. Rename it instead.`);
      throw e;
    }
    return reply.status(201).send({ ok: true, code: b.code });
  });

  /* PATCH /api/v1/console/subjects/:code  { title, reason }  (staff) */
  app.patch<{ Params: { code: string } }>("/api/v1/console/subjects/:code", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const parsed = SubjectRenameBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("A new title and a reason.");
    const code = req.params.code;
    await withTransaction(app.db, async (client) => {
      const cur = await client.query<{ title: string }>("select title from subjects where code = $1 for update", [code]);
      const row = cur.rows[0];
      if (!row) throw errors.notFound("That subject does not exist.");
      await client.query("update subjects set title = $2 where code = $1", [code, parsed.data.title]);
      await audit(client, id.userId, "subject.rename", "subject", code, {
        reason: parsed.data.reason, from: row.title, to: parsed.data.title,
      });
    });
    return reply.send({ ok: true });
  });

  /* POST /api/v1/console/subjects/:code/books  { title, author?, edition?, isDefault?, reason }  (staff) */
  app.post<{ Params: { code: string } }>("/api/v1/console/subjects/:code/books", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const parsed = BookCreateBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("A book needs a title and a reason.");
    const b = parsed.data;
    const code = req.params.code;
    let bookId = "";
    try {
      await withTransaction(app.db, async (client) => {
        const subject = await client.query("select 1 from subjects where code = $1 for update", [code]);
        if (!subject.rowCount) throw errors.notFound("That subject does not exist.");
        const others = await client.query<{ n: number }>("select count(*)::int as n from subject_books where subject_code = $1", [code]);
        const makeDefault = b.isDefault === true || Number(others.rows[0]!.n) === 0;
        if (makeDefault) await client.query("update subject_books set is_default = false where subject_code = $1 and is_default", [code]);
        const r = await client.query<{ id: string }>(
          `insert into subject_books (subject_code, title, author, edition, is_default)
           values ($1, $2, $3, $4, $5) returning id::text`,
          [code, b.title, b.author ?? null, b.edition ?? null, makeDefault],
        );
        bookId = r.rows[0]!.id;
        await audit(client, id.userId, "book.create", "subject_book", bookId, {
          reason: b.reason, subjectCode: code, title: b.title, author: b.author ?? null, edition: b.edition ?? null, isDefault: makeDefault,
        });
      });
    } catch (e) {
      if (isUnique(e)) throw errors.conflict("That book, in that edition, is already one of this subject's books.");
      throw e;
    }
    return reply.status(201).send({ ok: true, id: bookId });
  });

  /* PATCH /api/v1/console/books/:id  { title?, author?, edition?, reason }  (staff) */
  app.patch<{ Params: { id: string } }>("/api/v1/console/books/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    if (!UUID.test(req.params.id)) throw errors.notFound("That book does not exist.");
    const parsed = BookUpdateBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Say what changes, and why.");
    const b = parsed.data;
    try {
      await withTransaction(app.db, async (client) => {
        const cur = await client.query<{ title: string; author: string | null; edition: string | null; subject_code: string }>(
          "select title, author, edition, subject_code from subject_books where id = $1 for update",
          [req.params.id],
        );
        const row = cur.rows[0];
        if (!row) throw errors.notFound("That book does not exist.");
        const next = {
          title: b.title ?? row.title,
          author: b.author === undefined ? row.author : b.author,
          edition: b.edition === undefined ? row.edition : b.edition,
        };
        await client.query("update subject_books set title = $2, author = $3, edition = $4 where id = $1", [
          req.params.id, next.title, next.author, next.edition,
        ]);
        await audit(client, id.userId, "book.update", "subject_book", req.params.id, {
          reason: b.reason, subjectCode: row.subject_code,
          from: { title: row.title, author: row.author, edition: row.edition }, to: next,
        });
      });
    } catch (e) {
      if (isUnique(e)) throw errors.conflict("That book, in that edition, is already one of this subject's books.");
      throw e;
    }
    return reply.send({ ok: true });
  });

  /* POST /api/v1/console/books/:id/default  { reason }  (staff) */
  app.post<{ Params: { id: string } }>("/api/v1/console/books/:id/default", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    if (!UUID.test(req.params.id)) throw errors.notFound("That book does not exist.");
    const parsed = BookDefaultBody.safeParse(req.body);
    if (!parsed.success) throw errors.badRequest("Say why, in a few words. The reason goes to the audit log.");
    await withTransaction(app.db, async (client) => {
      const cur = await client.query<{ subject_code: string; is_default: boolean }>(
        "select subject_code, is_default from subject_books where id = $1 for update",
        [req.params.id],
      );
      const row = cur.rows[0];
      if (!row) throw errors.notFound("That book does not exist.");
      if (row.is_default) return;
      const prev = await client.query<{ id: string }>(
        "select id::text from subject_books where subject_code = $1 and is_default",
        [row.subject_code],
      );
      // One default per subject (a unique partial index): clear, then set.
      await client.query("update subject_books set is_default = false where subject_code = $1 and is_default", [row.subject_code]);
      await client.query("update subject_books set is_default = true where id = $1", [req.params.id]);
      await audit(client, id.userId, "book.default", "subject_book", req.params.id, {
        reason: parsed.data.reason, subjectCode: row.subject_code, previous: prev.rows[0]?.id ?? null,
      });
    });
    return reply.send({ ok: true });
  });
}
