import { describe, it, expect } from "vitest";
import { z } from "zod";
import { open, seal, last4, SealError } from "../src/assistant/seal.js";
import { draft, durationMs, readQuota, scrub, type FetchLike, type StepContext } from "../src/assistant/engines/core.js";
import { claudeAdapter } from "../src/assistant/engines/claude.js";
import { cloudflareAdapter, groqAdapter, ollamaCloudAdapter } from "../src/assistant/engines/open-engines.js";
import { runChain } from "../src/assistant/chain.js";

/**
 * The engine chain's adapters, the core they share, and the key seal (plan §9
 * B3; .claude/rules/assistant.md "Tests for ... each adapter (against recorded
 * responses)").
 *
 * THE FIXTURES ARE NOT RECORDED. No engine key existed when this was written
 * (8 Oct 2026, B0 online still waiting), so every reply below follows its
 * provider's DOCUMENTED shape: Anthropic's Messages API, Groq's OpenAI-
 * compatible chat completions, Ollama's /api/chat, Cloudflare's /ai/run.
 * B0 online replaces them with recorded replies.
 */

const SECRET = "s".repeat(48);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const KEY = "sk-test-0123456789abcdefWXYZ";

/* ---------------------------------------------------------------- fixtures */

interface Seen { url: string; headers: Record<string, string>; body: unknown }

function fake(...replies: Array<Response | Error | "hang">): { fetch: FetchLike; seen: Seen[] } {
  const seen: Seen[] = [];
  let i = 0;
  const fetch: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const h: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (h[k] = v));
    seen.push({ url, headers: h, body: init?.body ? JSON.parse(String(init.body)) : null });
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r === "hang") {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    if (r instanceof Error) throw r;
    return r.clone();
  };
  return { fetch, seen };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const claudeOk = (text = "A register window is a set of registers.", stop = "end_turn") => ({
  id: "msg_01", type: "message", role: "assistant", model: "claude-opus-5-5",
  content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text }],
  stop_reason: stop, stop_sequence: null,
  usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 800 },
});
const groqOk = (content: string | null = "ok", finish = "stop") => ({
  id: "chatcmpl-1", object: "chat.completion", model: "openai/gpt-oss-120b",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finish }],
  usage: { prompt_tokens: 900, completion_tokens: 120, total_tokens: 1020 },
});
const ollamaOk = (content = "ok") => ({
  model: "gpt-oss:120b", created_at: "2026-10-08T00:00:00Z",
  message: { role: "assistant", content }, done: true, done_reason: "stop",
  prompt_eval_count: 700, eval_count: 90,
});
const cfOk = (response: string | null = "ok") => ({
  success: true, errors: [], messages: [],
  result: { response, usage: { prompt_tokens: 500, completion_tokens: 60, total_tokens: 560 } },
});

const ctx = (over: Partial<StepContext> = {}): StepContext => ({ system: "You draft course text.", prompt: "Summarise figure 15.4.", maxTokens: 2000, ...over });
const step = { kind: "figure_summary" as const, idempotencyKey: "job1:3" };
const noSleep = async () => {};

/* -------------------------------------------------------------------- seal */

describe("the key seal", () => {
  it("opens what it sealed, for the same owner and engine", () => {
    const s = seal(SECRET, { ownerId: A, engine: "groq" }, KEY);
    expect(open(SECRET, { ownerId: A, engine: "groq" }, s)).toBe(KEY);
  });

  it("never holds the key in the clear, and seals the same key differently each time", () => {
    const s1 = seal(SECRET, { ownerId: A, engine: "groq" }, KEY);
    const s2 = seal(SECRET, { ownerId: A, engine: "groq" }, KEY);
    expect(s1.toString("latin1")).not.toContain(KEY);
    expect(s1.toString("latin1")).not.toContain(KEY.slice(-8));
    expect(s1.equals(s2)).toBe(false);
    expect(s1.length).toBeGreaterThanOrEqual(29);
  });

  it("DENIES another teacher: A's sealed key does not open as B's", () => {
    const s = seal(SECRET, { ownerId: A, engine: "groq" }, KEY);
    expect(() => open(SECRET, { ownerId: B, engine: "groq" }, s)).toThrow(SealError);
  });

  it("DENIES another engine, another secret, and altered bytes", () => {
    const s = seal(SECRET, { ownerId: A, engine: "groq" }, KEY);
    expect(() => open(SECRET, { ownerId: A, engine: "claude_api" }, s)).toThrow(SealError);
    expect(() => open("t".repeat(48), { ownerId: A, engine: "groq" }, s)).toThrow(SealError);
    const bent = Buffer.from(s);
    bent[bent.length - 1] = bent[bent.length - 1]! ^ 1;
    expect(() => open(SECRET, { ownerId: A, engine: "groq" }, bent)).toThrow(SealError);
  });

  it("refuses a short secret, and its error never carries the key", () => {
    expect(() => seal("short", { ownerId: A, engine: "groq" }, KEY)).toThrow(/32 characters/);
    try {
      open(SECRET, { ownerId: B, engine: "groq" }, seal(SECRET, { ownerId: A, engine: "groq" }, KEY));
    } catch (e) {
      expect(String(e)).not.toContain(KEY);
    }
    expect(last4(KEY)).toBe("WXYZ");
  });
});

/* ------------------------------------------------------------------- quota */

describe("reading quota from a reply", () => {
  it("reads Claude's headers, the tightest token budget winning", () => {
    const q = readQuota(new Headers({
      "anthropic-ratelimit-requests-remaining": "49",
      "anthropic-ratelimit-input-tokens-remaining": "38000",
      "anthropic-ratelimit-output-tokens-remaining": "7000",
      "retry-after": "12",
      "content-type": "application/json",
    }));
    expect(q).toMatchObject({ requestsRemaining: 49, tokensRemaining: 7000, retryAfterMs: 12_000 });
    expect(Object.keys(q.raw)).not.toContain("content-type");
  });

  it("reads Groq's headers and its duration format", () => {
    const q = readQuota(new Headers({
      "x-ratelimit-remaining-requests": "998", "x-ratelimit-remaining-tokens": "5800",
      "x-ratelimit-reset-requests": "1m26.4s",
    }));
    expect(q).toMatchObject({ requestsRemaining: 998, tokensRemaining: 5800, retryAfterMs: null });
    expect(durationMs("1m26.4s")).toBe(86_400);
    expect(durationMs("250ms")).toBe(250);
    expect(durationMs("2")).toBe(2000);
  });

  it("leaves every field null for an engine that says nothing", () => {
    expect(readQuota(new Headers())).toEqual({ requestsRemaining: null, tokensRemaining: null, retryAfterMs: null, raw: {} });
  });

  it("scrubs a key, and each part of a Cloudflare account:token pair", () => {
    expect(scrub(`bad key ${KEY}`, KEY)).toBe("bad key [key]");
    expect(scrub("acct 0123456789abcdef token tok_abcdefghijk", "0123456789abcdef:tok_abcdefghijk")).toBe("acct [key] token [key]");
  });
});

/* ---------------------------------------------------------------- adapters */

describe("the Claude adapter (documented shape, not recorded)", () => {
  it("sends the key, the model, the image and the idempotency key; reads text, tokens and cost", async () => {
    const f = fake(json(claudeOk(), 200, { "anthropic-ratelimit-requests-remaining": "10" }));
    const r = await draft(step, ctx({ images: [{ base64: "iVBORw0KGgo=" }] }), {
      adapter: claudeAdapter, model: "claude-opus-5-5", key: KEY, fetch: f.fetch, sleep: noSleep,
      price: { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
    });
    expect(f.seen).toHaveLength(1);
    const call = f.seen[0]!;
    expect(call.url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(call.headers["x-api-key"]).toBe(KEY);
    expect(call.headers["idempotency-key"]).toBe("job1:3");
    expect(call.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    const body = call.body as { model: string; messages: { content: { type: string }[] }[]; fallbacks: string };
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(body.messages[0]!.content.map((c) => c.type)).toEqual(["image", "text"]);
    expect(r).toMatchObject({ engine: "claude_api", text: "A register window is a set of registers.", tokensIn: 2000, tokensOut: 300, attempts: 1 });
    expect(r.costUsd).toBeCloseTo((1200 * 4 + 300 * 20 + 800 * 0.2) / 1e6, 10);
    expect(r.quota.requestsRemaining).toBe(10);
  });

  it("a refusal fails this engine; max_tokens is truncated, never accepted cut", async () => {
    const refused = fake(json({ ...claudeOk(), content: [], stop_reason: "refusal" }));
    await expect(draft(step, ctx(), { adapter: claudeAdapter, model: "claude-opus-5-5", key: KEY, fetch: refused.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "refused" });
    const cut = fake(json(claudeOk("half a sente", "max_tokens")));
    await expect(draft(step, ctx(), { adapter: claudeAdapter, model: "claude-opus-5-5", key: KEY, fetch: cut.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "truncated" });
  });

  it("a 401 is auth and is not retried; the error carries no key", async () => {
    const f = fake(json({ type: "error", error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` } }, 401));
    const p = draft(step, ctx(), { adapter: claudeAdapter, model: "claude-opus-5-5", key: KEY, fetch: f.fetch, sleep: noSleep });
    await expect(p).rejects.toMatchObject({ code: "auth", status: 401 });
    await p.catch((e: Error) => expect(e.message).not.toContain(KEY));
    expect(f.seen).toHaveLength(1);
  });

  it("a 529 is retried with backoff, then succeeds", async () => {
    const waits: number[] = [];
    const f = fake(json({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, 529), json(claudeOk()));
    const r = await draft(step, ctx(), {
      adapter: claudeAdapter, model: "claude-opus-5-5", key: KEY, fetch: f.fetch, sleep: async (ms) => void waits.push(ms),
    });
    expect(r.attempts).toBe(2);
    expect(waits).toEqual([1000]);
  });
});

describe("the Groq adapter (documented shape, not recorded)", () => {
  it("posts an OpenAI-style chat with JSON mode, and validates the step's JSON", async () => {
    const f = fake(json(groqOk('{"summary":"Two views of register allocation."}'), 200, { "x-ratelimit-remaining-requests": "999" }));
    const r = await draft(step, ctx({ output: z.object({ summary: z.string() }) }), { adapter: groqAdapter, model: "openai/gpt-oss-120b", key: KEY, fetch: f.fetch, sleep: noSleep });
    expect(f.seen[0]!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(f.seen[0]!.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(f.seen[0]!.body).toMatchObject({ model: "openai/gpt-oss-120b", response_format: { type: "json_object" }, max_completion_tokens: 2000 });
    expect(r).toMatchObject({ engine: "groq", json: { summary: "Two views of register allocation." }, tokensIn: 900, tokensOut: 120, costUsd: null });
    expect(r.quota.requestsRemaining).toBe(999);
  });

  it("JSON that misses the schema is malformed, never a best effort", async () => {
    const f = fake(json(groqOk('{"summery":"typo"}')));
    await expect(draft(step, ctx({ output: z.object({ summary: z.string() }) }), { adapter: groqAdapter, model: "m", key: KEY, fetch: f.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "malformed" });
  });

  it("a reply missing its fields is malformed", async () => {
    const f = fake(json({ id: "x", model: "m", choices: [] }));
    await expect(draft(step, ctx(), { adapter: groqAdapter, model: "m", key: KEY, fetch: f.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "malformed" });
  });

  it("a 429 is quota, not retried in place, with the retry-after it gave", async () => {
    const f = fake(json({ error: { message: "Rate limit reached", type: "tokens" } }, 429, { "retry-after": "7" }));
    await expect(draft(step, ctx(), { adapter: groqAdapter, model: "m", key: KEY, fetch: f.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "quota", quota: { retryAfterMs: 7000 } });
    expect(f.seen).toHaveLength(1);
  });
});

describe("the Ollama Cloud adapter (documented shape, not recorded)", () => {
  it("posts to ollama.com, not this laptop, with images and JSON format", async () => {
    const f = fake(json(ollamaOk('{"summary":"x"}')));
    const r = await draft(step, ctx({ images: [{ base64: "AAAA" }], output: z.object({ summary: z.string() }) }), {
      adapter: ollamaCloudAdapter, model: "gpt-oss:120b", key: KEY, fetch: f.fetch, sleep: noSleep,
    });
    expect(f.seen[0]!.url).toBe("https://ollama.com/api/chat");
    expect(f.seen[0]!.url).not.toMatch(/localhost|127\.0\.0\.1|11434/);
    expect(f.seen[0]!.body).toMatchObject({ stream: false, format: "json", messages: [{ role: "system" }, { role: "user", images: ["AAAA"] }] });
    expect(r).toMatchObject({ engine: "ollama_cloud", tokensIn: 700, tokensOut: 90 });
  });

  it("a network failure is retried, then reported as unavailable without the key", async () => {
    const f = fake(new TypeError(`fetch failed for ${KEY}`));
    const p = draft(step, ctx(), { adapter: ollamaCloudAdapter, model: "m", key: KEY, fetch: f.fetch, retries: 2, sleep: noSleep });
    await expect(p).rejects.toMatchObject({ code: "unavailable" });
    await p.catch((e: Error) => expect(e.message).not.toContain(KEY));
    expect(f.seen).toHaveLength(3);
  });

  it("no reply in time is a timeout", async () => {
    const f = fake("hang");
    await expect(draft(step, ctx(), { adapter: ollamaCloudAdapter, model: "m", key: KEY, fetch: f.fetch, timeoutMs: 20, retries: 0, sleep: noSleep }))
      .rejects.toMatchObject({ code: "timeout" });
  });
});

describe("the Cloudflare adapter (documented shape, not recorded)", () => {
  it("splits accountId:token, puts the account in the URL and only the token in the header", async () => {
    const f = fake(json(cfOk("Register windows.")));
    const r = await draft(step, ctx(), { adapter: cloudflareAdapter, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", key: "acct0123456789:tok_abcdefghijkl", fetch: f.fetch, sleep: noSleep });
    expect(f.seen[0]!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acct0123456789/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(f.seen[0]!.headers.authorization).toBe("Bearer tok_abcdefghijkl");
    expect(r).toMatchObject({ engine: "cloudflare", text: "Register windows.", tokensIn: 500, tokensOut: 60 });
  });

  it("success:false is malformed; a figure step is refused as no_vision before any call", async () => {
    const bad = fake(json({ success: false, result: null, errors: [{ code: 5007, message: "No such model" }], messages: [] }));
    await expect(draft(step, ctx(), { adapter: cloudflareAdapter, model: "m", key: "acct0123456789:tok_abcdefghijkl", fetch: bad.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "malformed" });
    const f = fake(json(cfOk()));
    await expect(draft(step, ctx({ images: [{ base64: "AAAA" }] }), { adapter: cloudflareAdapter, model: "m", key: "a:b", fetch: f.fetch, sleep: noSleep }))
      .rejects.toMatchObject({ code: "no_vision" });
    expect(f.seen).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------- chain */

/** One fetch for all four engines, routed by host. */
function byHost(routes: Record<string, Response[]>): { fetch: FetchLike; hosts: string[] } {
  const hosts: string[] = [];
  const queues = Object.fromEntries(Object.entries(routes).map(([h, rs]) => [h, [...rs]]));
  const fetch: FetchLike = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    hosts.push(url.host);
    const q = queues[url.host];
    if (!q?.length) throw new Error(`unexpected call to ${url.host}`);
    return (q.length > 1 ? q.shift()! : q[0]!).clone();
  };
  return { fetch, hosts };
}

const keyed = (...engines: Array<"claude_api" | "ollama_cloud" | "groq" | "cloudflare">) =>
  Object.fromEntries(engines.map((e) => [e, { key: e === "cloudflare" ? "acct0123456789:tok_abcdefghijkl" : KEY, keyId: `key-${e}` }]));

describe("the chain", () => {
  it("runs the first engine that has a key, in the job's order", async () => {
    const f = byHost({ "api.groq.com": [json(groqOk("from groq"))], "ollama.com": [json(ollamaOk("from ollama"))] });
    const r = await runChain({ order: ["claude_api", "ollama_cloud", "groq"], keys: keyed("groq", "ollama_cloud"), step, ctx: ctx(), fetch: f.fetch, options: { sleep: noSleep } });
    expect(r.status).toBe("done");
    if (r.status !== "done") return;
    expect(r.result.engine).toBe("ollama_cloud");
    expect(r.keyId).toBe("key-ollama_cloud");
    expect(r.tried).toMatchObject([{ engine: "claude_api", outcome: "skipped", error: { code: "no_key" } }]);
    expect(f.hosts).toEqual(["ollama.com"]);
  });

  it("moves to the next engine when one is out of quota", async () => {
    const f = byHost({
      "api.anthropic.com": [json({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }, 429, { "retry-after": "40" })],
      "api.groq.com": [json(groqOk("from groq"))],
    });
    const r = await runChain({ order: ["claude_api", "groq"], keys: keyed("claude_api", "groq"), step, ctx: ctx(), fetch: f.fetch, options: { sleep: noSleep } });
    expect(r.status).toBe("done");
    if (r.status === "done") expect(r.result.text).toBe("from groq");
    expect(r.tried).toMatchObject([{ engine: "claude_api", outcome: "failed", error: { code: "quota" } }]);
  });

  it("WAITS, and says so, when every engine tried is out of quota", async () => {
    const f = byHost({
      "api.groq.com": [json({ error: { message: "limit" } }, 429, { "retry-after": "30" })],
      "ollama.com": [json({ error: "limit" }, 429, { "retry-after": "90" })],
    });
    const r = await runChain({ order: ["ollama_cloud", "groq"], keys: keyed("ollama_cloud", "groq"), step, ctx: ctx(), fetch: f.fetch, options: { sleep: noSleep } });
    expect(r).toMatchObject({ status: "waiting", retryAfterMs: 30_000 });
    if (r.status === "waiting") expect(r.reason).toMatch(/out of quota/);
  });

  it("fails, naming each engine, when the failures are not quota", async () => {
    const f = byHost({ "api.groq.com": [json({ error: { message: "bad key" } }, 401)] });
    const r = await runChain({ order: ["groq"], keys: keyed("groq"), step, ctx: ctx(), fetch: f.fetch, options: { sleep: noSleep } });
    expect(r).toMatchObject({ status: "failed", reason: "every engine failed: groq auth" });
  });

  it("a figure step skips the engines that cannot see it", async () => {
    const f = byHost({ "api.groq.com": [json(groqOk("seen"))] });
    const r = await runChain({
      order: ["cloudflare", "ollama_cloud", "groq"], keys: keyed("cloudflare", "ollama_cloud", "groq"),
      models: { groq: "meta-llama/llama-4-scout-17b-16e-instruct" },
      step, ctx: ctx({ images: [{ base64: "AAAA" }] }), fetch: f.fetch, options: { sleep: noSleep },
    });
    expect(r.status).toBe("done");
    expect(r.tried.map((t) => [t.engine, t.error.code])).toEqual([["cloudflare", "no_vision"], ["ollama_cloud", "no_vision"]]);
    expect(f.hosts).toEqual(["api.groq.com"]);
  });

  it("never runs an engine outside the chain: local Ollama and Claude Code are not engines here", async () => {
    const f = byHost({});
    const r = await runChain({ order: ["ollama_local", "claude_code", "gemini_free"], keys: keyed("claude_api", "groq"), step, ctx: ctx(), fetch: f.fetch });
    expect(r).toMatchObject({ status: "failed", reason: "no engine in the chain has a key", tried: [] });
    expect(f.hosts).toEqual([]);
  });
});
