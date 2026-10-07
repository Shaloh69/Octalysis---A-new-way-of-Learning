import { z } from "zod";

/*
 * The drafting assistant's contracts (docs/AI-ASSISTANT-PLAN.md v6, §3a, §4-six;
 * .claude/rules/assistant.md). Their own subpath, `@octa/contracts/assistant`,
 * so no app compiles the engines' reply schemas in by importing the main entry.
 *
 * Round six (7 Oct 2026): the engines are called by each teacher's app, on
 * their laptop, with their own keys; never by the API. These schemas are the
 * one definition both sides use: the app checks each engine's reply against
 * them (exported as JSON Schema), and the API checks what the app hands in.
 *
 * Two kinds of schema live here:
 *   - OCTA's own: which engines exist, a step's result, the one error shape
 *     every adapter returns.
 *   - Each engine's reply, as far as an adapter reads it. A reply that does
 *     not match is a failed call ("malformed"), never a best effort.
 */

/* ------------------------------------------------------------------ engines */

/** The online engines a teacher's app can call. Local Ollama is PAUSED (round
 *  five) and is not here: the database refuses a step on `ollama_local` too.
 *  `claude_code` is the teacher's own Claude Code (B3b), run by hand. */
export const ApiEngineId = z.enum(["claude_api", "ollama_cloud", "groq", "cloudflare"]);
export type ApiEngineId = z.infer<typeof ApiEngineId>;

/** The chain's default order (§3a): Claude when the teacher has a key, then
 *  the free engines whose terms do not train on or keep input. */
export const DEFAULT_CHAIN: readonly ApiEngineId[] = ["claude_api", "ollama_cloud", "groq", "cloudflare"];

/** What a step asked for, by kind; mirrors `assistant_steps.kind`. */
export const AssistantStepKind = z.enum([
  "figure_summary", "figure_redraw", "section", "questions", "check", "catalogue", "coverage", "review",
]);
export type AssistantStepKind = z.infer<typeof AssistantStepKind>;

/* ------------------------------------------------------------------ results */

/** What a reply said about the quota left, read from its headers. Engines
 *  that publish nothing leave every field null: the chain never assumes. */
export const EngineQuota = z.object({
  requestsRemaining: z.number().int().nonnegative().nullable(),
  tokensRemaining: z.number().int().nonnegative().nullable(),
  /** Milliseconds until the engine says to try again (retry-after), if it said. */
  retryAfterMs: z.number().int().nonnegative().nullable(),
  /** Every rate-limit header the reply carried, as given, for the step record. */
  raw: z.record(z.string()),
});
export type EngineQuota = z.infer<typeof EngineQuota>;

export const EngineErrorCode = z.enum([
  "no_key",        // the teacher has not added a key for this engine
  "auth",          // the key was refused (401/403), or the account cannot pay (402)
  "quota",         // out of quota for now (429, a daily limit); the chain moves on
  "overloaded",    // the engine is busy (529, 503); retried, then the chain moves on
  "unavailable",   // 5xx, a network failure
  "timeout",       // no reply in time
  "refused",       // the model declined (Claude's stop_reason "refusal")
  "truncated",     // the reply hit max_tokens: the step is split, never accepted cut
  "malformed",     // the reply, or the step's JSON in it, did not match its schema
  "bad_request",   // 400/404/413: our request is wrong; not retried
  "no_vision",     // the step needs to see an image and this model cannot
]);
export type EngineErrorCode = z.infer<typeof EngineErrorCode>;

/** The one error shape every adapter returns; what a failed step stores. */
export const EngineErrorBody = z.object({
  engine: ApiEngineId,
  model: z.string(),
  code: EngineErrorCode,
  message: z.string(),
  status: z.number().int().nullable(),
  retryable: z.boolean(),
  attempts: z.number().int().positive(),
  quota: EngineQuota.nullable(),
});
export type EngineErrorBody = z.infer<typeof EngineErrorBody>;

/** One successful model call. Every step records engine, model, tokens, time
 *  and cost (rules: "The code"). Cost is null when the engine is free. */
export const DraftResult = z.object({
  engine: ApiEngineId,
  model: z.string(),
  text: z.string(),
  /** The step's JSON, parsed and validated, when the step asked for JSON. */
  json: z.unknown().optional(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  ms: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  attempts: z.number().int().positive(),
  quota: EngineQuota,
});
export type DraftResult = z.infer<typeof DraftResult>;

/* --------------------------------------------------- the engines' replies */

/** The Claude Messages API (POST /v1/messages), the fields the adapter reads. */
export const ClaudeMessageReply = z.object({
  id: z.string(),
  model: z.string(),
  role: z.literal("assistant"),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_creation_input_tokens: z.number().int().nonnegative().nullable().optional(),
    cache_read_input_tokens: z.number().int().nonnegative().nullable().optional(),
  }).passthrough(),
}).passthrough();
export type ClaudeMessageReply = z.infer<typeof ClaudeMessageReply>;

/** OpenAI-compatible chat completions (Groq: /openai/v1/chat/completions). */
export const ChatCompletionReply = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number().int(),
    message: z.object({ role: z.string(), content: z.string().nullable() }).passthrough(),
    finish_reason: z.string().nullable(),
  }).passthrough()).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
  }).passthrough(),
}).passthrough();
export type ChatCompletionReply = z.infer<typeof ChatCompletionReply>;

/** Ollama's chat API, as Ollama Cloud serves it (POST https://ollama.com/api/chat). */
export const OllamaChatReply = z.object({
  model: z.string(),
  message: z.object({ role: z.string(), content: z.string() }).passthrough(),
  done: z.boolean(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().optional(),
}).passthrough();
export type OllamaChatReply = z.infer<typeof OllamaChatReply>;

/** Cloudflare Workers AI (POST /client/v4/accounts/:id/ai/run/:model). */
export const CloudflareRunReply = z.object({
  success: z.boolean(),
  result: z.object({
    response: z.string().nullable(),
    usage: z.object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
    }).passthrough().optional(),
  }).passthrough().nullable(),
  errors: z.array(z.object({ code: z.number().int().optional(), message: z.string() }).passthrough()),
}).passthrough();
export type CloudflareRunReply = z.infer<typeof CloudflareRunReply>;
