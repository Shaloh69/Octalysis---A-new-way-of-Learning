import { ApiEngineId, type DraftResult, type EngineErrorBody } from "@octa/contracts/assistant";
import { CATALOGUE, modelInfo } from "./engines/catalogue.js";
import { claudeAdapter } from "./engines/claude.js";
import { draft, EngineError, errorBody, type Adapter, type DraftOptions, type FetchLike, type StepContext, type StepRef } from "./engines/core.js";
import { cloudflareAdapter, groqAdapter, ollamaCloudAdapter } from "./engines/open-engines.js";

/**
 * The engine chain (plan §3a, rules "The engines"). A step goes to the first
 * engine in the job's order that has a key, can do the step (sees images when
 * the step carries them), and answers. A failure moves it to the next engine;
 * every attempt is kept for the step record. When every engine that was tried
 * is out of quota, the step WAITS and says so: it never fails silently, and it
 * never reaches an engine outside the chain.
 *
 * Local Ollama is paused (round five) and is not an engine here; `claude_code`
 * runs in the teacher's own Claude Code (B3b), never from the API.
 */

export const ADAPTERS: Record<ApiEngineId, Adapter> = {
  claude_api: claudeAdapter,
  ollama_cloud: ollamaCloudAdapter,
  groq: groqAdapter,
  cloudflare: cloudflareAdapter,
};

export interface ChainInput {
  /** The job's order, from `assistant_jobs.engines`; unknown names are dropped. */
  order: readonly string[];
  /** Opened keys by engine, for this step only. */
  keys: Partial<Record<ApiEngineId, { key: string; keyId: string }>>;
  /** A model per engine; the catalogue's default otherwise. */
  models?: Partial<Record<ApiEngineId, string>>;
  step: StepRef;
  ctx: StepContext;
  fetch: FetchLike;
  adapters?: Partial<Record<ApiEngineId, Adapter>>;
  options?: Pick<DraftOptions, "timeoutMs" | "retries" | "maxWaitMs" | "sleep" | "now">;
}

export interface Tried {
  engine: ApiEngineId;
  model: string;
  outcome: "skipped" | "failed";
  error: EngineErrorBody;
}

export type ChainOutcome =
  | { status: "done"; result: DraftResult; keyId: string; tried: Tried[] }
  | { status: "waiting"; reason: string; retryAfterMs: number | null; tried: Tried[] }
  | { status: "failed"; reason: string; tried: Tried[] };

/** Codes that mean "this engine, not now": the step waits if all are these. */
const OUT_OF_QUOTA = new Set(["quota", "overloaded"]);

export async function runChain(input: ChainInput): Promise<ChainOutcome> {
  const tried: Tried[] = [];
  const order = input.order.filter((e): e is ApiEngineId => ApiEngineId.safeParse(e).success);
  const needsVision = (input.ctx.images?.length ?? 0) > 0;

  for (const engine of order) {
    const model = input.models?.[engine] ?? CATALOGUE[engine].defaultModel;
    const info = modelInfo(engine, model);
    const opened = input.keys[engine];
    if (!opened) {
      tried.push(skip(engine, model, "no_key", `no ${engine} key has been added`));
      continue;
    }
    if (needsVision && !info.vision) {
      tried.push(skip(engine, model, "no_vision", `${model} does not see images; this step carries a figure`));
      continue;
    }
    try {
      const result = await draft(input.step, input.ctx, {
        adapter: input.adapters?.[engine] ?? ADAPTERS[engine],
        model,
        key: opened.key,
        fetch: input.fetch,
        price: info.price,
        ...input.options,
      });
      return { status: "done", result, keyId: opened.keyId, tried };
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      tried.push({ engine, model, outcome: "failed", error: errorBody(e, engine, model) });
    }
  }

  const failed = tried.filter((t) => t.outcome === "failed");
  if (failed.length === 0) {
    return { status: "failed", reason: needsVision ? "no engine in the chain has a key and sees images" : "no engine in the chain has a key", tried };
  }
  if (failed.every((t) => OUT_OF_QUOTA.has(t.error.code))) {
    const waits = failed.map((t) => t.error.quota?.retryAfterMs).filter((n): n is number => typeof n === "number");
    return {
      status: "waiting",
      reason: `every engine tried is out of quota or busy (${failed.map((t) => t.engine).join(", ")}); the step waits`,
      retryAfterMs: waits.length ? Math.min(...waits) : null,
      tried,
    };
  }
  return { status: "failed", reason: `every engine failed: ${failed.map((t) => `${t.engine} ${t.error.code}`).join(", ")}`, tried };
}

function skip(engine: ApiEngineId, model: string, code: "no_key" | "no_vision", message: string): Tried {
  return {
    engine, model, outcome: "skipped",
    error: { engine, model, code, message, status: null, retryable: false, attempts: 1, quota: null },
  };
}
