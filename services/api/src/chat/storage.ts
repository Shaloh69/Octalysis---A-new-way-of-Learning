import type { Env } from "../env.js";

/**
 * The chat's attachments, in Supabase Storage's private `chat-attachments`
 * bucket (db/addendum-chat.sql). The bucket has NO client policy: this module,
 * holding the service-role key, is the only way in. It signs one upload at a
 * time for a path the API chose, and signs short-lived downloads only for
 * messages the caller may already read. An attachment is never a public URL.
 *
 * The local stack has no Storage, so `makeChatStorage` returns null there and
 * the chat says attachments are unavailable instead of failing on send.
 */
export const CHAT_BUCKET = "chat-attachments";
/** Profile pictures (PROFILES, 8 Oct 2026): private, WebP, 300 KB, the same way. */
export const PROFILE_BUCKET = "profile-images";

export interface StoredObject {
  readonly bytes: number;
  readonly mime: string;
}

export interface ChatStorage {
  /** An absolute URL the browser PUTs the file to, once. */
  signUpload(path: string): Promise<string>;
  /** Absolute signed download URLs, by path. A path that fails is absent. */
  signDownloads(paths: readonly string[], seconds: number): Promise<Map<string, string>>;
  /** What actually landed at `path`, or null if nothing did. */
  stat(path: string): Promise<StoredObject | null>;
  remove(paths: readonly string[]): Promise<void>;
}

/** A bucket's client that can also read a file's first bytes, to check what it really is. */
export interface BucketStorage extends ChatStorage {
  /** The first `n` bytes of the stored file, or null if nothing is there. */
  readHead(path: string, n: number): Promise<Uint8Array | null>;
}

export function makeChatStorage(env: Env): ChatStorage | null {
  return makeBucketStorage(env, CHAT_BUCKET);
}

export function makeProfileStorage(env: Env): BucketStorage | null {
  return makeBucketStorage(env, PROFILE_BUCKET);
}

export function makeBucketStorage(env: Env, bucket: string): BucketStorage | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = { Authorization: `Bearer ${key}`, apikey: key };
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Storage is Fastify too: a JSON content type with an empty body is refused
    // with 400 (found on the deployment, 6 Oct 2026: every upload answered 500
    // here, while the fake storage in the tests never looked). So a request says
    // JSON only when it carries some, and every call here carries some.
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? auth : { ...auth, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      // The status only: a storage error body can echo the path and the key's project.
      throw new Error(`storage ${method} ${path.split("?")[0]} answered ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    async signUpload(path) {
      const r = await call<{ url: string }>("POST", `/object/upload/sign/${bucket}/${enc(path)}`, {});
      return `${base}${r.url}`;
    },
    async signDownloads(paths, seconds) {
      const out = new Map<string, string>();
      if (paths.length === 0) return out;
      const r = await call<Array<{ path: string | null; signedURL: string | null; error: string | null }>>(
        "POST",
        `/object/sign/${bucket}`,
        { expiresIn: seconds, paths },
      );
      for (const s of r) if (s.path && s.signedURL) out.set(s.path, `${base}${s.signedURL}`);
      return out;
    },
    async stat(path) {
      const slash = path.lastIndexOf("/");
      const prefix = path.slice(0, slash);
      const name = path.slice(slash + 1);
      const r = await call<Array<{ name: string; metadata: { size?: number; mimetype?: string } | null }>>(
        "POST",
        `/object/list/${bucket}`,
        { prefix, search: name, limit: 10, offset: 0 },
      );
      const hit = r.find((o) => o.name === name);
      if (!hit?.metadata?.size || !hit.metadata.mimetype) return null;
      return { bytes: hit.metadata.size, mime: hit.metadata.mimetype };
    },
    async readHead(path, n) {
      // The authenticated route, with the service key: the bucket is private.
      const res = await fetch(`${base}/object/authenticated/${bucket}/${enc(path)}`, {
        headers: { ...auth, Range: `bytes=0-${n - 1}` },
      });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`storage GET ${bucket} object answered ${res.status}`);
      return new Uint8Array(await res.arrayBuffer()).slice(0, n);
    },
    async remove(paths) {
      if (paths.length === 0) return;
      await call<unknown>("DELETE", `/object/${bucket}`, { prefixes: paths });
    },
  };
}
