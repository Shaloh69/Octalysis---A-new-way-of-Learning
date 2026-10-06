import type { APIRequestContext, Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The class chat's fixture (docs/CHAT-PLAN.md): the REAL API, the demo
 * section's room (BSCPE - 4), a short conversation posted through the routes
 * themselves, once. Idempotent: it posts only into an empty room, so a second
 * run adds nothing (`pnpm db:reset` empties it).
 *
 * - 232129006 (Kristine) is @mentioned by the instructor: "Mentions you" on
 *   the message, a count on her Chat tab
 * - 232129004 (Jocelyn) asked the first question
 * - the instructor is the demo staff account
 *
 * The local stack has no Storage, so no attachment is seeded: the page says
 * attachments are unavailable here. Attachments are exercised against the
 * deployment. Not a spec: the leading underscore.
 */

export const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
export const API = process.env.OCTA_API_URL ?? "http://localhost:8090";

function mint(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, ...payload });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
const student = (n: string) =>
  mint({
    sub: `dddddddd-1111-4000-8000-000000000${n}`,
    email: `232129${n}@example.com`,
    app_metadata: { role: "student", student_id: `232129${n}` },
  });

export const S006 = student("006");
export const S004 = student("004");
export const STAFF = mint({ sub: "dddddddd-0000-4000-8000-000000000001", email: "demo@example.com", app_metadata: { role: "teacher" } });
export const S006_ID = "dddddddd-1111-4000-8000-000000000006";
export const S004_ID = "dddddddd-1111-4000-8000-000000000004";

const h = (t: string) => ({ authorization: `Bearer ${t}` });

async function rooms(request: APIRequestContext, token: string) {
  const res = await request.get(`${API}/api/v1/chat/rooms`, { headers: h(token) });
  if (!res.ok()) throw new Error(`GET /chat/rooms answered ${res.status()}`);
  return (await res.json()) as { rooms: Array<{ id: string; kind: string; title: string }> };
}

async function say(request: APIRequestContext, token: string, room: string, body: string, mentions: string[] = []) {
  const res = await request.post(`${API}/api/v1/chat/rooms/${room}/messages`, { headers: h(token), data: { body, mentions } });
  if (!res.ok()) throw new Error(`POST message answered ${res.status()}: ${await res.text()}`);
}

/*
 * Every worker runs beforeAll, and two that both see an empty room both seed it
 * (found 6 Oct 2026: the instructor's reply appeared twice). `mkdir` is atomic:
 * one worker seeds, the rest wait for the lock to go and then find the room full.
 */
const LOCK = join(tmpdir(), "octa-chat-seed.lock");
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 200; i++) {
    try {
      mkdirSync(LOCK);
      try {
        return await fn();
      } finally {
        rmSync(LOCK, { recursive: true, force: true });
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // A lock older than a minute is a crashed run's.
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > 60_000) rmSync(LOCK, { recursive: true, force: true });
      } catch { /* gone already */ }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("the chat seed lock never cleared");
}

/** The section's room id and Kristine's private thread id, seeded once. */
export async function seedChat(request: APIRequestContext): Promise<{ section: string; thread: string }> {
  return withLock(() => seed(request));
}

async function seed(request: APIRequestContext): Promise<{ section: string; thread: string }> {
  const mine = await rooms(request, S006);
  const section = mine.rooms.find((r) => r.kind === "section")!.id;
  const thread = mine.rooms.find((r) => r.kind === "direct")!.id;
  await rooms(request, S004);
  await rooms(request, STAFF);

  const t = await request.get(`${API}/api/v1/chat/rooms/${section}`, { headers: h(S006) });
  const body = (await t.json()) as { messages: unknown[] };
  if (body.messages.length === 0) {
    await say(request, S004, section, "Is the MAR part of the processor or of the memory? I keep mixing it up with the MBR.");
    await say(
      request,
      STAFF,
      section,
      "@Jocelyn Mae Sy Tan The MAR is in the processor: it holds the address being sent to memory. The MBR holds the data going either way.",
      [S004_ID],
    );
    await say(request, S006, section, "So for a read, the address goes out from the MAR and the word comes back into the MBR?");
    await say(request, STAFF, section, "@Kristine Joy Montebon Exactly that. Good way to put it.", [S006_ID]);
  }
  const p = await request.get(`${API}/api/v1/chat/rooms/${thread}`, { headers: h(S006) });
  if (((await p.json()) as { messages: unknown[] }).messages.length === 0) {
    await say(request, S006, thread, "Hi, I could not finish the stage 02 reading this week. Can I ask about it after class?");
    await say(request, STAFF, thread, "Of course. Come by after the lecture.");
  }
  return { section, thread };
}

export async function signIn(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), token);
}
