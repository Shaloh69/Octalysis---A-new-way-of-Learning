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

export function makeChatStorage(env: Env): ChatStorage | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
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
      const r = await call<{ url: string }>("POST", `/object/upload/sign/${CHAT_BUCKET}/${enc(path)}`);
      return `${base}${r.url}`;
    },
    async signDownloads(paths, seconds) {
      const out = new Map<string, string>();
      if (paths.length === 0) return out;
      const r = await call<Array<{ path: string | null; signedURL: string | null; error: string | null }>>(
        "POST",
        `/object/sign/${CHAT_BUCKET}`,
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
        `/object/list/${CHAT_BUCKET}`,
        { prefix, search: name, limit: 10, offset: 0 },
      );
      const hit = r.find((o) => o.name === name);
      if (!hit?.metadata?.size || !hit.metadata.mimetype) return null;
      return { bytes: hit.metadata.size, mime: hit.metadata.mimetype };
    },
    async remove(paths) {
      if (paths.length === 0) return;
      await call<unknown>("DELETE", `/object/${CHAT_BUCKET}`, { prefixes: paths });
    },
  };
}
