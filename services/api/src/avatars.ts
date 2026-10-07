import type pg from "pg";
import type { Avatar } from "@octa/contracts";
import type { BucketStorage } from "./chat/storage.js";
import type { Db } from "./db.js";
import { deriveCosmetics } from "./routes/cosmetics.js";

/**
 * A person's picture as a given VIEWER may see it (PROFILES, 8 Oct 2026;
 * docs/PROFILES-PLAN.md).
 *
 * One helper, used by every route that names a person: the chat, the roster,
 * a student's record, the teachers. It asks the database (`can_see_avatar`)
 * whether this viewer may see each picture, signs a one-hour download for those
 * that may, and gives everyone else the GENERATED avatar's seed, derived from
 * the person's student ID (their cosmetic seed; never the exam seed, the same
 * boundary as `routes/cosmetics.ts`). A picture the viewer may not see is
 * indistinguishable from no picture.
 *
 * A path is never returned, only a signed URL, and a storage hiccup degrades to
 * the generated avatar instead of blanking the page.
 */

/** A signed download lasts an hour; a page that stays open longer refetches. */
export const AVATAR_SIGNED_SECONDS = 3600;

type Queryable = Pick<pg.PoolClient, "query"> | Db;

/** The generated avatar's seed: a hue and one of four patterns. */
export function generatedAvatar(key: string): Pick<Avatar, "hue" | "variant"> {
  const c = deriveCosmetics(key);
  return { hue: c.accentHue, variant: c.paletteVariant };
}

/**
 * The avatars of `ids`, as `viewer` may see them. Every id gets one. Never
 * throws for storage: a failure is logged and the generated avatar stands in.
 */
export async function avatarsFor(
  db: Queryable,
  storage: BucketStorage | null,
  viewer: string,
  ids: readonly string[],
  log: (e: unknown) => void = () => {},
): Promise<Map<string, Avatar>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, Avatar>();
  if (unique.length === 0) return out;
  const { rows } = await db.query<{ id: string; key: string; visible: string | null; removable: boolean }>(
    `select p.id::text as id, coalesce(p.student_id, p.id::text) as key,
            case when p.avatar_path is not null and can_see_avatar($1::uuid, p.id) then p.avatar_path end as visible,
            (p.avatar_path is not null and can_remove_avatar($1::uuid, p.id)) as removable
       from profiles p
      where p.id = any($2::uuid[])`,
    [viewer, unique],
  );
  let urls = new Map<string, string>();
  const paths = rows.map((r) => r.visible).filter((p): p is string => p !== null);
  if (storage && paths.length > 0) {
    try {
      urls = await storage.signDownloads(paths, AVATAR_SIGNED_SECONDS);
    } catch (e) {
      log(e);
    }
  }
  for (const r of rows) {
    out.set(r.id, {
      url: r.visible ? (urls.get(r.visible) ?? null) : null,
      ...generatedAvatar(r.key),
      removable: r.removable === true,
    });
  }
  // An id with no profile row (a removed account) still gets a stable generated one.
  for (const id of unique) if (!out.has(id)) out.set(id, { url: null, ...generatedAvatar(id), removable: false });
  return out;
}

/** WebP is a RIFF file: "RIFF", four size bytes, then "WEBP". */
export function looksLikeWebp(head: Uint8Array | null): boolean {
  if (!head || head.length < 12) return false;
  const at = (i: number, s: string) => [...s].every((ch, k) => head[i + k] === ch.charCodeAt(0));
  return at(0, "RIFF") && at(8, "WEBP");
}
