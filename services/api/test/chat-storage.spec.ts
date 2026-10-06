import { describe, it, expect, vi, afterEach } from "vitest";
import { makeChatStorage } from "../src/chat/storage.js";
import { loadEnv } from "../src/env.js";

/**
 * The storage client's requests, as Supabase Storage sees them. The route
 * tests use a fake storage, which is how an upload that failed on every call
 * on the deployment (6 Oct 2026) passed them all: Storage refuses a JSON
 * content type with an empty body, and the client sent exactly that.
 */

const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://x:y@localhost:1/z",
  EXAM_SALT_SECRET: "x".repeat(40),
  SUPABASE_JWT_SECRET: "test-secret-at-least-32-characters-long-000000",
  SUPABASE_URL: "https://project.supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  JWT_AUDIENCE: "authenticated",
  ENGINE_VERSION: "1.0.0",
} as NodeJS.ProcessEnv);

afterEach(() => vi.unstubAllGlobals());

function record(reply: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}

describe("makeChatStorage", () => {
  it("is null without a project (the local stack)", () => {
    expect(makeChatStorage({ ...env, SUPABASE_URL: undefined })).toBeNull();
  });

  it("never says JSON without a body, on any call", async () => {
    const calls = record({ url: "/object/upload/sign/chat-attachments/r/u/f.png?token=t" });
    const s = makeChatStorage(env)!;
    await s.signUpload("r/u/f.png");
    await s.signDownloads(["r/u/f.png"], 60).catch(() => {});
    await s.stat("r/u/f.png").catch(() => {});
    await s.remove(["r/u/f.png"]).catch(() => {});
    expect(calls.length).toBe(4);
    for (const c of calls) {
      const h = c.init.headers as Record<string, string>;
      if (h["Content-Type"] === "application/json") expect(c.init.body, c.url).toBeTruthy();
    }
  });

  it("signs an upload to an absolute URL under the private bucket, with the service key", async () => {
    const calls = record({ url: "/object/upload/sign/chat-attachments/r/u/f.png?token=t" });
    const url = await makeChatStorage(env)!.signUpload("r/u/f.png");
    expect(url).toBe("https://project.supabase.test/storage/v1/object/upload/sign/chat-attachments/r/u/f.png?token=t");
    expect(calls[0]!.url).toBe("https://project.supabase.test/storage/v1/object/upload/sign/chat-attachments/r/u/f.png");
    expect((calls[0]!.init.headers as Record<string, string>).apikey).toBe("service-key");
  });
});
