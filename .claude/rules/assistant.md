---
paths: ["tools/assistant/**", "services/api/src/assistant/**", "apps/console/src/**/assistant/**", "packages/contracts/src/assistant*", "db/addendum-assistant*.sql", "docs/AI-ASSISTANT-PLAN.md"]
---
# Drafting assistant rules

These bind every session that builds or changes the drafting assistant. The
design and the reasons are in `docs/AI-ASSISTANT-PLAN.md` (v5, approved
7 Oct 2026; §3a-§4e hold the instructor's rulings, §4-now the current
design). This file is the short
form, loaded whenever these paths are touched. **If the plan's paths change
when the code is created, update the `paths:` above in the same commit.**

## The engines

- **One interface.** Every engine (the Claude API, Ollama Cloud, Groq,
  Cloudflare, the Claude Code plugin, local Ollama) is an adapter behind one
  `draft(step, context) → result` contract with the same retries, timeouts,
  quota reading and error shape. Nothing outside an adapter knows which
  engine ran.
- **The chain order:** the Claude API first when the teacher has a key, then
  the free engines that do not train on input (Ollama Cloud, Groq,
  Cloudflare). **Local Ollama is PAUSED** (round five, 7 Oct 2026): it is
  listed on `/assistant` as "a future update" and is not selectable; no
  code may run a model on a teacher's laptop until that update is ordered.
  With every engine out of quota a step waits and says so. An engine whose
  terms train on or log input (Gemini free, Mistral free without opt-out,
  NVIDIA free, OpenRouter free) is **off by default**: every job carries a
  copyrighted book.
- **The API calls the engines** (round five). Steps run on Render, ticked by
  `pg_cron` + `pg_net` only while a job is running; never a Render cron, and
  nothing that keeps the API awake while idle. Built in B3 (8 Oct 2026):
  `services/api/src/assistant/` (`engines/core.ts` is the one `draft()`;
  `chain.ts`; `tick.ts` behind `CRON_SECRET`; `db/addendum-assistant-tick.sql`).
  An adapter's tests run on recorded replies; until a key exists, fixtures
  follow the provider's documented shape and **say they are not recorded**.
- **No "sign in with Claude" inside the app.** Anthropic does not allow
  third-party apps to offer claude.ai login without approval. A
  subscription is used only through the teacher's own Claude Code and our
  plugin.
- **Keys** are sealed by the API (AES-256-GCM, the secret only in Render's
  environment) in a table with RLS on and no policy that grants anything:
  `assistant_engine_keys` carries the explicit deny-all `aek_deny_all`, as
  `assessment_secrets` does, so INV-02 and hard rule 3 stay strict. Write-only from the
  page: no route returns a key, the page sees its last four characters.
  Never in `VITE_*`, git, a response body or a log; an engine's error text is
  scrubbed of the key (`scrub()`). The owner and engine are the cipher's
  associated data, so a sealed key copied to another row does not open. Denial tests red first:
  no teacher reads a key row, their own included; teacher B cannot run on
  teacher A's key.

## Memory and approved work

- **No engine remembers; OCTA does.** Work is cut into saved steps, each
  with status, engine, model, prompt version, input hashes and an
  idempotency key. A restart resumes at the next unfinished step.
- **The chapter brief** (outline, terms, chosen figures, the teacher's
  decisions, summaries of accepted sections) is the memory every engine
  receives. Never a chat transcript.
- **The context builder packs for the target engine's window,** by
  priority, and **splits a step rather than truncating the book's text.**
- **An accepted unit is frozen.** No step, engine or re-run writes to it;
  a trigger refuses any change for every role. A change is a **new version
  beside it**, with a diff, accepted separately. Later steps read accepted
  text verbatim as read-only context. Export takes accepted units only.

## The output: no AI slop

- Every paragraph teaches something checkable (a book fact, a worked step,
  an objective link), or it is flagged.
- The stock-phrase list, padding patterns, vague intensifiers without a
  number, repeated sentence shapes and term drift from the brief are
  **linted in code**, then scored by a critic. Flags are shown, never hidden.
- Few-shot voice comes from the **approved** chapters 01-07, never from
  generic examples.
- Questions: no "all/none of the above", no giveaway option length, no
  stem that answers itself; the blind-answer critic runs on every one.

## Double-checking (plan §4e)

- No unit is "ready" until its checks have run: quotes verified, claims
  paired, labels grounded, keys from solvers, questions previewed through
  the API, the chapter's paper-fill check, and renders at 380 and 1440
  measured for text overlap and clipping.
- **A second engine checks the first.** With one engine only, it checks with
  fresh context and the unit is labelled "single-engine check".
- **Planted-error canaries before every job:** each check must catch its
  known-bad sample, or the job does not start.
- **Every unit carries a verification report:** what was verified, and what
  was not checked. Nothing unrun is left out of it.
- **Golden regression:** accepted work (chapter 12, the 09-12 questions) is
  the fixture a new prompt version or engine must match before real use.

## The code

- TypeScript strict (no `any` without `// why:`); typed Python in the app.
- Zod at every boundary via `packages/contracts`, **including each engine's
  JSON output**: malformed output is a failed step, never "best effort".
- Prompts are versioned files in the repo, never inline strings.
- Tests for every check, the context builder, the router, the step machine
  and each adapter (against recorded responses). Denial tests for every
  table, **written red first**. The slop lint and the grounding check each
  have a test that catches a planted example.
- Schema as idempotent addenda, pushed to Supabase before the code
  (hard rule 10). Errors as `{ error: { code, message } }`.
- Every step records engine, model, tokens, time and cost.
- The console page `/assistant` follows the page gate: template, `SPEC.md`,
  spec, captures at 1440 and 380, **opened and looked at**.
