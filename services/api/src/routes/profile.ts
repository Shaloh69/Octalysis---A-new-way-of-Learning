import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AvatarSetBody,
  AvatarUploadBody,
  ChatReasonBody,
  PROFILE_IMAGE_MAX_BYTES,
  type Profile,
  type ProfileClass,
} from "@octa/contracts";
import { identityFrom, requireStaff } from "../auth.js";
import { errors } from "../errors.js";
import { withTransaction, type Db } from "../db.js";
import type { Env } from "../env.js";
import type { BucketStorage } from "../chat/storage.js";
import { avatarsFor, looksLikeWebp } from "../avatars.js";

/**
 * Profile pages and pictures (PROFILES, 8 Oct 2026; docs/PROFILES-PLAN.md).
 *
 * Every write is here: `profiles`' picture columns have no client write path,
 * and a trigger refuses a change unless THIS file's transaction says it is the
 * API's (`app.allow_avatar_change`, db/addendum-profiles.sql). The bucket has
 * no client policy either, so a picture reaches storage only by a one-time
 * signed upload to a path chosen here, and the browser has already cropped it
 * to a square and re-encoded it to WebP (which drops EXIF, GPS included).
 * This file does not trust that: it checks the stored file is at most 300 KB
 * and that its first bytes really are a WebP before it records the path.
 *
 * Who may SEE a picture and who may REMOVE one are the database's questions
 * (`can_see_avatar`, `can_remove_avatar`), asked here because the API bypasses
 * RLS. A removal by a teacher or the admin is audited, and the person is told.
 */

const UserParams = z.object({ userId: z.string().uuid() });

/** The one shape a path may have: the person's folder, a random name, .webp. */
function pathShape(userId: string): RegExp {
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.webp$`);
}

type Tx = Parameters<Parameters<typeof withTransaction>[1]>[0];

/** Run as the API: the picture columns may change in this transaction only. */
function asApi<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTransaction(db, async (tx) => {
    await tx.query("select set_config('app.allow_avatar_change', 'on', true)");
    return fn(tx);
  });
}

export function registerProfileRoutes(app: FastifyInstance, env: Env, storage: BucketStorage | null): void {
  const log = (e: unknown) => app.log.warn({ err: (e as Error).message }, "profile storage call failed");

  async function loadProfile(userId: string): Promise<Profile> {
    const { rows } = await app.db.query(
      `select p.id::text as id, p.full_name, p.role::text as role, p.student_id, sec.code as section,
              p.avatar_path is not null as has_picture, p.avatar_removed_at, p.tour_seen_at,
              (select td.employee_id from teacher_directory td where td.claimed_by = p.id) as employee_id
         from profiles p
         left join sections sec on sec.id = p.section_id
        where p.id = $1 and p.deleted_at is null`,
      [userId],
    );
    const r = rows[0];
    if (!r) throw errors.notFound("That account does not exist.");
    const role = r.role as Profile["role"];
    // A student's classes are their section's; staff's are the ones they hold.
    const cls = await app.db.query(
      `select c.subject_code, s.title as subject_title, sec.code as section, c.term, t.full_name as teacher
         from classes c
         join subjects s on s.code = c.subject_code
         join sections sec on sec.id = c.section_id
         left join profiles t on t.id = c.teacher_id
        where c.ended_at is null
          and (case when $2 = 'student'
                    then c.section_id = (select section_id from profiles where id = $1)
                    else c.teacher_id = $1 end)
        order by c.subject_code, sec.code`,
      [userId, role],
    );
    const classes: ProfileClass[] = cls.rows.map((c) => ({
      subject: c.subject_code as string,
      subjectTitle: c.subject_title as string,
      section: c.section as string,
      term: c.term as string,
      teacher: (c.teacher as string | null) ?? null,
    }));
    // The person sees their own picture whatever the rules say about others.
    const avatar = (await avatarsFor(app.db, storage, userId, [userId], log)).get(userId)!;
    return {
      id: r.id as string,
      name: r.full_name as string,
      role,
      studentId: (r.student_id as string | null) ?? null,
      employeeId: (r.employee_id as string | null) ?? null,
      section: role === "student" ? ((r.section as string | null) ?? null) : null,
      classes,
      avatar,
      hasPicture: r.has_picture === true,
      tourSeenAt: r.tour_seen_at ? new Date(r.tour_seen_at as Date).toISOString() : null,
      removedAt: r.avatar_removed_at ? new Date(r.avatar_removed_at as Date).toISOString() : null,
      pictures: storage !== null,
    };
  }

  /* GET /api/v1/profile — the caller's own page. */
  app.get("/api/v1/profile", async (req): Promise<Profile> => {
    const id = await identityFrom(req, env);
    return loadProfile(id.userId);
  });

  /*
   * POST /api/v1/profile/tour: the first-run tour has been started for the caller.
   * Set once and never moved (db/addendum-tour.sql); the flag is the CALLER'S own, so
   * the route takes no body and no id. A convenience, never a grade.
   */
  app.post("/api/v1/profile/tour", async (req): Promise<Profile> => {
    const id = await identityFrom(req, env);
    await app.db.query(
      `update profiles set tour_seen_at = coalesce(tour_seen_at, now()) where id = $1 and deleted_at is null`,
      [id.userId],
    );
    return loadProfile(id.userId);
  });

  /* POST /api/v1/profile/avatar/upload — sign ONE upload, to a path chosen here. */
  app.post(
    "/api/v1/profile/avatar/upload",
    { config: { rateLimit: { max: 10 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      const body = AvatarUploadBody.safeParse(req.body);
      if (!body.success) {
        throw errors.badRequest(`Choose a picture. It is cropped to a square and is at most ${PROFILE_IMAGE_MAX_BYTES / 1024} KB.`);
      }
      if (!storage) throw errors.conflict("Pictures are not available on this server: it has no file storage.");
      const path = `${id.userId}/${randomUUID()}.webp`;
      try {
        const uploadUrl = await storage.signUpload(path);
        reply.status(201);
        return { path, uploadUrl };
      } catch (e) {
        throw errors.internal((e as Error).message);
      }
    },
  );

  /* PUT /api/v1/profile/avatar — record the picture just uploaded. */
  app.put("/api/v1/profile/avatar", async (req): Promise<Profile> => {
    const id = await identityFrom(req, env);
    const body = AvatarSetBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That picture was not uploaded for you.");
    if (!storage) throw errors.conflict("Pictures are not available on this server: it has no file storage.");
    const path = body.data.path;
    // Only a path this API would have signed for THIS person: no one else's folder.
    if (!pathShape(id.userId).test(path)) throw errors.badRequest("That picture was not uploaded for you.");

    let stored;
    let head: Uint8Array | null;
    try {
      stored = await storage.stat(path);
      head = stored ? await storage.readHead(path, 12) : null;
    } catch (e) {
      throw errors.internal((e as Error).message);
    }
    if (!stored) throw errors.badRequest("The picture did not finish uploading. Choose it again.");
    if (stored.bytes > PROFILE_IMAGE_MAX_BYTES || stored.mime !== "image/webp" || !looksLikeWebp(head)) {
      // Whatever landed is not what we sign for: remove it rather than keep it.
      await storage.remove([path]).catch(log);
      throw errors.badRequest(`That file is not a WebP picture of ${PROFILE_IMAGE_MAX_BYTES / 1024} KB or less. Choose it again.`);
    }

    const old = await asApi(app.db, async (tx) => {
      const cur = await tx.query(`select avatar_path from profiles where id = $1 and deleted_at is null for update`, [id.userId]);
      if (cur.rowCount === 0) throw errors.notFound("That account does not exist.");
      await tx.query(
        `update profiles set avatar_path = $2, avatar_updated_at = now(), avatar_removed_at = null where id = $1`,
        [id.userId, path],
      );
      return (cur.rows[0]!.avatar_path as string | null) ?? null;
    });
    // The replaced file goes after the new one is recorded, so a failure here
    // leaves an orphan object, never a profile pointing at nothing.
    if (old && old !== path) await storage.remove([old]).catch(log);
    return loadProfile(id.userId);
  });

  /* DELETE /api/v1/profile/avatar — the person removes their own. Not a moderation. */
  app.delete("/api/v1/profile/avatar", async (req): Promise<Profile> => {
    const id = await identityFrom(req, env);
    const old = await asApi(app.db, async (tx) => {
      const cur = await tx.query(`select avatar_path from profiles where id = $1 and deleted_at is null for update`, [id.userId]);
      if (cur.rowCount === 0) throw errors.notFound("That account does not exist.");
      await tx.query(
        `update profiles set avatar_path = null, avatar_updated_at = null, avatar_removed_at = null where id = $1`,
        [id.userId],
      );
      return (cur.rows[0]!.avatar_path as string | null) ?? null;
    });
    if (old && storage) await storage.remove([old]).catch(log);
    return loadProfile(id.userId);
  });

  /*
   * DELETE /api/v1/profiles/:userId/avatar — a teacher removes a student's; the
   * admin removes anyone's (`can_remove_avatar`). A reason, an audit row with
   * who, whose and when, and the person is told on their page.
   */
  app.delete("/api/v1/profiles/:userId/avatar", async (req) => {
    const id = await identityFrom(req, env);
    requireStaff(id);
    const params = UserParams.safeParse(req.params);
    if (!params.success) throw errors.notFound("That account does not exist.");
    const reason = ChatReasonBody.safeParse(req.body);
    if (!reason.success) throw errors.badRequest("Say why you are removing it, in a few words.");

    const removed = await asApi(app.db, async (tx) => {
      const { rows } = await tx.query(
        `select avatar_path, full_name, role::text as role,
                can_remove_avatar($2::uuid, id) as allowed
           from profiles where id = $1 and deleted_at is null for update`,
        [params.data.userId, id.userId],
      );
      const r = rows[0];
      if (!r) throw errors.notFound("That account does not exist.");
      if (r.allowed !== true) {
        throw errors.forbidden(
          r.role === "student" || params.data.userId === id.userId
            ? "You cannot remove this picture."
            : "Only the admin can remove a teacher's picture.",
        );
      }
      if (!r.avatar_path) throw errors.notFound("That person has no picture to remove.");
      await tx.query(
        `update profiles set avatar_path = null, avatar_updated_at = null, avatar_removed_at = now() where id = $1`,
        [params.data.userId],
      );
      await tx.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'profile.avatar.removed', 'profile', $2, $3::jsonb)`,
        [id.userId, params.data.userId, JSON.stringify({ reason: reason.data.reason, name: r.full_name, path: r.avatar_path })],
      );
      return r.avatar_path as string;
    });
    if (storage) await storage.remove([removed]).catch(log);
    return { removed: true };
  });
}
