import { ChatCompletionReply, CloudflareRunReply, OllamaChatReply } from "@octa/contracts/assistant";
import { EngineError, httpError, parseReply, scrub, type Adapter, type EngineCall, type RawReply } from "./core.js";

/**
 * The three free engines whose terms do not train on or keep input (plan §3a):
 * Ollama Cloud, Groq and Cloudflare Workers AI. Plain HTTPS; none has an SDK
 * this project uses. Each reply is checked against its contract in
 * `@octa/contracts/assistant`.
 *
 * Their fixtures (test/assistant-engines.spec.ts) follow each provider's
 * documented reply shape and are NOT recorded: no key existed when they were
 * written (8 Oct 2026). B0 online records real ones.
 */

async function postJson(c: EngineCall, url: string, headers: Record<string, string>, body: unknown): Promise<{ data: unknown; headers: Headers }> {
  let res: Response;
  try {
    res = await c.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: c.signal,
    });
  } catch (e) {
    if (c.signal.aborted) throw e; // the core names it a timeout
    throw new EngineError("unavailable", scrub(`network: ${e instanceof Error ? e.message : String(e)}`, c.key));
  }
  if (!res.ok) throw await httpError(res, c.key);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new EngineError("malformed", "the reply is not JSON");
  }
  return { data, headers: res.headers };
}

function noVision(c: EngineCall, engine: string): void {
  if (c.ctx.images?.length) throw new EngineError("no_vision", `${engine} is called text-only here; the step carries images`);
}

/** Groq: OpenAI-compatible chat completions. Vision through image_url parts. */
export const groqAdapter: Adapter = {
  id: "groq",
  async call(c) {
    const content = c.ctx.images?.length
      ? [
          ...c.ctx.images.map((i) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${i.base64}` } })),
          { type: "text", text: c.ctx.prompt },
        ]
      : c.ctx.prompt;
    const { data, headers } = await postJson(c, "https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${c.key}` }, {
      model: c.model,
      max_completion_tokens: c.ctx.maxTokens,
      messages: [{ role: "system", content: c.ctx.system }, { role: "user", content }],
      ...(c.ctx.output ? { response_format: { type: "json_object" } } : {}),
    });
    const r = parseReply(ChatCompletionReply, data, "the Groq reply");
    const choice = r.choices[0]!;
    if (choice.finish_reason === "length") throw new EngineError("truncated", `the reply reached max tokens (${c.ctx.maxTokens})`);
    return reply(choice.message.content, r.usage.prompt_tokens, r.usage.completion_tokens, r.model, headers, "Groq");
  },
};

/** Ollama Cloud: Ollama's own chat API on ollama.com, never this laptop. */
export const ollamaCloudAdapter: Adapter = {
  id: "ollama_cloud",
  async call(c) {
    const { data, headers } = await postJson(c, "https://ollama.com/api/chat", { authorization: `Bearer ${c.key}` }, {
      model: c.model,
      stream: false,
      messages: [
        { role: "system", content: c.ctx.system },
        { role: "user", content: c.ctx.prompt, ...(c.ctx.images?.length ? { images: c.ctx.images.map((i) => i.base64) } : {}) },
      ],
      options: { num_predict: c.ctx.maxTokens },
      ...(c.ctx.output ? { format: "json" } : {}),
    });
    const r = parseReply(OllamaChatReply, data, "the Ollama Cloud reply");
    if (!r.done) throw new EngineError("malformed", "the Ollama Cloud reply is not done (a streamed reply)");
    if (r.done_reason === "length") throw new EngineError("truncated", `the reply reached num_predict (${c.ctx.maxTokens})`);
    return reply(r.message.content, r.prompt_eval_count ?? 0, r.eval_count ?? 0, r.model, headers, "Ollama Cloud");
  },
};

/** Cloudflare Workers AI. The key is "accountId:apiToken". Text-only here. */
export const cloudflareAdapter: Adapter = {
  id: "cloudflare",
  async call(c) {
    noVision(c, "Cloudflare");
    const i = c.key.indexOf(":");
    if (i <= 0 || i === c.key.length - 1) throw new EngineError("auth", "a Cloudflare key is stored as accountId:apiToken");
    const account = c.key.slice(0, i);
    const token = c.key.slice(i + 1);
    const { data, headers } = await postJson(
      c,
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${c.model}`,
      { authorization: `Bearer ${token}` },
      { messages: [{ role: "system", content: c.ctx.system }, { role: "user", content: c.ctx.prompt }], max_tokens: c.ctx.maxTokens },
    );
    const r = parseReply(CloudflareRunReply, data, "the Cloudflare reply");
    if (!r.success || !r.result) {
      throw new EngineError("malformed", scrub(`Cloudflare reported failure: ${r.errors.map((e) => e.message).join("; ") || "no detail"}`, c.key));
    }
    return reply(r.result.response, r.result.usage?.prompt_tokens ?? 0, r.result.usage?.completion_tokens ?? 0, c.model, headers, "Cloudflare");
  },
};

function reply(text: string | null, tokensIn: number, tokensOut: number, model: string, headers: Headers, who: string): RawReply {
  if (text === null || text.trim() === "") throw new EngineError("malformed", `the ${who} reply has no text`);
  return { text, tokensIn, tokensOut, model, headers };
}
