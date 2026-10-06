import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  CHAT_STORAGE_BYTES,
  ChatMime,
  ChatPostBody,
  ChatPruneBody,
  ChatReasonBody,
  ChatThreadBody,
  ChatUploadBody,
  type ChatAttachments,
  type ChatMessage,
  type ChatPerson,
  type ChatRoom,
  type ChatRooms,
  type ChatThread,
  type ChatUnread,
  type ChatUpload,
} from "@octa/contracts";
import { identityFrom, isStaff, requireStaff, type Identity } from "../auth.js";
import { AppError, errors } from "../errors.js";
import { withTransaction, type Db } from "../db.js";
import type { Env } from "../env.js";
import type { ChatStorage } from "../chat/storage.js";
import { submitLeftPapers } from "../sitting.js";

/**
 * The class chat (instructor, approved 6 Oct 2026; docs/CHAT-PLAN.md).
 *
 * One room per section, one private thread between each student and the
 * instructor. Every write is here: the tables have no client write policy.
 * Reads are here too, so the local stack (plain Postgres, dev tokens) works;
 * on the deployment Supabase Realtime tells an open page WHEN to read again,
 * through the same RLS predicate this file asks with `chat_member()`.
 *
 * **A paper open closes the chat** (ruling 3). The database refuses the post
 * whatever this file does (the insert trigger); this file answers `paper_open`
 * first so the page can say why instead of failing a send.
 *
 * The API bypasses RLS, so every route asks `chat_member()` itself. A room the
 * caller is not in is "not found", never "forbidden": confirming it exists
 * would let a student probe for another's private thread.
 */

const PAGE = 100;
/** A signed download lasts an hour; a page that stays open longer refetches. */
const SIGNED_SECONDS = 3600;

const EXT: Record<z.infer<typeof ChatMime>, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const RoomParams = z.object({ id: z.string().uuid() });
const MessageParams = z.object({ id: z.string().uuid() });
const ThreadQuery = z.object({ before: z.string().datetime({ offset: true }).optional() });

/** The paper that closes the chat, named (the newest, if somehow two are open). */
async function openPaper(db: Queryable, userId: string) {
  const { rows } = await db.query(
    `select s.id::text as assessment_id, s.title, b.stage_id, a.started_at
       from attempts a
       join assessments s on s.id = a.assessment_id
       join blueprints b on b.id = s.blueprint_id
      where a.user_id = $1 and a.status = 'in_progress' and b.scope <> 'objective'
        and (s.closes_at is null or s.closes_at > now())
      order by a.started_at desc limit 1`,
    [userId],
  );
  const r = rows[0];
  return r
    ? { assessmentId: r.assessment_id as string, title: r.title as string, stageId: (r.stage_id as string | null) ?? null, startedAt: new Date(r.started_at as Date).toISOString() }
    : null;
}

const paperOpen = (title?: string) =>
  new AppError(
    "paper_open",
    title
      ? `${title} is open. The chat opens again when you submit it.`
      : "You have a paper open. The chat opens again when you submit it.",
  );
const noRoom = () => errors.notFound("That room does not exist, or you are not in it.");

type Queryable = Pick<pg.PoolClient, "query"> | Db;

interface RoomRow {
  id: string;
  kind: "section" | "direct";
  section_code: string | null;
  section_students: number | null;
  student_name: string | null;
  student_no: string | null;
  unread: number;
  mentions: number;
  last_at: Date | null;
}

const ROOM_SELECT = `
  select r.id::text as id, r.kind, sec.code as section_code,
         (select count(*)::int from profiles x
           where x.section_id = r.section_id and x.role = 'student' and x.deleted_at is null) as section_students,
         sp.full_name as student_name, sp.student_id as student_no,
         (select count(*)::int from chat_messages m
           where m.room_id = r.id and m.author_id <> $1 and m.deleted_at is null
             and m.created_at > coalesce(cm.last_read_at, '-infinity')) as unread,
         (select count(*)::int from chat_messages m
           where m.room_id = r.id and m.author_id <> $1 and m.deleted_at is null
             and $1 = any(m.mentions)
             and m.created_at > coalesce(cm.last_read_at, '-infinity')) as mentions,
         (select max(m.created_at) from chat_messages m where m.room_id = r.id) as last_at
    from chat_rooms r
    left join sections sec on sec.id = r.section_id
    left join profiles sp on sp.id = r.student_id
    left join chat_members cm on cm.room_id = r.id and cm.user_id = $1`;

function toRoom(r: RoomRow, staff: boolean): ChatRoom {
  let title: string;
  let subtitle: string;
  if (r.kind === "section") {
    title = r.section_code ?? "Section";
    const n = r.section_students ?? 0;
    subtitle = staff ? `${n} student${n === 1 ? "" : "s"} and the instructor` : "Your section and the instructor";
  } else if (staff) {
    title = r.student_name ?? "A student";
    subtitle = r.student_no ? `${r.student_no} · private thread` : "Private thread";
  } else {
    title = "Instructor";
    subtitle = "Private: only you and the instructor";
  }
  return {
    id: r.id,
    kind: r.kind,
    title,
    subtitle,
    unread: Number(r.unread),
    mentions: Number(r.mentions),
    lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
  };
}

async function isPaperOpen(db: Queryable, userId: string): Promise<boolean> {
  const { rows } = await db.query(`select chat_paper_open($1) as open`, [userId]);
  return rows[0]?.open === true;
}

/** Students only: a paper open closes the chat. Staff are never closed out. */
async function guardPaper(db: Db, id: Identity): Promise<void> {
  // Ruling 4: a paper the student has left is submitted first, so it never
  // keeps the chat closed after they walked away from it.
  if (!isStaff(id)) await submitLeftPapers(db, id.userId);
  if (!isStaff(id) && (await isPaperOpen(db, id.userId))) throw paperOpen((await openPaper(db, id.userId))?.title);
}

async function requireMember(db: Queryable, id: Identity, roomId: string): Promise<void> {
  const { rows } = await db.query(`select chat_member($1, $2::uuid) as ok`, [id.userId, roomId]);
  if (rows[0]?.ok !== true) throw noRoom();
}

async function me(db: Queryable, id: Identity): Promise<ChatPerson> {
  const { rows } = await db.query(`select full_name from profiles where id = $1`, [id.userId]);
  return { id: id.userId, name: rows[0]?.full_name ?? (isStaff(id) ? "Instructor" : "You"), staff: isStaff(id) };
}

/** A room appears the first time anyone who belongs in it opens the chat. */
async function ensureRooms(db: Queryable, id: Identity): Promise<void> {
  if (isStaff(id)) {
    await db.query(
      `insert into chat_rooms (kind, section_id)
       select 'section', s.id from sections s
       on conflict (section_id) where kind = 'section' do nothing`,
    );
    return;
  }
  await db.query(
    `insert into chat_rooms (kind, section_id)
     select 'section', p.section_id from profiles p
      where p.id = $1 and p.section_id is not null and p.deleted_at is null
     on conflict (section_id) where kind = 'section' do nothing`,
    [id.userId],
  );
  await db.query(
    `insert into chat_rooms (kind, student_id)
     select 'direct', p.id from profiles p where p.id = $1 and p.deleted_at is null
     on conflict (student_id) where kind = 'direct' do nothing`,
    [id.userId],
  );
}

async function roomById(db: Queryable, id: Identity, roomId: string): Promise<ChatRoom> {
  const { rows } = await db.query<RoomRow>(`${ROOM_SELECT} where r.id = $2::uuid`, [id.userId, roomId]);
  const r = rows[0];
  if (!r) throw noRoom();
  return toRoom(r, isStaff(id));
}

interface MessageRow {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string | null;
  author_staff: boolean;
  body: string | null;
  mentions: string[];
  attachment_path: string | null;
  attachment_mime: string | null;
  attachment_bytes: number | null;
  attachment_name: string | null;
  attachment_removed_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
}

const MESSAGE_SELECT = `
  select m.id::text, m.room_id::text, m.author_id::text, p.full_name as author_name,
         coalesce(p.role in ('teacher','admin'), false) as author_staff,
         m.body, m.mentions::text[] as mentions, m.attachment_path, m.attachment_mime,
         m.attachment_bytes, m.attachment_name, m.attachment_removed_at, m.deleted_at, m.created_at
    from chat_messages m
    left join profiles p on p.id = m.author_id`;

function toMessage(r: MessageRow, viewer: string, urls: Map<string, string>): ChatMessage {
  const mime = ChatMime.safeParse(r.attachment_mime);
  return {
    id: r.id,
    roomId: r.room_id,
    author: { id: r.author_id, name: r.author_name ?? (r.author_staff ? "Instructor" : "A student"), staff: r.author_staff },
    body: r.body,
    mentions: r.mentions ?? [],
    attachment:
      r.attachment_path && mime.success && r.attachment_bytes
        ? {
            name: r.attachment_name ?? `attachment.${EXT[mime.data]}`,
            mime: mime.data,
            bytes: Number(r.attachment_bytes),
            url: urls.get(r.attachment_path) ?? null,
          }
        : null,
    attachmentRemoved: r.attachment_removed_at !== null,
    deleted: r.deleted_at !== null,
    mine: r.author_id === viewer,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

async function signFor(storage: ChatStorage | null, rows: readonly MessageRow[], log: (e: unknown) => void) {
  const paths = rows.map((r) => r.attachment_path).filter((p): p is string => p !== null);
  if (!storage || paths.length === 0) return new Map<string, string>();
  try {
    return await storage.signDownloads(paths, SIGNED_SECONDS);
  } catch (e) {
    // A storage hiccup must not blank the conversation: the text still loads,
    // and an attachment says it could not be fetched.
    log(e);
    return new Map<string, string>();
  }
}

/** Map the insert trigger's refusals onto the one error shape. */
function fromTrigger(err: unknown): never {
  const e = err as { code?: string };
  if (e.code === "P0423") throw paperOpen();
  if (e.code === "42501") throw noRoom();
  if (e.code === "22023") throw errors.badRequest("A mention or attachment does not belong to this room.");
  throw err;
}

async function audit(db: Queryable, actor: string, action: string, target: string, payload: unknown) {
  await db.query(
    `insert into audit_log (actor_id, action, target_type, target_id, payload)
     values ($1, $2, 'chat_message', $3, $4::jsonb)`,
    [actor, action, target, JSON.stringify(payload)],
  );
}

export function registerChatRoutes(app: FastifyInstance, env: Env, storage: ChatStorage | null): void {
  const log = (e: unknown) => app.log.warn({ err: (e as Error).message }, "chat storage call failed");

  /* GET /api/v1/chat/rooms — the rooms the caller is in, with unread counts. */
  app.get("/api/v1/chat/rooms", async (req): Promise<ChatRooms> => {
    const id = await identityFrom(req, env);
    await guardPaper(app.db, id);
    await ensureRooms(app.db, id);
    const staff = isStaff(id);
    // Staff see every section's room, and a private thread once it has a message.
    const { rows } = await app.db.query<RoomRow>(
      `${ROOM_SELECT}
        where chat_member($1, r.id)
          and (r.kind = 'section' or not $2::boolean
               or exists (select 1 from chat_messages m where m.room_id = r.id))
        order by (r.kind = 'direct'), sec.code nulls last,
                 (select max(m.created_at) from chat_messages m where m.room_id = r.id) desc nulls last`,
      [id.userId, staff],
    );
    return {
      me: await me(app.db, id),
      rooms: rows.map((r) => toRoom(r, staff)),
      attachments: storage !== null,
    };
  });

  /* GET /api/v1/chat/unread — the Chat nav item's count. Cheap; no rooms created. */
  app.get("/api/v1/chat/unread", async (req): Promise<ChatUnread> => {
    const id = await identityFrom(req, env);
    if (!isStaff(id)) await submitLeftPapers(app.db, id.userId);
    if (!isStaff(id) && (await isPaperOpen(app.db, id.userId))) {
      return { mentions: 0, closed: true, paper: await openPaper(app.db, id.userId) };
    }
    const { rows } = await app.db.query(
      `select count(*)::int as n
         from chat_messages m
         left join chat_members cm on cm.room_id = m.room_id and cm.user_id = $1
        where $1 = any(m.mentions) and m.author_id <> $1 and m.deleted_at is null
          and m.created_at > coalesce(cm.last_read_at, '-infinity')
          and chat_member($1, m.room_id)`,
      [id.userId],
    );
    return { mentions: Number(rows[0]?.n ?? 0), closed: false, paper: null };
  });

  /* POST /api/v1/chat/threads — staff open a private thread with one student. */
  app.post("/api/v1/chat/threads", async (req, reply): Promise<ChatRoom> => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const body = ChatThreadBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("Choose a student.");
    const { rows } = await app.db.query(
      `insert into chat_rooms (kind, student_id)
       select 'direct', p.id from profiles p
        where p.id = $1 and p.role = 'student' and p.deleted_at is null
       on conflict (student_id) where kind = 'direct' do update set kind = excluded.kind
       returning id::text`,
      [body.data.userId],
    );
    const roomId = rows[0]?.id as string | undefined;
    if (!roomId) throw errors.notFound("No such student.");
    reply.status(201);
    return roomById(app.db, id, roomId);
  });

  /* GET /api/v1/chat/rooms/:id — the latest messages and who can be mentioned. */
  app.get("/api/v1/chat/rooms/:id", async (req): Promise<ChatThread> => {
    const id = await identityFrom(req, env);
    const params = RoomParams.safeParse(req.params);
    if (!params.success) throw noRoom();
    const q = ThreadQuery.safeParse(req.query);
    if (!q.success) throw errors.badRequest("That page of the conversation could not be read.");
    const roomId = params.data.id;
    await guardPaper(app.db, id);
    await requireMember(app.db, id, roomId);

    const [room, msgs, members] = await Promise.all([
      roomById(app.db, id, roomId),
      app.db.query<MessageRow>(
        `${MESSAGE_SELECT}
          where m.room_id = $1 and ($2::timestamptz is null or m.created_at < $2::timestamptz)
          order by m.created_at desc, m.id desc
          limit ${PAGE + 1}`,
        [roomId, q.data.before ?? null],
      ),
      app.db.query(
        `select p.id::text, p.full_name as name, p.role in ('teacher','admin') as staff
           from profiles p
          where chat_belongs(p.id, $1::uuid)
          order by (p.role = 'student'), p.full_name`,
        [roomId],
      ),
    ]);
    const more = msgs.rows.length > PAGE;
    const page = msgs.rows.slice(0, PAGE).reverse();
    const urls = await signFor(storage, page, log);
    return {
      room,
      messages: page.map((r) => toMessage(r, id.userId, urls)),
      more,
      members: members.rows.map((m) => ({ id: m.id as string, name: m.name as string, staff: m.staff === true })),
    };
  });

  /* POST /api/v1/chat/rooms/:id/read — "I have read up to now". */
  app.post("/api/v1/chat/rooms/:id/read", async (req, reply) => {
    const id = await identityFrom(req, env);
    const params = RoomParams.safeParse(req.params);
    if (!params.success) throw noRoom();
    await guardPaper(app.db, id);
    await requireMember(app.db, id, params.data.id);
    await app.db.query(
      `insert into chat_members (room_id, user_id, last_read_at) values ($1, $2, now())
       on conflict (room_id, user_id) do update set last_read_at = now()`,
      [params.data.id, id.userId],
    );
    return reply.status(204).send();
  });

  /* POST /api/v1/chat/rooms/:id/uploads — sign ONE upload, to a path chosen here. */
  app.post(
    "/api/v1/chat/rooms/:id/uploads",
    { config: { rateLimit: { max: 20 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply): Promise<ChatUpload> => {
      const id = await identityFrom(req, env);
      const params = RoomParams.safeParse(req.params);
      if (!params.success) throw noRoom();
      const body = ChatUploadBody.safeParse(req.body);
      if (!body.success) {
        throw errors.badRequest("Attach a screenshot (PNG, JPEG, GIF, WebP) or a video (MP4, WebM, MOV) of 25 MB or less.");
      }
      await guardPaper(app.db, id);
      await requireMember(app.db, id, params.data.id);
      if (!storage) throw errors.conflict("Attachments are not available on this server: it has no file storage.");
      const path = `${params.data.id}/${id.userId}/${randomUUID()}.${EXT[body.data.mime]}`;
      try {
        const uploadUrl = await storage.signUpload(path);
        reply.status(201);
        return { path, uploadUrl };
      } catch (e) {
        throw errors.internal((e as Error).message);
      }
    },
  );

  /* POST /api/v1/chat/rooms/:id/messages — send. */
  app.post(
    "/api/v1/chat/rooms/:id/messages",
    { config: { rateLimit: { max: 30 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply): Promise<ChatMessage> => {
      const id = await identityFrom(req, env);
      const params = RoomParams.safeParse(req.params);
      if (!params.success) throw noRoom();
      const parsed = ChatPostBody.safeParse(req.body);
      if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Write something or attach a file.");
      const roomId = params.data.id;
      await guardPaper(app.db, id);
      await requireMember(app.db, id, roomId);

      const body = parsed.data.body && parsed.data.body.length > 0 ? parsed.data.body : null;
      const mentions = [...new Set(parsed.data.mentions)].filter((m) => m !== id.userId);

      let attachment: { path: string; name: string; mime: string; bytes: number } | null = null;
      if (parsed.data.attachment) {
        const { path, name } = parsed.data.attachment;
        if (!storage) throw errors.conflict("Attachments are not available on this server: it has no file storage.");
        // Only a path this route would have signed for this room and this author.
        const shape = new RegExp(`^${roomId}/${id.userId}/[0-9a-f-]{36}\\.(png|jpg|gif|webp|mp4|webm|mov)$`);
        if (!shape.test(path)) throw errors.badRequest("That attachment was not uploaded for this room.");
        let stored;
        try {
          stored = await storage.stat(path);
        } catch (e) {
          throw errors.internal((e as Error).message);
        }
        const mime = ChatMime.safeParse(stored?.mime);
        if (!stored || !mime.success) throw errors.badRequest("The attachment did not finish uploading. Attach it again.");
        attachment = { path, name, mime: mime.data, bytes: stored.bytes };
      }

      let inserted: string;
      try {
        const { rows } = await app.db.query(
          `insert into chat_messages (room_id, author_id, body, mentions,
                                      attachment_path, attachment_mime, attachment_bytes, attachment_name)
           values ($1, $2, $3, $4::uuid[], $5, $6, $7, $8)
           returning id::text`,
          [roomId, id.userId, body, mentions, attachment?.path ?? null, attachment?.mime ?? null,
           attachment?.bytes ?? null, attachment?.name ?? null],
        );
        inserted = rows[0].id as string;
      } catch (e) {
        fromTrigger(e);
      }
      // Sending marks the room read up to the message just sent.
      await app.db.query(
        `insert into chat_members (room_id, user_id, last_read_at) values ($1, $2, now())
         on conflict (room_id, user_id) do update set last_read_at = now()`,
        [roomId, id.userId],
      );
      const { rows } = await app.db.query<MessageRow>(`${MESSAGE_SELECT} where m.id = $1`, [inserted]);
      const urls = await signFor(storage, rows, log);
      reply.status(201);
      return toMessage(rows[0]!, id.userId, urls);
    },
  );

  /*
   * DELETE /api/v1/chat/messages/:id — the author deletes their own; the
   * instructor removes anyone's (moderation, audited with the text, which only
   * staff can read in /audit). Either way the text is gone from the room.
   */
  app.delete("/api/v1/chat/messages/:id", async (req, reply) => {
    const id = await identityFrom(req, env);
    const params = MessageParams.safeParse(req.params);
    if (!params.success) throw errors.notFound();
    const staff = isStaff(id);
    if (!staff) await guardPaper(app.db, id);
    // Removing someone else's message needs a reason (checked once we know whose it is).
    const reason = ChatReasonBody.safeParse(req.body ?? {});

    const removedPath = await withTransaction(app.db, async (tx) => {
      const { rows } = await tx.query(
        `select m.room_id::text, m.author_id::text, m.body, m.attachment_path, m.attachment_name, m.deleted_at,
                chat_member($2, m.room_id) as member
           from chat_messages m where m.id = $1 for update`,
        [params.data.id, id.userId],
      );
      const m = rows[0];
      if (!m || m.member !== true) throw errors.notFound();
      const own = m.author_id === id.userId;
      if (!own && !staff) throw errors.notFound();
      if (m.deleted_at !== null) return null;
      if (!own && !reason.success) throw errors.badRequest("Say why you are removing it, in a few words.");
      await tx.query(
        `update chat_messages
            set deleted_at = now(), deleted_by = $2, body = null, mentions = '{}',
                attachment_path = null, attachment_mime = null, attachment_bytes = null, attachment_name = null
          where id = $1`,
        [params.data.id, id.userId],
      );
      if (!own) {
        await audit(tx, id.userId, "chat.message.removed", params.data.id, {
          reason: reason.success ? reason.data.reason : null,
          room: m.room_id,
          author: m.author_id,
          body: m.body,
          attachment: m.attachment_name,
        });
      }
      return (m.attachment_path as string | null) ?? null;
    });
    if (removedPath && storage) await storage.remove([removedPath]).catch(log);
    return reply.status(204).send();
  });

  /* ---------------- the instructor's storage view (ruling 2) ---------------- */

  app.get("/api/v1/chat/attachments", async (req): Promise<ChatAttachments> => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const { rows } = await app.db.query(
      `select m.id::text as message_id, coalesce(sec.code, sp.full_name, 'Private thread') as room,
              coalesce(p.full_name, 'Unknown') as author, m.attachment_name as name,
              m.attachment_mime as mime, m.attachment_bytes as bytes, m.created_at
         from chat_messages m
         join chat_rooms r on r.id = m.room_id
         left join sections sec on sec.id = r.section_id
         left join profiles sp on sp.id = r.student_id
         left join profiles p on p.id = m.author_id
        where m.attachment_path is not null
        order by m.created_at asc`,
    );
    const items = rows.map((r) => ({
      messageId: r.message_id as string,
      room: r.room as string,
      author: r.author as string,
      name: (r.name as string | null) ?? "attachment",
      mime: ChatMime.parse(r.mime),
      bytes: Number(r.bytes),
      createdAt: new Date(r.created_at as Date).toISOString(),
    }));
    return {
      usedBytes: items.reduce((s, i) => s + i.bytes, 0),
      limitBytes: CHAT_STORAGE_BYTES,
      items,
    };
  });

  /** Clear attachments from messages (the messages stay), then the files. */
  async function removeAttachments(actor: string, ids: readonly string[], action: string, extra: object) {
    const removed = await withTransaction(app.db, async (tx) => {
      const { rows } = await tx.query(
        `update chat_messages m
            set attachment_path = null, attachment_mime = null, attachment_bytes = null, attachment_name = null
           from (select id, attachment_path as path, attachment_bytes as bytes, attachment_name as name
                   from chat_messages where id = any($1::uuid[]) and attachment_path is not null
                   for update) old
          where m.id = old.id
          returning old.id::text, old.path, old.bytes, old.name`,
        [ids],
      );
      if (rows.length > 0) {
        await audit(tx, actor, action, rows.length === 1 ? (rows[0].id as string) : `${rows.length} messages`, {
          ...extra,
          files: rows.map((r) => ({ message: r.id, name: r.name, bytes: Number(r.bytes) })),
        });
      }
      return rows;
    });
    if (storage && removed.length > 0) await storage.remove(removed.map((r) => r.path as string)).catch(log);
    return { removed: removed.length, bytes: removed.reduce((s, r) => s + Number(r.bytes), 0) };
  }

  app.delete("/api/v1/chat/messages/:id/attachment", async (req) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const params = MessageParams.safeParse(req.params);
    if (!params.success) throw errors.notFound();
    const reason = ChatReasonBody.safeParse(req.body);
    if (!reason.success) throw errors.badRequest("Say why you are removing it, in a few words.");
    const r = await removeAttachments(id.userId, [params.data.id], "chat.attachment.removed", { reason: reason.data.reason });
    if (r.removed === 0) throw errors.notFound("That message has no attachment.");
    return r;
  });

  app.post("/api/v1/chat/attachments/prune", async (req) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const body = ChatPruneBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("Say how many days old (1 to 365) and why, in a few words.");
    const { rows } = await app.db.query(
      `select id::text from chat_messages
        where attachment_path is not null and created_at < now() - make_interval(days => $1)`,
      [body.data.olderThanDays],
    );
    return removeAttachments(id.userId, rows.map((r) => r.id as string), "chat.attachments.pruned", {
      olderThanDays: body.data.olderThanDays,
      reason: body.data.reason,
    });
  });
}
