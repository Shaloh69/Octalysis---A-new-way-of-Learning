import Anthropic from "@anthropic-ai/sdk";
import { ClaudeMessageReply } from "@octa/contracts/assistant";
import { codeForStatus, EngineError, parseReply, readQuota, scrub, type Adapter, type EngineCall, type RawReply } from "./core.js";

/**
 * The Claude API, on the teacher's own key (plan §3a: first in the chain
 * whenever a key is added). Through Anthropic's SDK, with the SDK's own retries
 * off (`maxRetries: 0`) so the core's one policy applies to every engine.
 *
 * Claude Opus 5.5 always thinks; effort is set to "high" for drafting. The
 * server-side fallback (`fallbacks: "default"`) re-runs a request a safety
 * classifier declined on a model that will take it, inside the same call. A
 * reply that still ends in "refusal" fails this engine and the chain moves on.
 */

export const claudeAdapter: Adapter = {
  id: "claude_api",
  async call(c: EngineCall): Promise<RawReply> {
    const client = new Anthropic({ apiKey: c.key, fetch: c.fetch, maxRetries: 0, timeout: 600_000 });
    const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
      ...(c.ctx.images ?? []).map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: img.base64 },
      })),
      { type: "text" as const, text: c.ctx.prompt },
    ];
    let data: unknown;
    let headers: Headers;
    try {
      const r = await client.beta.messages
        .create(
          {
            model: c.model,
            max_tokens: c.ctx.maxTokens,
            system: [{ type: "text", text: c.ctx.system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content }],
            output_config: { effort: "high" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal: c.signal, headers: { "idempotency-key": c.step.idempotencyKey } },
        )
        .withResponse();
      data = r.data;
      headers = r.response.headers;
    } catch (e) {
      if (e instanceof Anthropic.APIError && typeof e.status === "number") {
        const quota = e.headers ? readQuota(e.headers) : null;
        throw new EngineError(codeForStatus(e.status), scrub(`HTTP ${e.status} ${e.type ?? ""}: ${e.message}`, c.key), { status: e.status, quota });
      }
      throw e;
    }
    const msg = parseReply(ClaudeMessageReply, data, "the Claude reply");
    if (msg.stop_reason === "refusal") throw new EngineError("refused", "Claude declined this step (stop_reason refusal)");
    if (msg.stop_reason === "max_tokens") throw new EngineError("truncated", `the reply reached max_tokens (${c.ctx.maxTokens})`);
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    if (text.trim() === "") throw new EngineError("malformed", "the Claude reply has no text");
    return {
      text,
      tokensIn: msg.usage.input_tokens,
      tokensOut: msg.usage.output_tokens,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
      model: msg.model,
      headers,
    };
  },
};
