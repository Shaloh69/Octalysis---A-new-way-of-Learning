import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "../src/lib/api";

/**
 * The API (Fastify) refuses a request that says it is JSON and has no body.
 * The client said so on EVERY request, so every bodiless POST answered 400:
 * Orientation's finish, a moon's journey, the feedback prompt's dismiss
 * (found by the instructor, 5 Oct 2026). Only a request with a body says JSON.
 */

afterEach(() => vi.unstubAllGlobals());

function capture(): Array<{ url: string; headers: Record<string, string> }> {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: { ...(init.headers as Record<string, string>) } });
    return new Response(JSON.stringify({ stageId: "00", state: "mastered", next: "01" }), { status: 200 });
  });
  return calls;
}

describe("the client says JSON only when it sends JSON", () => {
  it("a bodiless POST carries no JSON content type: Orientation's finish, a journey", async () => {
    const calls = capture();
    await api.readStage("00");
    await api.startJourney("01.1").catch(() => {});
    for (const c of calls) expect(c.headers["content-type"], c.url).toBeUndefined();
  });

  it("a POST with a body still says it is JSON", async () => {
    const calls = capture();
    await api.answer("a", 1, "x").catch(() => {});
    expect(calls[0]!.headers["content-type"]).toBe("application/json");
  });
});
