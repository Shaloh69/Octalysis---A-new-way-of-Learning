import type { ApiEngineId } from "@octa/contracts/assistant";

/**
 * Each engine's default model, which of its models see images, and what they
 * cost (docs/AI-ASSISTANT-PLAN.md §3a).
 *
 * PROVISIONAL for the three free engines: B0 online, the measurement that says
 * "which engine for which step", has not run (no key yet, 8 Oct 2026). Their
 * model names follow each provider's published catalogue and are re-checked
 * when B0 runs. Claude's ids and prices are Anthropic's published table (the
 * claude-api reference, cached 25 Sep 2026), per million tokens.
 */

export interface ModelInfo {
  vision: boolean;
  /** USD per million tokens; null for an engine whose allowance is free. */
  price: { in: number; out: number; cacheRead: number; cacheWrite: number } | null;
}

export interface EngineInfo {
  defaultModel: string;
  models: Record<string, ModelInfo>;
}

export const CATALOGUE: Record<ApiEngineId, EngineInfo> = {
  claude_api: {
    defaultModel: "claude-opus-5-5",
    models: {
      "claude-opus-5-5": { vision: true, price: { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 } },
      "claude-sonnet-5-5": { vision: true, price: { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 } },
      "claude-haiku-4-5": { vision: true, price: { in: 1, out: 5, cacheRead: 0.1, cacheWrite: 1.25 } },
    },
  },
  ollama_cloud: {
    defaultModel: "gpt-oss:120b",
    models: { "gpt-oss:120b": { vision: false, price: null } },
  },
  groq: {
    defaultModel: "openai/gpt-oss-120b",
    models: {
      "openai/gpt-oss-120b": { vision: false, price: null },
      "meta-llama/llama-4-scout-17b-16e-instruct": { vision: true, price: null },
    },
  },
  cloudflare: {
    defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    models: { "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { vision: false, price: null } },
  },
};

/** A model the catalogue does not list is treated as text-only and free-of-record. */
export function modelInfo(engine: ApiEngineId, model: string): ModelInfo {
  return CATALOGUE[engine].models[model] ?? { vision: false, price: null };
}
