import type { ZodType } from "zod";
import type {
  ApiEngineId,
  AssistantStepKind,
  DraftResult,
  EngineErrorBody,
  EngineErrorCode,
  EngineQuota,
} from "@octa/contracts/assistant";

/**
 * The one contract every engine sits behind (.claude/rules/assistant.md "The
 * engines"): `draft(step, context)`, with the same timeout, retries, quota
 * reading and error shape for all of them. An adapter only knows how to make
 * one call to its engine and read the reply; everything else is here, so
 * nothing outside an adapter knows which engine ran.
 */

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** What the step machine (B5) hands an engine: the chapter brief and the
 *  book's text already packed for this engine's window (rules: "Memory"). */
export interface StepContext {
  system: string;
  prompt: string;
  /** Figure crops, PNG. A step with images runs only on a model that sees. */
  images?: { base64: string }[];
  maxTokens: number;
  /** When given, the reply's text must be JSON matching it, or the call failed. */
  output?: ZodType<unknown>;
}

export interface StepRef {
  kind: AssistantStepKind;
  /** Saved before the call; resent as the engine's idempotency key where one exists. */
  idempotencyKey: string;
}

/** What one call returned before the core times, prices and checks it. */
export interface RawReply {
  text: string;
  tokensIn: number;
  tokensOut: number;
  /** Cache reads and writes are priced apart (Claude); zero elsewhere. */
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  model: string;
  headers: Headers;
}

export interface EngineCall {
  model: string;
  /** The teacher's key, opened for this call only. Cloudflare: "accountId:token". */
  key: string;
  ctx: StepContext;
  step: StepRef;
  signal: AbortSignal;
  fetch: FetchLike;
}

export interface Adapter {
  id: ApiEngineId;
  call(c: EngineCall): Promise<RawReply>;
}

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly quota: EngineQuota | null;
  constructor(code: EngineErrorCode, message: string, opts: { status?: number | null; quota?: EngineQuota | null } = {}) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.status = opts.status ?? null;
    this.quota = opts.quota ?? null;
    this.retryable = RETRYABLE.has(code);
  }
}

/** Retried in place; "quota" is not: a daily limit will not lift in seconds,
 *  so the chain moves to the next engine instead. */
const RETRYABLE = new Set<EngineErrorCode>(["overloaded", "unavailable", "timeout"]);

/* ------------------------------------------------------------------ quota */

function intOrNull(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** "30", "1.5s", "2m59.56s", "250ms" (Groq writes the last three) -> ms. */
export function durationMs(v: string | null): number | null {
  if (v === null) return null;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  const m = /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/.exec(s);
  if (!m || s === "") return null;
  const [, h, min, sec, ms] = m;
  return Math.round(Number(h ?? 0) * 3_600_000 + Number(min ?? 0) * 60_000 + Number(sec ?? 0) * 1000 + Number(ms ?? 0));
}

/**
 * Reads what a reply says about quota. Engines name their headers differently
 * (Claude `anthropic-ratelimit-requests-remaining`, Groq
 * `x-ratelimit-remaining-requests`); both carry "ratelimit", "remaining" and
 * "requests" or "tokens". An engine that sends none leaves every field null.
 */
export function readQuota(headers: Headers): EngineQuota {
  const raw: Record<string, string> = {};
  let requests: number | null = null;
  let tokens: number | null = null;
  headers.forEach((value, name) => {
    const n = name.toLowerCase();
    if (!n.includes("ratelimit") && n !== "retry-after") return;
    raw[n] = value;
    if (!n.includes("remaining")) return;
    const v = intOrNull(value);
    if (v === null) return;
    // The tightest figure wins: input and output token budgets are separate on Claude.
    if (n.includes("request")) requests = requests === null ? v : Math.min(requests, v);
    else if (n.includes("token")) tokens = tokens === null ? v : Math.min(tokens, v);
  });
  return { requestsRemaining: requests, tokensRemaining: tokens, retryAfterMs: durationMs(headers.get("retry-after")), raw };
}

/** The key never travels in an error, a step record or a log line. */
export function scrub(text: string, key: string): string {
  let out = text;
  for (const part of key.split(":").filter((p) => p.length >= 8)) out = out.split(part).join("[key]");
  return out.length > 500 ? `${out.slice(0, 500)}…` : out;
}

/** Maps an HTTP status to the one error vocabulary. */
export function codeForStatus(status: number): EngineErrorCode {
  if (status === 401 || status === 402 || status === 403) return "auth";
  if (status === 429) return "quota";
  if (status === 529 || status === 503) return "overloaded";
  if (status >= 500) return "unavailable";
  return "bad_request";
}

/** A non-2xx reply as an EngineError, its body scrubbed of the key. */
export async function httpError(res: Response, key: string): Promise<EngineError> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  return new EngineError(codeForStatus(res.status), scrub(`HTTP ${res.status}: ${body}`, key), {
    status: res.status,
    quota: readQuota(res.headers),
  });
}

/** Parses a reply against its contract; a mismatch is a failed call. */
export function parseReply<T>(schema: ZodType<T>, body: unknown, what: string): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new EngineError("malformed", `${what} did not match its contract at ${first?.path.join(".") || "(root)"}: ${first?.message ?? "invalid"}`);
  }
  return r.data;
}

/* ------------------------------------------------------------------ draft */

export interface DraftOptions {
  adapter: Adapter;
  model: string;
  key: string;
  fetch: FetchLike;
  /** Per call, not per step. */
  timeoutMs?: number;
  /** Extra tries after the first, for retryable failures only. */
  retries?: number;
  /** A retry-after longer than this is treated as out of quota: the chain moves on. */
  maxWaitMs?: number;
  /** Prices per million tokens, when the engine bills; null when it is free. */
  price?: { in: number; out: number; cacheRead: number; cacheWrite: number } | null;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export const DEFAULTS = { timeoutMs: 120_000, retries: 2, maxWaitMs: 30_000 } as const;

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function backoff(attempt: number, hinted: number | null): number {
  return hinted ?? Math.min(1000 * 2 ** (attempt - 1), 16_000);
}

/** Strips a ```json fence some models put around JSON they were told to send bare. */
export function jsonText(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(t);
  return m?.[1] ?? t;
}

/**
 * One step on one engine: timeout, retries, quota, timing, cost, and the
 * step's JSON checked against its schema. Throws EngineError and nothing else.
 */
export async function draft(step: StepRef, ctx: StepContext, o: DraftOptions): Promise<DraftResult> {
  const timeoutMs = o.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = o.retries ?? DEFAULTS.retries;
  const maxWaitMs = o.maxWaitMs ?? DEFAULTS.maxWaitMs;
  const sleep = o.sleep ?? realSleep;
  const now = o.now ?? Date.now;
  const engine = o.adapter.id;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const started = now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const raw = await o.adapter.call({ model: o.model, key: o.key, ctx, step, signal: ac.signal, fetch: o.fetch });
      const ms = Math.max(0, Math.round(now() - started));
      let json: unknown;
      if (ctx.output) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText(raw.text));
        } catch {
          throw new EngineError("malformed", "the step asked for JSON and the reply is not JSON");
        }
        const r = ctx.output.safeParse(parsed);
        if (!r.success) {
          const first = r.error.issues[0];
          throw new EngineError("malformed", `the step's JSON did not match its schema at ${first?.path.join(".") || "(root)"}: ${first?.message ?? "invalid"}`);
        }
        json = r.data;
      }
      const p = o.price ?? null;
      const cacheRead = raw.cacheReadTokens ?? 0;
      const cacheWrite = raw.cacheWriteTokens ?? 0;
      const costUsd = p
        ? (raw.tokensIn * p.in + raw.tokensOut * p.out + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000
        : null;
      return {
        engine, model: raw.model, text: raw.text, ...(ctx.output ? { json } : {}),
        tokensIn: raw.tokensIn + cacheRead + cacheWrite, tokensOut: raw.tokensOut, ms,
        costUsd, attempts: attempt, quota: readQuota(raw.headers),
      };
    } catch (e) {
      const err = toEngineError(e, ac.signal.aborted, timeoutMs, o.key);
      const wait = err.quota?.retryAfterMs ?? null;
      if (err.code === "overloaded" && wait !== null && wait > maxWaitMs) {
        throw withAttempts(new EngineError("quota", `${err.message} (retry-after ${wait} ms is past the wait limit)`, { status: err.status, quota: err.quota }), attempt);
      }
      if (!err.retryable || attempt > retries) throw withAttempts(err, attempt);
      await sleep(Math.min(backoff(attempt, wait), maxWaitMs));
    } finally {
      clearTimeout(timer);
    }
  }
}

function toEngineError(e: unknown, aborted: boolean, timeoutMs: number, key: string): EngineError {
  if (e instanceof EngineError) return e;
  if (aborted) return new EngineError("timeout", `no reply within ${timeoutMs} ms`);
  const message = e instanceof Error ? e.message : String(e);
  return new EngineError("unavailable", scrub(`network: ${message}`, key));
}

const ATTEMPTS = new WeakMap<EngineError, number>();
function withAttempts(e: EngineError, n: number): EngineError {
  ATTEMPTS.set(e, n);
  return e;
}

/** The stored shape of a failed call (`assistant_steps.error`). */
export function errorBody(e: EngineError, engine: ApiEngineId, model: string): EngineErrorBody {
  return {
    engine, model, code: e.code, message: e.message, status: e.status,
    retryable: e.retryable, attempts: ATTEMPTS.get(e) ?? 1, quota: e.quota,
  };
}
