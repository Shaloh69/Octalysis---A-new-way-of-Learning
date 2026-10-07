---
paths: ["tools/assistant/**", "services/api/src/assistant/**", "apps/console/src/**/assistant/**", "packages/contracts/src/assistant*", "db/addendum-assistant*.sql", "docs/AI-ASSISTANT-PLAN.md"]
---
# Drafting assistant rules

These bind every session that builds or changes the drafting assistant. The
design and the reasons are in `docs/AI-ASSISTANT-PLAN.md` (v6, approved
7 Oct 2026; the round tables at the top and §3a-§4e hold the instructor's
rulings, §4-six the current design, superseding §4-now where they differ). This file is the short
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
- **Each teacher's app calls the engines** (round six, 7 Oct 2026; plan
  §4-six), from their laptop, with their own keys; the API never does. The
  app hands each step's result to the API, which runs the checks and records
  engine, model, tokens, ms and cost on the step: the teacher's token log.
  `/assistant` is **locked** ("No AI Assistant connected with this device.
  Download here and install") until one of the teacher's paired apps has
  sent a heartbeat in the last 2 minutes; no `localhost` probe. B3's
  server-side chain, sealing and tick (built and retired the same night)
  are in git history at `f1d87d3`: the reference for the app's port.
  An adapter's tests run on recorded replies; until a key exists, fixtures
  follow the provider's documented shape and **say they are not recorded**.
- **No "sign in with Claude" inside the app.** Anthropic does not allow
  third-party apps to offer claude.ai login without approval. A
  subscription is used only through the teacher's own Claude Code and our
  plugin.
- **Keys never reach OCTA** (round six). The app keeps each teacher's keys
  in Windows Credential Manager under the paired teacher, sends a key only
  to the engine it belongs to, and never to the API, the browser, a log or
  git. Two teachers on one laptop pair separately and keep separate keys.
  No table or column on OCTA holds a key, sealed or not (a test enforces it).
  The admin sees each teacher's token **totals** only, never their drafts.

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
