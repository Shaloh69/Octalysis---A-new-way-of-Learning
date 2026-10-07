# The drafting assistant — plan v6, APPROVED (built after teacher accounts, T1)

**History.** v1 (6 Oct 2026) planned a small local tool. v2 (7 Oct) answered
"do what you were doing with all of the books; summarise the figures,
charts and graphs; think about more features". v3 (7 Oct) took in the
instructor's first answers. **v4** (7 Oct, evening) takes in the second
round, and every decision is now made. **v5** (7 Oct, night) pauses local
Ollama: the online engines run from OCTA's own API, and local Ollama
becomes a "future update" choice on the page (round five, below; §4-now).

**Rulings, round six (7 Oct 2026, night, after B3's first session) — v6,
APPROVED (§4-six), superseding §4-now wherever they differ:**

> "I want the AI keys to be different with every teacher because every
> teacher needs a different log to have independent tokens … to use the new
> page in the Console the AI Assistance it will be locked and will be
> prompted when opening: No AI Assistant connected with this device.
> Download Here and Install."

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | What the installed app does | **Holds that teacher's keys and calls the online AIs** (Claude API, Ollama Cloud, Groq, Cloudflare) **from the laptop**. Keys never stored on OCTA. No local model (local Ollama stays paused). Drafting runs only while the laptop is on. **Reverses round five's ruling 2** (the API holding sealed keys and calling the engines) |
| 2 | Token logs | **Each teacher sees their own full log; the admin also sees every teacher's totals** (tokens, cost, engine), never their drafts |
| 3 | The page | `/assistant` is **locked** until an app is connected: "No AI Assistant connected with this device. Download here and install" |
| 4 | Teachers, subjects, the roster | A separate plan: `docs/TEACHERS-AND-SUBJECTS-PLAN.md` |
| 5 | The unlock rule ("connected with this device") | **One of this teacher's paired apps is online** (a heartbeat in the last 2 minutes), and the page names it. No `localhost` probe |
| 6 | Today's API-side B3 pieces | **Retired**: the sealed-keys table, `seal.ts`/`keys.ts`, the server tick, its cron job and Vault secrets, the TypeScript adapters and the Anthropic SDK in the API. `CRON_SECRET` and `ASSISTANT_KEY_SECRET` are no longer needed on Render |
| 7 | Order | **Teacher accounts (T1) first**, then the assistant's app |

**Rulings, round five (7 Oct 2026, night), during B0:**

> "Wait lets pause the ollama AI put that into the selection in the page if
> they want to select that as a future update. Use the other AIs for now
> that dont use my laptop as the host of ollama like in the checklist."

| # | Decision | The instructor's answer |
|---|---|---|
| 1 | Local Ollama | **Paused.** It appears in `/assistant`'s engine list as **"Local Ollama, on your laptop: a future update"**, shown and not selectable. The Windows app (old B3) is deferred with it |
| 2 | Who calls the online engines | **OCTA's API on Render.** A teacher pastes keys on `/assistant`; the API keeps them encrypted, per teacher, owner-only, and never sends one back to a browser. **Supabase Cron ticks a running job one step at a time**, so a chapter keeps drafting with every laptop closed. This replaces v4's "keys never on OCTA's servers" (§4-now says how they are kept) |
| 3 | Which engines first | **All four:** the Claude API, Ollama Cloud (Ollama's own servers, not this laptop), Groq, Cloudflare Workers AI. The instructor gets the keys |
| 4 | Ollama on this laptop | **Kept, paused**: installed, not running, removed from Startup (the shortcut is `D:\ollama-models\Ollama-startup.lnk.paused`); three models, 17 GB, in `D:\ollama-models` |

**Rulings, first round (7 Oct 2026):**

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | The engine | **Free.** "Will Ollama suffice?" (answered in §3) |
| 2 | Which machine | Hosted (Render Free or Railway), refined in round two |
| 3 | How far past chapter 12 | **"This AI is for future books"**; this book's remaining chapters are its **test** |
| 4 | The MP3s | **Scrapped**: the browser voice Listen uses today is enough |
| 5 | Features | "Tell me the features and explain them" (§6) |
| 6 | (the instructor's idea) | **"Each teacher will use their own laptop… an executable that the website checks and connects to, so the AI runs locally"** (§4) |

**Rulings, second round (7 Oct 2026, evening):**

| # | Decision | The instructor's answer |
|---|---|---|
| 1 | The design | **"We already have the websites": the API on Render, the student web and the console on Vercel.** So there's no new website: the assistant is a **console page** and **API routes** (§4) |
| 2 | Install Ollama on this laptop for B0 | **Yes** |
| 3 | Windows only, unsigned, at first | **"You decide."** Decided: **Windows only, unsigned**, with "More info → Run anyway" in the setup guide. It's free, and this laptop and the course run on Windows. macOS when there's a budget for Apple's $99/year |
| 4 | Will OCTA serve several courses and teachers? | **Yes, one day: "a future dev plan."** So the assistant's tables carry a course and an owning teacher from the start (§4). OCTA's own move to many courses is a **separate plan, not written yet**, and not part of this one |
| 5 | Which extras | **All of them**: 10, 11 and 12 with the core; 13-16 after it (§6) |
| 6 | Order | **"This will be last on the implementation plan."** It's built after everything else in the queue (ruling 4 verified live, R5, and whatever comes before it) |
| 7 | (round three) A Claude subscription, and other strong free AIs | **Yes: an engine chain** with local Ollama as the final fallback. A subscription works through the teacher's own Claude Code and our plugin; a sign-in button would need Anthropic's approval (§3a) |
| 8 | (round four) The Claude API; code rules; no slop; memory across sessions and engines; approved output never mangled | **Yes to all**: the Claude API leads the chain when a key is present (§3a); memory (§4a); approved units frozen (§4b); output rules (§4c); code rules (§4d) |
| 9 | (round four) "A feature with double checking and with tests like we had here" | **Yes**: a second engine checks the first, planted-error canaries before every job, renders at 380 and 1440 checked for overlap, a verification report on every unit, golden regression on accepted work (§4e) |

**Where it stands** (7 Oct 2026, night): B1 (the figure reader, and the
book's figures uploaded) and B2 (the schema) exist. B3's server-side chain
was built and retired the same night by round six; the app replaces it,
**after the teacher accounts (T1)**. B0 online waits on the keys.

---

## 1. What it is now

It is a **staff-only page in the console** for turning a textbook into
course material: lesson text, questions, redrawn figures, and a catalogue
of every figure, chart, graph and table in the book. Its routes live in
the existing API, and **the API calls the online AIs** the teacher has
added keys for (v5: the Claude API, Ollama Cloud, Groq, Cloudflare), or the
teacher drafts in their own Claude Code. Local Ollama on a teacher's laptop
is a **future update**, listed on the page and not yet selectable. It is built for **future books**: a new
course, or a new edition, starts by giving it the book and its syllabus.
**The rest of this book (syllabus chapters 13-17) is its test.**

The rules OCTA already lives by still hold. Every quote is checked against
the book, every figure passes the figure checker, every answer key is held
by code, and **nothing reaches a student until the instructor approves it**.

## 2. Measured facts this plan rests on (7 Oct 2026)

| Fact | Measured |
|---|---|
| Render Free web service | **512 MB RAM, 0.1 CPU, no GPU**; sleeps after 15 min with no traffic; 750 instance-hours a month **shared across the workspace** (OCTA's API uses the same pool); no background-worker service type on free |
| OCTA's API on Render | **not kept awake**: the deployment has no keep-alive job (`cron.job`: item-stats, invariants, scheduled-locks only), so a second free service has room in the 750 hours |
| Railway Free | **0.5 GB RAM, 1 vCPU, $1 of credit a month**, no GPU (the $5 trial is one-time; Hobby is $5/month) |
| What Ollama needs | the smallest model worth trying here needs about 2-3 GB of memory on its own; a 7-8 B model about 5 GB |
| This laptop | RTX 3050 Laptop GPU with **4 GB VRAM**, 16 GB RAM, Python 3.13 and PyMuPDF; Ollama not installed |
| The book | 18 MB PDF, real text layer, an embedded outline. **Figures are vector drawings**, so their labels and chart points can be read exactly. About 355 figures and 150 tables |
| Gemini API free tier | free, but Google's terms say unpaid-tier content is used "to provide, improve, and develop Google products", and human reviewers may read it. Daily limits are small and keep changing (reported 20-500 requests a day per model in September 2026) |

## 3. Will Ollama suffice? Two answers

**On Render Free or Railway Free: no, it cannot run there at all.** A model
needs several GB of memory. Render Free has 512 MB and Railway Free 0.5 GB,
and neither has a GPU. Railway's paid plans have the memory, but they cost
money, run on CPU only, and would be very slow. "Free" and "the AI runs on
the host" cannot both be true.

**On a teacher's laptop: yes, it runs, with limits we will measure.** Ollama
is free and keeps the model on the teacher's machine. On this laptop, the 4 GB card holds a 3-4 B vision model
whole, and 16 GB of RAM lets a 7-14 B model run split between the card and
memory: slowly (an estimate: a few words a second), but free. That is fine
for a job you start in the evening and review in the morning.

**How good will the drafts be?** Better than a 2 B model, and below what the
Claude sessions produced for chapters 08-12. Much of the design exists so
that a small model can still be useful:

- The **figure reader, chart data, checks and renderers are code**. They need
  no model, so they come out the same quality on any engine.
- The model **never types a quote** (code pastes the book's words) and
  **never computes a key** (the solvers do).
- The **grounding check** refuses a figure summary that names anything not
  in the figure, and the **claim check** flags any unsupported sentence. A
  weak model produces more refusals, not wrong material that slips through.

So Ollama will produce **usable drafts that need more of your editing**.
How much more is exactly what the chapter 13-17 test measures (§7). If the
answer is "too much", the engine can be swapped later without rebuilding
anything. Every engine sits behind one interface.

**Which model (Ollama library, checked 7 Oct 2026).** No local model matches
Claude. The open models that come nearest (`qwen3.5:122b` at 81 GB,
`mistral-medium-3.5` at 128 B, `gpt-oss:120b`, `deepseek-v3` at 671 B) need a
workstation with 80+ GB of memory, not a laptop. The app picks by the
teacher's hardware:

| Teacher's machine | Figures (needs vision) | Lesson text, questions, checks | Expect |
|---|---|---|---|
| no GPU, 8 GB RAM | `qwen3.5:2b` (2.7-3.1 GB) | not recommended | figure summaries only, slowly |
| **4 GB GPU, 16 GB RAM (this laptop)** | **`qwen3.5:4b`** (3.3-4.0 GB, nearly all on the GPU) | **`qwen3.5:9b`** (6.6-7.6 GB, split GPU/RAM) | usable drafts, slow; overnight jobs |
| 8 GB GPU | `qwen3.5:9b` | `qwen3.5:9b` | reported 54-58 words/s at 32 K context on 8 GB cards |
| 16-24 GB GPU | `qwen3.5:27b` or `gemma4:26b` | the same | the closest a single PC gets |

All Qwen 3.5 sizes read images, call tools, and have a thinking mode. The
comparison model for B0 is `gemma4:12b` (7.7-8.0 GB). **B0 measures these on
book 15's figures before anything is built on them.**

**Matching the settings the Claude sessions used.** Claude read a whole
chapter (about 25 K tokens) at once. Locally, memory limits the context to
about 16-32 K, so the app works **one section at a time**, which the design
already does. Thinking is **on** for questions and the claim check, and off
for extraction. Temperature is low (about 0.2) for summaries and checks.
Every output is constrained to a **JSON schema** (Ollama supports this), so
a draft is the right shape before a check even runs. The **content rules**
the sessions followed (`.claude/rules/content.md`) become each job's fixed
prompt.

**Free online engines, and a Claude subscription:** see §3a. Local Ollama
is the last link in that chain, never the only one.

## 3a. The engine chain: Claude if a teacher has it, strong free AIs next, local Ollama last

Instructor, 7 Oct 2026: "If someone has a Claude account with a subscription
they can use that too. Or are there other free AI APIs that are actually
strong that we can switch around, with Ollama as the final fallback?"

**Yes.** Each teacher's app holds an **ordered list of engines** (the
"chain"): the Claude API first if the teacher has added a key, then the
free engines below, then local Ollama. Each job goes to the first engine that is switched on, has quota
left today, and is allowed to see the book. When one runs out or fails, the
job moves to the next. **Local Ollama is always last and always there**, so
a job never fails for want of an engine. Every draft is labelled with the
engine and model that wrote it. The checks are the same whoever wrote it.

### The rule for an engine: it may not keep the book

Every job carries pieces of a copyrighted textbook. An engine is **on by
default** only if its terms say it does **not train on, or keep, what it is
sent**. An engine that trains on free-tier input is **off**, and the app says
why next to it.

| Engine | Free allowance (checked 7 Oct 2026) | Strong? | Sees images? | Keeps or trains on input? | Default |
|---|---|---|---|---|---|
| **Claude API, the teacher's own key** | pay per use, not free | **the strongest** | yes | not used for training by default under Anthropic's commercial terms | **first, whenever a key is added** |
| **Ollama Cloud** | starter credits on the free plan, limits unpublished; big models such as `gpt-oss:120b` and `deepseek-v4-pro` | **yes** | some models | "Prompt or response data is never logged or trained on" | **on** (first of the free ones) |
| **Groq** | about 1,000 requests a day for `gpt-oss-120b` (30 a minute) | **yes** (text) | check per model | "does not retain customer data" by default; Zero Data Retention option | **on** |
| **Cloudflare Workers AI** | 10,000 "neurons" a day (`llama-3.3-70b`) | medium | yes (small models) | explicit commitment not to train on prompts or outputs | **on** |
| Google Gemini (free tier) | about 15/min, ~1,500/day, changing often | yes | yes | **trains on free-tier input**, and humans may review it | **off** |
| Mistral (free tier) | ~1 request/s, $10/month of credit | yes | yes | **may train**, with an opt-out | off unless the teacher confirms the opt-out |
| NVIDIA NIM | 40/min, ~10,000/day reported | yes | yes | **free usage is logged** | off |
| OpenRouter `:free` | 50/day (1,000 with $10 bought) | varies | varies | depends on the provider behind each model; some log or train | off |
| **Ollama, local** | unlimited | as the laptop allows (§3) | yes | never leaves the laptop | **always last** |

**Honest limits.** Free allowances are small and keep changing: Cerebras
ended its permanent free tier in July 2026, and GitHub Models has
reportedly been retired. So the app reads each engine's remaining quota
from its replies and never assumes. A chapter takes very roughly 100-200
model calls (figures, sections, questions, checks). So one free engine
covers a few chapters a day, and the chain spreads the rest.

**Engines that cannot see images** still summarise figures. The figure reader
(§5 B) hands them the exact labels, the chart data and the paragraphs that
cite the figure. Seeing the picture helps with layout, so image jobs prefer
an engine that sees.

**v5: the API holds the keys, encrypted** (round five, ruling 2; superseding
"keys stay on the teacher's laptop"). How, in §4-now. What has not changed:
a key never reaches a browser, never a `VITE_*` variable, never git, never a
log (hard rule 2's spirit).

**v5: local Ollama is paused** (round five, ruling 1). Until the future
update, the chain is the Claude API (when a key is added), then Ollama
Cloud, Groq and Cloudflare. With every engine out of quota, a step **waits**
and says so; it never fails silently and never falls to an engine that
trains on the book.

### The Claude API, for a teacher who has it

Instructor, 7 Oct 2026: "Also add Claude AI API if someone actually has
Claude." A teacher who adds an Anthropic API key (from the Claude Console,
billed per use, separate from a Pro or Max subscription) gets Claude **at the
front of the chain**, in the app, automatically, overnight included:

- **Model:** `claude-opus-5-5` by default (the same family that wrote
  chapters 08-12). The teacher can pick a cheaper Claude model in the app's
  settings.
- **Cheaper overnight:** jobs that can wait go through Anthropic's **Batch
  API** at half price, and the chapter's text is sent with **prompt caching**,
  so the many steps of one chapter don't pay for the same text each time.
  The estimate in §3 (about $3 a chapter, roughly half batched) is
  re-measured on the first real run.
- **A spending cap** set by the teacher in the Claude Console, and every
  step's cost shown in the console (§4d).
- **If Claude declines or the key runs dry,** the step moves to the next
  engine in the chain, and the draft says so.

### A Claude subscription (Pro or Max): yes, through the teacher's own Claude Code

Anthropic's rule (Agent SDK docs, checked 7 Oct 2026): "Unless previously
approved, Anthropic does not allow third party developers to offer
claude.ai login or rate limits for their products." So the app **cannot**
have a "sign in with your Claude account" button that spends a subscription
behind the scenes.

**The legitimate route is the one this project already uses: Claude Code
itself.** A teacher with a subscription installs Claude Code, signs in
there, and adds the **OCTA assistant plugin** we ship. It contains:

- an MCP server that lets their Claude Code **fetch** that teacher's next job
  (the chapter's text, figures, labels and chart data) and **hand in** the
  result, through the same API routes the app uses;
- a skill `/octa-draft` that carries the same content rules and job
  instructions the other engines get.

The teacher opens Claude Code and types `/octa-draft`. Claude does the job
the way these sessions did, and the result goes through the same checks and
the same review page. It is **the teacher using their own Claude Code**, not
our app using their login. Because the teacher starts it, it is manual, not
an overnight background job. For automatic runs on Claude, the teacher adds
an API key instead (the table above).

If you want a "sign in with Claude" button anyway, that needs **Anthropic's
approval first**. It's a request to Anthropic, not something to build
around.

## 4-six. APPROVED (v6, round six): the app holds the keys and calls the engines

Approved 7 Oct 2026 (night), with the unlock rule below as proposed. Not built. It brings back
v4's app (§4: pairing, heartbeat, the outbound-only design) **without its
local model**, and takes engine calls and keys out of the API again.

```
  ┌── Console /assistant (Vercel) ──────────────────────────────────┐
  │ LOCKED until an app is connected:                                │
  │   "No AI Assistant connected with this device.                   │
  │    Download here and install."  [Download] [3-step setup guide]  │
  │ unlocked: jobs · progress · review · Accept/Reject · export ·    │
  │           MY TOKEN LOG (per step, per day, per engine)           │
  └─────────────┬────────────────────────────────────────────────────┘
                │ staff sign-in                      ▲ heartbeat, jobs (Supabase,
  ┌── API (Render) ──────────────┐                   │ owner-only RLS, Realtime)
  │ pairing · jobs · RECEIVES     │◄── results ──┐   │
  │ results, runs the CHECKS,     │              │   │
  │ records tokens/ms/cost        │   ┌── Teacher A's laptop: OCTA Assistant ──┐
  └───────────────────────────────┘   │ paired to Teacher A only                │
                                      │ A's keys in Windows Credential Manager  │
                                      │ the engine chain → Claude / Ollama      │
                                      │   Cloud / Groq / Cloudflare (HTTPS)     │
                                      │ B1's figure reader (PyMuPDF)            │
                                      └─────────────────────────────────────────┘
```

- **Keys:** entered in the app, kept in **Windows Credential Manager under
  the paired teacher**, sent only to the engine they belong to. Never to
  OCTA, never to the browser. Two teachers on one laptop pair separately and
  keep separate keys. So each teacher's tokens are their own account's.
- **The token log:** the app hands each step's result to the API with its
  engine, model, tokens, ms and cost; the API records them on the step
  (`assistant_steps` already has the columns, owner-only). `/assistant`
  shows the teacher their log; the admin's `/teachers` page shows each
  teacher's **totals** only, through an admin-only route (TEACHERS plan).
- **The lock ("connected with this device"):** the app writes a heartbeat
  to Supabase (a new `assistant_devices` table: owner, device name, app
  version, last seen). **A browser cannot prove the app runs on the same
  machine** without reaching into `localhost`, which §4 rejected (Safari
  blocks it; Chrome and Edge prompt; any site could probe the port).
  **Proposed:** the page unlocks when one of **this teacher's** paired apps
  has been seen in the last 2 minutes, and names it ("Teaching laptop,
  online"). Not installed, or offline, shows the locked screen.
- **The engine chain moves into the app** (Python, beside B1's reader, one
  PyInstaller executable, unsigned, Windows first). Same contract as B3's:
  one `draft(step, context)`, retries, timeouts, quota, one error shape;
  each engine's reply checked against the same schemas (exported as JSON
  Schema from `@octa/contracts/assistant` so the two cannot drift).
- **The checks stay in the API** (§4: one copy of the JS OCTA trusts).
- **What today's B3 build becomes:** RETIRED: `assistant_engine_keys`,
  `seal.ts`, `keys.ts` (keys never on OCTA), the server tick, its cron job
  and Vault secrets, `CRON_SECRET`/`ASSISTANT_KEY_SECRET` on Render (no
  longer needed), the TypeScript adapters and the Anthropic SDK in the API.
  KEPT: `@octa/contracts/assistant` (the result and error shapes, each
  engine's reply schema), the step and job tables, the B1 upload. A drop
  addendum goes to Supabase first (hard rule 10), the code after.

## 4-now. The design for now (v5): the console and the API, no laptop app

Round five pauses the laptop. **Everything below runs on what OCTA already
has**, and no teacher's machine hosts anything:

```
  ┌──── The console (Vercel), page /assistant ──────────────────────┐
  │  Engines: Claude API [key ••••a1f3] · Ollama Cloud · Groq ·       │
  │           Cloudflare · Local Ollama (future update, not yet)      │
  │  choose a book + syllabus · start a job · progress · review       │
  │  side by side · Accept / Reject · export                          │
  └───────────────┬───────────────────────────────────────────────────┘
                  │ staff sign-in, as today
  ┌──── The API (Render), /assistant routes ─────────────────────────┐
  │  keys (write-only) · jobs · the engine chain · RUNS EACH STEP and │
  │  its checks with the same JS OCTA uses · export                   │
  └───────▲───────────────────────────┬───────────────────────────────┘
          │ POST /tick, only while     │ HTTPS to the engines
          │ a job is running           ▼
  ┌──── Supabase ──────────┐   Claude API · Ollama Cloud · Groq · Cloudflare
  │ jobs, steps, briefs,   │
  │ units, keys (sealed);  │
  │ pg_cron + pg_net tick  │
  └────────────────────────┘
```

- **Keys, kept by the API.** A teacher pastes a key on `/assistant`. The API
  encrypts it (AES-256-GCM) with a secret that exists only in Render's
  environment (`ASSISTANT_KEY_SECRET`, never `VITE_*`) and stores the sealed
  value in a table with RLS on and **no policy** (`service_role` only, as
  `assessment_secrets` is). The page can add, replace or remove a key and
  sees only "added 7 Oct, ends ••••a1f3". No route returns a key. Denial
  tests, red first: a teacher cannot read any key row, their own included;
  teacher B cannot use teacher A's key for a job; a key never appears in a
  response body or a log line.
- **The steps run on Render, ticked by Supabase Cron.** Render Free has no
  cron (CLAUDE.md), so `pg_cron` checks every minute whether any job is
  running and, **only then**, calls `POST /api/v1/assistant/tick` through
  `pg_net` with a shared secret. Each tick runs the next step or two (one
  model call each, about 5-90 s) and returns. With no job running nothing
  calls the API, so it sleeps as it does today. A running chapter keeps it
  awake for roughly 2-4 hours of the 750 a month. A step's state is saved
  before and after the call (§4a), so a sleep, a redeploy or a crash
  resumes at the next unfinished step.
- **The book.** The figure reader is Python (PyMuPDF) and Render Free has
  512 MB, so parsing a whole PDF there is not the plan. For this book the
  reader (B1) runs once from the repo as a script and uploads each figure's
  crop, labels and chart data to a **private, owner-only bucket**; the
  steps read those. A browser upload for a NEW book (B9) decides then
  whether a lighter parser runs in the API or the same script runs once.
- **Claude via a subscription** stays possible through the teacher's own
  Claude Code and our plugin (B3b): Anthropic's servers run the model, not
  the laptop.
- **What stays from v4:** owner and course on every table, staff-only and
  owner-only RLS, frozen accepted units, the slop lint, double-checking,
  and every check run by the API.

The rest of §4 is **v4's laptop design, kept as the future update** that
turns "Local Ollama" on: the app, pairing, heartbeats.

## 4. The future update (v4's design): an app on each teacher's laptop

> "Each teacher will use their own laptop, for each teacher to run its own AI.
> Make this into an executable that the website checks and connects to, so
> that the AI will run locally." And: "We already have the websites: the API
> on Render, the student web and the console on Vercel."

**No new website and no new host.** The pieces are the ones OCTA already
has, plus one app:

```
  ┌──── The console (Vercel) — new page /assistant ────────────────┐
  │  "Your assistant: ● online · qwen3.5:9b · 4 GB GPU · v1.2"      │
  │  pair a laptop · choose a book + syllabus · start a job          │
  │  progress · review side by side · Accept / Reject · export       │
  └───────────────┬─────────────────────────────────────────────────┘
                  │ (staff sign-in, as today)
  ┌──── The API (Render) — new /assistant routes ───────────────────┐
  │  pairing · jobs · receives results and RUNS THE CHECKS with the  │
  │  same JS OCTA uses (--verify, figure checker, item checker,      │
  │  grounding, solvers) · export                                    │
  └───────────────┬────────────────────────────────▲───────────────┘
                  │ Supabase: jobs, heartbeats      │ results (one API call each)
                  ▼ (owner-only RLS; Realtime)      │
  ┌──── Teacher A's laptop ─────┐   ┌──── Teacher B's laptop ─────┐
  │  OCTA Assistant (Windows)   │   │  OCTA Assistant (Windows)   │
  │  · paired to Teacher A      │   │  · paired to Teacher B      │
  │  · Ollama + the model that  │   │  · a smaller model: no GPU  │
  │    fits THIS machine (§3)   │   │                             │
  │  · PyMuPDF: chapters,       │   │                             │
  │    figures, chart data      │   │                             │
  └─────────────────────────────┘   └─────────────────────────────┘
```

### How the console "checks and connects"

The app **calls out**; nothing calls into the laptop. It writes a
**heartbeat** to Supabase about once a minute: who it is, its version, the
model it runs, and the machine's GPU and memory. It hears about new jobs
through **Supabase Realtime**, which the class chat already uses. From the
heartbeat the console's `/assistant` page shows one of five states:

| State | What the teacher sees |
|---|---|
| **Not installed** | a Download button and a 3-step setup guide |
| **Offline** | "Last seen 2 hours ago". Jobs can still be queued; they run when the laptop is back |
| **Online** | the model, the hardware, and an expected time per chapter |
| **Busy** | the job running and its progress |
| **Out of date** | "Update the app" (a version older than the API accepts) |

**Why heartbeats go to Supabase, not to the API:** the API runs on Render
Free, which sleeps after 15 minutes without traffic and has 750 hours a
month. A heartbeat every minute would keep it awake around the clock and
use up nearly the whole month (`db/addendum-cron.sql` §5 warns about the
same thing for a keep-alive). The API wakes only when the app hands in a
result, or when a teacher opens the console.

**Why not the browser talking to `localhost`:** a page on the internet
reaching into a laptop is something browsers increasingly block or put
behind a permission prompt (Safari blocks it outright). It only works while
the page is open, and any other site could probe the same port. Outbound
needs no open port, no tunnel and no firewall change, and a job started at
6 pm runs overnight with the console closed.

### Pairing: how the app knows whose laptop it is

On first run the app shows a short code. The teacher types it into
`/assistant` (already signed in), and the app receives **its own session
for that teacher only**, kept in Windows' credential store. It can read that
teacher's jobs and write that teacher's heartbeats and results, nothing
else (owner-only RLS, with a **denial test proving teacher B's app cannot
see teacher A's jobs**, written red first, per hard rule 8). The console can
revoke a paired laptop.

### What the app contains

- **The worker:** pulls jobs, extracts chapters, figures and chart data with
  PyMuPDF, calls the model, and hands results to the API.
- **Ollama management:** it detects Ollama (installing it from ollama.com
  on first run if missing), measures the GPU and memory, and **downloads
  the model that fits this machine** (§3's tiers). It says what to expect
  before the download (2-9 GB, once).
- **One Windows executable**, built with PyInstaller (Python, because PyMuPDF
  is), **unsigned**: the setup guide shows the "More info → Run anyway"
  step. macOS later.

**What stays in the API, on purpose:** the **checks**. They are the same
JavaScript OCTA already trusts, and a second copy in the app would drift.
A result that fails a check is kept, with its errors, for the teacher to
see. The **previews** at 380 and 1440 are drawn by the teacher's own
browser on the review page, so the app needs no browser inside it.

### Many courses and many teachers, from the start

OCTA will one day serve several courses and teachers (ruling, 7 Oct). So
every assistant table carries a **course** and an **owning teacher** from
day one: books, jobs, heartbeats, paired devices, catalogue entries, and
drafts. Nothing assumes there is one course or one instructor, and nothing
needs rebuilding when OCTA grows. **OCTA's own course tables are not
changed by this plan.** Moving them to many courses is the separate future
plan.

### The book

The teacher picks the PDF **in the app**, and it never leaves the laptop as
a PDF. The app uploads the extracted chapter text and figure data to a
**private** staff-only bucket, because the API's checks need the text to
verify quotes against. Crops of the book's own art go up only for the
side-by-side review, also private. Nothing is public, and nothing goes
into git.

### Honest costs and limits

- **Unsigned means a warning:** SmartScreen says "Windows protected your
  PC" the first time. The setup guide shows the two clicks.
- **Each laptop sets its own quality.** A teacher with no GPU gets a small
  model and slow runs. The console labels every draft with the model that
  wrote it.
- **The first run downloads 2-9 GB** (Ollama plus a model).
- **Render's 750 free hours:** the API is woken only by results and by
  people using the console, never by heartbeats.

**Getting results into OCTA:** an accepted draft is **exported** in OCTA's
own formats (`content/stages/NN.draft.md`, `content/items/NN.json`,
`content/figures/<id>.svg`), as a download or a GitHub pull request. From
there it goes through `sync-content --verify` / `sync-items --check` and
lands at draft or review on `/content` and `/items`, exactly as today. The
assistant never writes OCTA's course tables directly.

## 4a. Memory: work survives restarts, sessions and engine switches

Instructor, 7 Oct 2026: "Context management, and it should survive between
sessions, also from Groq to Ollama etc."

**The principle: no engine remembers anything. OCTA does.** A chat
conversation is not where the work lives. Every engine, Groq, Ollama, a
Claude API key or a teacher's Claude Code, is handed what it needs for
**one step**, from records OCTA keeps. So switching engines halfway through
a chapter loses nothing, and neither does a laptop that sleeps, crashes or
is switched off for a week.

**1. A job is cut into small steps, and each step is saved.** "Draft
chapter 15" becomes one step per figure, per lesson section, per objective's
questions, per check. Every step is a row with its status (waiting, running,
done, failed, accepted), the engine and model that ran it, the prompt
version, the hashes of its inputs, and its output. A restart resumes at
**the next unfinished step**, never from the start. A step has an
idempotency key, so handing in the same result twice changes nothing.

**2. Each chapter has a brief: its memory.** It's a structured record, not
a transcript, built up as steps are accepted:

| The brief holds | Why |
|---|---|
| the outline: sections, in order, and the objective each serves | every step knows where it sits |
| **the chapter's terms**, each with the exact wording used and its source | Groq and Ollama can't call the same thing by two names |
| the figures chosen (catalogue verdicts) and their ids | the lesson and questions refer to the same figures |
| decisions the teacher made ("teach pipelining with the laundry analogy", "skip Fig 15.7") | a later engine follows them too |
| a short summary of each **accepted** section | a later section links back to it correctly |

**3. Context is packed for the engine that will run it.** Engines have very
different context windows (a local model about 16-32 K tokens, Groq about
131 K, Claude 1 M). For each step, a context builder packs, in priority
order: the job's fixed instructions, the step's **source passages from the
book**, the brief, then neighbouring accepted text. If it doesn't fit the
engine chosen, the builder **splits the step** or moves it to an engine with
a larger window. **It never quietly truncates the book's text.** The same
step, given to two engines, gets the same facts.

**4. A teacher's Claude Code works the same way.** `/octa-draft` fetches the
next step and its packed context through the plugin, and hands its result
back. A Claude Code session that ends mid-chapter loses nothing; the next
session picks up the next step.

## 4b. Approved work is frozen: nothing mangles it

Instructor, 7 Oct 2026: "Not mangling all approved output from the first
to the second."

This is the rule OCTA already applies to chapter drafts and figures (an
approval is bound to the exact text by hash), applied to every piece the
assistant makes:

- **The unit of approval is small:** one section, one figure, one question,
  one catalogue entry. Accepting section 2 locks section 2 only.
- **An accepted unit is never regenerated, rewritten or "tidied".** No later
  step and no other engine writes to it. A database trigger refuses any
  change to an accepted unit's text, for every role, as OCTA's triggers do
  for approved summaries and figures.
- **A change is a new version, never an edit** (hard rule 6's spirit). Redo
  section 2 with Ollama, and you get section 2 v2 **beside** v1, with a diff.
  v1 stays accepted until you accept v2.
- **Later steps see accepted text as read-only context,** verbatim. When
  Ollama writes section 3 after Groq wrote sections 1-2, it reads 1-2 exactly
  as you approved them and continues from them. It does not restate them.
- **A re-run runs only what isn't accepted.** "Run chapter 15 again" redoes
  the waiting and rejected steps and leaves every accepted unit alone.
- **Export takes accepted units only,** each recorded with the engine,
  model, prompt version and hash, so you can always see what made a piece
  and whether it changed since.

## 4c. No AI slop: the output rules

Instructor, 7 Oct 2026: "The output will not be AI slop."

Slop is text that sounds like teaching but says little: padding, stock
phrases, vague claims, the same sentence shape over and over. The checks
in §5 catch wrong text. These rules catch empty text. Every rule is enforced
by **code first**, and by a critic pass second, and a draft that fails is
flagged, not hidden.

| Rule | Enforced by |
|---|---|
| **Every paragraph teaches something checkable**: a fact from the book, a worked step, or a link to an objective. A paragraph with none is flagged | the claim check pairs each sentence with a book passage; a paragraph with no pairing and no objective link is flagged |
| **No stock AI phrases.** A list kept in the repo ("delve", "it's important to note", "plays a crucial role", "in today's fast-paced world", "a testament to", "in conclusion", "let's dive in", and more). It grows whenever the teacher marks a new one | a lint, like OCTA's other checks; one hit flags the paragraph |
| **No padding:** no introduction that restates the heading, no closing paragraph that restates the section, no "In this section we will…" | lint (opening and closing patterns) + the critic |
| **No vague quantities:** "very fast", "much larger", "significantly" must become a number from the book, or go | lint for intensifiers without a number nearby |
| **Plain, specific words, in the course's voice.** Few-shot examples are taken from **the approved chapters 01-07**, so drafts sound like the course, not like a chatbot | the prompt; then the critic scores voice against those examples |
| **Varied sentences**, not twenty sentences of the same shape | a measure of sentence-length spread and repeated openings |
| **Terms used exactly as in the brief**, one name per idea | checked against the brief's term list |
| **Questions are specific:** no "all of the above", no "none of the above", no option that's obviously longer than the rest, no stem that gives the answer away | the item lint + the blind-answer critic |
| **No invented examples presented as the book's.** An example not in the book is labelled as ours | the claim check |

The teacher sees each flag inline on the review page with its reason and
decides. Flags are counted per engine, so the chapter 13-17 test also
measures **which engine writes the least slop**.

## 4d. How the code is built: the standing rules

Instructor, 7 Oct 2026: "Always rule for the best code practices with
proper management." These bind every session that builds the assistant.
They are OCTA's existing conventions (root `CLAUDE.md`), plus what this tool
specifically needs:

- **TypeScript strict** in the API and console; no `any` without a `// why:`.
  **Python typed** (type hints checked by a type checker) in the app.
- **Zod at every boundary**, shared through `packages/contracts`: the app's
  results, the API's routes, and the **JSON each engine must return**.
  Engine output is parsed against the schema; malformed output is a failed
  step, never "best effort".
- **One engine interface.** Every engine is an adapter behind the same
  `draft(step, context) → result` contract, with the same retries,
  timeouts, quota reading and error shape. Adding or removing an engine
  touches one adapter, nothing else.
- **Prompts are code:** versioned files in the repo, reviewed like code,
  recorded on every step that used them. Never written inline.
- **Tests:** every check, the context builder, the router, the step machine
  and each adapter (against recorded responses) has unit tests. Every new
  table has **denial tests written red first** (hard rule 8). The slop lint
  and the grounding check each have a test that watches them catch a planted
  example.
- **Database changes** as idempotent addenda, pushed to Supabase before the
  code (hard rule 10).
- **Secrets:** engine keys only in the laptop's credential store; nothing in
  `VITE_*`, nothing in git, nothing in logs.
- **Errors** in OCTA's shape `{ error: { code, message } }`, never a stack
  trace. Every step failure is recorded with its reason.
- **Small conventional commits, pushed**, each phase box ticked in the same
  commit as its work. Pages get their template, `SPEC.md`, spec and
  captures at 1440 and 380, and are **looked at**.
- **Logs and cost:** every step records its engine, model, tokens, time and
  cost (zero for free engines), so a slow or failing engine is visible, not
  guessed.

## 4e. Double-checking and tests, the way this project works

Instructor, 7 Oct 2026: "Also a feature with double checking and with tests
like we had here."

The habits that kept this project honest become the assistant's own
pipeline. No unit reaches the teacher's review as **ready** until all of
this has run, and the result of each part is shown beside it.

| What this project does | What the assistant does |
|---|---|
| `sync-content --verify` checks every quote character by character | the same check, run by the API on every lesson unit; quotes are pasted by code, so a failure means a bug, and the step stops |
| the claim check by hand caught three errors in questions 09-12 | the **claim check** on every sentence in our own words (§5 E) |
| a second look before believing anything | **a second engine checks the first.** A unit written by one engine is reviewed by a **different** engine with its own prompt: are the facts in the cited passages, does the figure summary match the figure, is the question's key right. When only one engine is available, the same engine checks with fresh context, and the unit is labelled **"single-engine check"** |
| solvers compute the keys; 131 items previewed through the API | every computed question's key comes from its solver; every question is **previewed through the API's real item preview**, as a student would get it, before it is shown |
| `bank-feasibility.spec.ts`: can a paper fill? | after a chapter's questions, a **paper-fill check**: can the stage check for that chapter fill, with every objective covered, from what is accepted |
| "watch it fail before you make it pass" (hard rule 8); the figure-mention guard was watched catching a planted mention | **planted-error canaries.** Before each job, every check is fed a known-bad sample: a misquote, a wrong label in a figure summary, a stock phrase, an ambiguous question, a wrong key. **If any check fails to catch its plant, the job does not start**, and the console says which check is broken |
| THE HARDEST RULE: capture at 1440 and 380, then open it and look | every redrawn figure is rendered at **380 and 1440**. Code measures **text overlap and clipping** in the layout; an engine that sees images is asked what it sees, compared against the figure's summary; and the teacher sees both renders beside the book's crop |
| "say which you verified versus assumed" (definition of done) | **a verification report on every unit:** "quotes 12/12 verified · labels 9/9 grounded · key by solver · second engine (Groq) agreed · renders: no overlap · assumed: nothing". Anything not run is listed as **not checked**, never left out |
| specs stay green before moving on | **golden regression:** accepted work (chapter 12's figures and summaries, the 09-12 questions) is kept as fixtures. A new prompt version or a new engine is first run against them and compared; a change that does worse is refused before it touches a real chapter |
| suites at close: API, unit, specs | the assistant's own test suite (§4d) runs in CI like OCTA's, and `pnpm verify` covers it |

**What the teacher sees:** each unit's card shows a short line of ticks
and flags, with its report one click away. A unit with a failed check is
**not** hidden: it shows the failure, so the teacher can see what an engine
gets wrong. Those counts per engine are part of the chapter 13-17 test (§7).

## 5. How each job works

### A. Book and syllabus intake (new, for future books)

Pick the PDF in the app and give the syllabus on the console's `/assistant`. The app splits the book into chapters
using its outline (generalising `scripts/extract_book.py`), extracts every
figure and table, and pulls the objectives from the syllabus. It then
**drafts the syllabus-to-book chapter map** (this course needed one because
the syllabus follows the 9th edition and the book is the 10th), for you to
confirm.

Every PDF is laid out differently. `extract_book.py`'s clean-up rules
(running heads, soft hyphens, bold bullets) were tuned to this book, so
intake shows a **sample page before and after cleaning** for you to check.
A scanned book with no text layer is out of scope until OCR is added.

### B. Figure reader (code)

For each figure and table it saves the crop (private), the exact labels with
positions, and for charts the axes, series and every data point, read from
the vector drawing. A trial on 7 Oct cut out Fig 14.10 and Fig 2.2 cleanly.
Two of four were missed because captions use non-breaking spaces; that gets
fixed first. **Built (B1, §9):** all 380 figures of this book, coverage
clean, chart data checked against two formulas.

### C. Figure summaries (model + grounding check)

From the crop, the exact labels and the paragraphs that cite the figure,
the model writes: its kind, a 2-4 sentence summary in our own words, the
takeaways, the objectives it serves, a verdict (redraw, describe or skip),
and drafts of the caption and the accessible description. **Grounding
check:** any label or number it names must exist in the figure's extracted
labels or data, or the entry is refused and sent back with the mismatch
marked.

### D. Figure redraw (model writes a spec, code draws)

The model describes the figure as structured data: boxes, arrows, rows,
fields or series. A renderer per kind (pipeline grid, bit-field format,
block diagram, state diagram, chart) draws the SVG, so it passes OCTA's
figure checker by construction. Charts are re-plotted from the extracted
data or the book's formula, never estimated by eye. Each redraw is shown
beside the book's crop at 380 and 1440.

### E. Lesson text (quotes by reference + claim check)

The model cites passages by position, and code pastes the book's exact words.
Every sentence in our own words is then checked for a supporting passage;
any without one is flagged for you.

### F. Questions (keys held by code + blind critic)

Questions are drafted in OCTA's item format. Computed questions use only
registered solvers. A second pass answers each question without its key and
flags disagreements or ambiguity, and a duplicate check runs against the
bank.

## 6. The features, explained

**The core: what you asked for**

1. **Book and syllabus intake.** You upload a new textbook and its syllabus,
   and the tool splits the book into chapters, lists every section, and pulls
   out the learning objectives. It also proposes which book chapter serves
   which syllabus chapter; you confirm or correct it. *Why:* this is what
   makes it work for future books, not just this one. Today this mapping was
   worked out by hand.

2. **Figure, chart and table catalogue.** A list of every figure, chart,
   graph and table in a chapter. Each entry has a short summary in our own
   words, the facts a student should take from it, the objectives it supports,
   and a recommendation: redraw it, just describe it, or skip it. *Why:* you
   can see a chapter's visuals in five minutes and choose which matter,
   without paging through the book.

3. **Exact chart reading.** For charts and graphs, the tool reads the actual
   data points out of the PDF (the book's charts are drawn as vectors, so the
   numbers are there), along with the axes and scales. *Why:* summaries quote
   real numbers, and a redrawn chart plots the book's real data, not a guess.

4. **Grounding check.** Before a figure summary is accepted, every label and
   number it mentions is matched against the figure itself. *Why:* small
   models describe confidently and wrongly, and this stops that the same way
   `--verify` stops a misquote.

5. **Figure redraw.** The tool draws the chosen figures as OCTA SVGs in the
   course's own style (no copied artwork, credited "after Figure N.N") and
   shows each beside the original. *Why:* this is the slow manual step behind
   the 17 figures for chapters 01-13.

6. **Lesson text drafts.** A chapter's lesson organised around its objectives,
   original explanation plus exact quotes for definitions and facts. *Why:*
   it's the main work behind every chapter; with quotes pasted by code, the
   quote check passes every time.

7. **Claim check.** Every sentence in our own words is matched to a passage
   in the book that supports it; any sentence without support is highlighted
   for you. *Why:* a session found three of its own errors this way on 6 Oct.
   Here it runs on every draft automatically.

8. **Question drafts.** At least three questions per objective, with wrong
   options based on real misconceptions, a rationale and a source. Computed
   questions use OCTA's solvers, so every student still gets a unique paper.
   *Why:* this fills the bank that the exams draw from.

9. **Blind-answer critic.** A second pass tries to answer each question
   without seeing the answer key. If it picks a different answer, finds two
   defensible answers, or can answer without knowing the course, the question
   is flagged. *Why:* it catches broken questions before a student does.

**Extras: all approved (7 Oct). 10-12 are built with the core, 13-16 after it**

10. **Coverage map.** A grid of objectives against lesson sections,
    questions and figures, showing the gaps: an objective with fewer than
    three questions, or a figure that serves no objective. *Why:* you can
    see at a glance whether a chapter is complete.

11. **Review of what already exists.** Run the claim check and the critic
    over what is already written: the lesson text of 01-13 and the 314
    questions, including the 83 act-1 questions waiting for your approval.
    It only flags; you decide. *Why:* those 83 approvals are what stands
    between the course and a runnable Prelim, and this makes them faster.

12. **Planet and moon summaries.** Drafts of the one- or two-sentence planet
    summaries, which your 25 Sep ruling already allows to be drafted. *Why:*
    it is R3's last open box.

13. **Glossary.** Every definition in a chapter, quoted exactly with its
    source. *Why:* a ready revision aid. A student-facing glossary page
    (`/app/notebook`) is planned but not built, and **building it needs its
    own approval**.

14. **Lecture aids, for you only.** A slide outline, board notes, or a
    one-page review sheet, made only from text you have approved. *Why:* it
    saves preparation time. A review sheet becomes a student handout only
    if you choose.

15. **Question revision hints (later).** Once a question has been answered
    30+ times, questions that strong and weak students get equally right or
    wrong are flagged, with a suggested new version. Existing questions are
    never edited, only versioned. *Why:* it improves the bank from real
    results. It waits until real exposures exist.

16. **Feedback digest (later).** Student feedback summarised for you.
    *Why:* it is quicker to read. It stays on the laptop's model, because it
    is student data.

**Removed since v2:** audiobook preparation (the MP3s are scrapped).
**Not in this plan:** a student-facing AI tutor. It would answer students
live from unapproved text, and could hint at answers during papers (hard
rules 1, 5 and 9). It would need its own proposal.

## 7. The test: syllabus chapters 13-17 of this book

| Chapter | Book chapter | Why it is in the test |
|---|---|---|
| 13 RISC | 15 | **the benchmark**: a Claude session already drafted it (with two figures), so the two drafts can be compared side by side |
| 14 Instruction-level parallelism | 16 | the real test: no draft exists |
| 15 Control unit operation | 20 | the real test; also tests the chapter map, since the numbers differ most here |
| 16 Microprogrammed control | 21 | the real test |
| 17 Multicore | 18, also 17 | the real test, and the only one drawing on **two** book chapters |
| 18 Distributed systems | none | no edition covers it, so the tool must **stop and say so**. That is part of the test too |

**What gets measured, per chapter:** how many figures the reader found
against the captions in the text; how many summaries passed the grounding
check first time; whether every quote verified (it should be all of them);
claim-check flags; questions that passed the blind critic; the time the
laptop took; and in the end **how much you accepted, edited or rejected**.
That last number answers "is Ollama enough?" with evidence.

Test drafts stay inside the tool until you accept one. **Accepted ones go to
OCTA at draft/review**, as usual, so the 6 Oct ruling that authoring stops at
chapter 12 is not overridden by the test itself. Whether accepted 13-17
material goes live is your call on `/content` and `/items`.

## 8. What it will not do

- Write OCTA's course tables, approve anything, or export a draft you have
  not accepted.
- Serve the book or its crops publicly, or commit them to git.
- Let a student in.
- Decide what is correct: the checks and you do.
- Draft from a book chapter that does not exist, as with chapter 18.

## 9. Build order and effort — LAST in the implementation plan

The instructor ruled the assistant **last**. It starts only once the queue
before it is done: ruling 4 verified on the deployment, R5, and anything
added ahead of it. Then:

| Step | What | Sessions |
|---|---|---|
| B0 | **v5: the four online engines** (the Claude API, Ollama Cloud, Groq, Cloudflare) on book 15's 14 figures, with the same harness and scoring as the local run: label recall against the PDF's own text layer, invented labels, valid JSON, seconds per figure, tokens/s, the quota each reply reports. **Waits on the instructor's keys** (names below). Answers "which engine for which step" before anything is built | 1 |
| B1 | Figure reader + chart data for this book (fix the caption locator; check all ~355 figures are found); crops and labels to a private owner-only bucket (§4-now) | 1 |
| B2 | Schema: books, jobs, **steps**, **chapter briefs**, **versioned units** (with the trigger that freezes an accepted one), **sealed engine keys**, catalogue, **each with a course and an owner**. Staff-only, owner-only RLS with denial tests; an idempotent addendum pushed to Supabase first (hard rule 10). (Heartbeats and paired devices move to the future update) | 1 |
| B3 | **v5: the engine chain in the API**: one adapter per engine behind `draft(step, context)`, quotas read live, the sealed keys (§4-now), the `/tick` route and its `pg_cron` + `pg_net` job (runs only while a job is running) | 2 |
| later | **The future update: local Ollama.** v4's app (worker, pairing, heartbeat, Realtime jobs, Ollama detection and model download by hardware), one unsigned Windows executable, the setup guide; "Local Ollama" becomes selectable | 2-3 |
| B3b | **The Claude Code plugin** (§3a): an MCP server to fetch and hand in jobs, and the `/octa-draft` skill, for teachers with a Claude subscription | 1 |
| B4 | **The API routes** (pairing, jobs, results with the checks, export) and **the console page `/assistant`**. A new console page, so it is born with a template, a `SPEC.md`, a spec, and captures at 1440 and 380 | 2 |
| B5 | The step machine and context builder (§4a), the slop lint (§4c); then figure summaries + grounding check, then the redraw renderers | 3 |
| B6 | Lesson text + claim check; questions + critic; export | 2 |
| B6b | **Double-checking (§4e):** the second-engine check, the planted-error canaries, the render overlap check, the paper-fill check, the verification report, golden regression on chapter 12 and the 09-12 questions | 2 |
| B7 | Extras 10, 11 and 12: the coverage map, the review of existing work, planet and moon summaries | 1-2 |
| B8 | **The test on 13-17**, written up with the numbers | 1 |
| B9 | Book and syllabus intake for a new book | 1 |
| B10 | Extras 13-16: glossary, lecture aids, then question revision hints and the feedback digest when real data exists | 1 each |

About 18 sessions in all now (the app's 2-3 move to the future update).

**B0, the local run, as far as it went (7 Oct 2026, stopped by round five).**
Ollama 0.35.1 on the RTX 3050 (CUDA, 3.2 GiB free), the 14 figures of book
chapter 15 cropped from the PDF's vectors (all 14 found; crops opened and
checked: no running header, no body text, no caption, every sub-caption).
`qwen3.5:4b` read 5 of them before the stop: label recall **0.92-1.00**,
**13.8-15.9 tokens/s**, **13-46 s** a figure once loaded (83 s with the
load), valid JSON every time, a sensible kind and a plain summary. Its two
"invented" words ("file", "traffic") are printed in those figures ("register
file", "memory traffic"), so they are the scorer's misses, not the model's.
`qwen3.5:9b` and `gemma4:12b` were downloaded and never run. The harness and
the crops are scratch, not in the repo; B1 makes the crop real.

**B0 online: still waiting on the keys** (checked 7 Oct 2026, late, and again
later the same night: none of the five names below is in the root `.env`, nor any other env
file). B1 and B3 went ahead, as ordered.

**B1, the figure reader, built (7 Oct 2026, late).** Code at
`tools/assistant/figures/` (`reader.py`, `read_book.py`, `test_reader.py`;
typed, `mypy --strict` clean; `pnpm test:assistant`, `pnpm book:figures
<dir outside the repo>`). Measured on the whole book:

- **380 figures found, 381 crops** (6.6 is printed over two pages, both
  captioned "(Continued)"), **every one cropped; coverage clean**: every
  chapter's captions run 1..N with no gap, every figure `docs/source/book`
  cites was found, and every caption the extracted text holds matches.
- **The caption locator:** a line whose first span is "Figure N.M" in a
  bold face (the space is a no-break space). A sentence citing a figure is
  roman and never matches. 381 such lines, all bold TimesTen.
- **Seven landscape figures** (3.7, 3.12, 3.23, 4.15, 4.18, 10.22, 19.12)
  sit on pages stored portrait with /Rotate 90. They are read in the turned
  frame through the page's rotation matrix; `remove_rotation()` was tried
  and loses the whole text layer of pages 168 and 385.
- **Found in passing, NOT fixed (scripts/extract_book.py's, not the
  reader's):** those seven turned captions are **absent from
  `docs/source/book`**, and 12.12's hyphen is lost ("LittleEndian"). The
  reader reports them; a lesson drafted from those figures has no caption
  text to quote until the extractor reads turned pages.
- **Crops, opened and looked at, all 21 contact sheets.** Fixed on the way:
  the end-of-chapter problems (9 pt, a label's size) inside 2.8 and 11.35,
  an equation number beside 2.4, a page number on a turned page, a figure
  note at 8 pt mistaken for prose (13.7, 14.26). **Left, said here:** the
  short equation over 2.8 is still in its crop; 11.18 holds Table 11.8 (set
  above it on the page) and is flagged `table-inside`; 10.3 and 10.4 have no
  text at all (flagged `no-labels`, correctly).
- **Labels:** every word inside a crop, exactly as the PDF's text layer has
  it (the extractor's invisible-character table), with its position.
- **Chart data, read from the vectors:** axes from the numeric tick labels
  (linear or log, snapped to the tick marks), each stroke as a series, small
  filled marks as points. Four figures read as charts (2.4, 4.22, 4.23,
  18.4). **Checked against formulas, not by eye:** 2.4's four curves lie
  within 0.3% of Amdahl's law for f = 0.95, 0.90, 0.75, 0.5; 4.22's four
  within 0.03 decades of e = 1/(1+(1-H)r) for r = 1, 10, 100, 1000 up to
  H = 0.9 (past it the book's drawing leaves the formula). **Not read:**
  bar charts (16.6's numbers are its key, so it is refused, not misread),
  axes labelled in words or units ("100 bn", years), and 2.2's scatter.
- **Tests:** 16, all green: a synthetic page for every rule (caption,
  citation, header, body, short label, sub-caption, side by side, turned
  page, a linear and a log chart) and the coverage check's planted-error
  canary, **watched red** against a check that checks nothing; then the
  book itself (skipped without the PDF): coverage, chapter 15's fourteen,
  the turned pages, no problem text in 2.8 or 11.35, the two formulas.
- **Not done, moved to B2/B3:** uploading crops and labels to a private,
  owner-only bucket. The bucket is B2's schema; nothing is uploaded yet,
  and the crops live only in a scratch folder outside the repo.

**B2, the schema, built (7 Oct 2026, late).** `db/addendum-assistant.sql`,
applied eleventh, idempotent (applied three times over itself locally).
Seven tables, each with an owning teacher and a course: `assistant_books`
(a PDF by its hash, never the PDF), `assistant_figures` (B1's output; a crop
path must sit in the owner's folder), `assistant_jobs`, `assistant_steps`
(status, engine, model, prompt version, input hash, idempotency key, tokens,
ms, cost), `assistant_briefs` (§4a), `assistant_units` (versioned; §4b) and
`assistant_engine_keys` (sealed bytes and last four), plus the private
`assistant-figures` bucket (Supabase only; PNG, 10 MB; no storage policy, so
the API alone reaches it). **What the database holds, not the API:**

- owner-only, staff-only reads; **no client write anywhere**;
- keys: an explicit deny-all policy (as `assessment_secrets`), so no teacher
  reads a key row, their own included, nor its last four;
- a child row's owner and course are its parent's, by composite foreign keys;
- **a step's key is its own teacher's**: FK `(key_id, owner_id)`, so teacher
  B's job cannot run on teacher A's key, from the API's connection too;
- **an accepted unit is frozen** (`assistant_units_guard`, every role): no
  rewrite, no other column, no delete; born a draft; the body is always what
  its SHA-256 names; one accepted version at a time; `accepted → superseded`
  only once a later version exists, every other column untouched;
- **local Ollama paused**: no step and no job chain may name `ollama_local`.

`services/api/test/assistant-rls.spec.ts`: **48 tests, watched red twice**:
first with no schema (every test blocked, "relation assistant_books does not
exist"), then with the owner clause, the key FK and the freeze broken in the
database (19 red, exactly those); restored, 48 green. A missing table is
refused as a denial (`wasDenied()` alone would count it). Not tested: the
bucket (no storage schema on the local stack, as for chat attachments).

**B1's upload, done (7 Oct 2026; the instructor approved it once, in the
session).** `tools/assistant/upload/upload_figures.py` (`pnpm book:upload
<out dir> --ref <project> --owner <staff uuid>`) runs the reader, then writes
with the service role from the root `.env`: one `assistant_books` row (owner,
course, the PDF's SHA-256 and page count, never the PDF), one
`assistant_figures` row a crop, and each crop at
`<owner_id>/<book_id>/fig-NN-MM.png` in the private bucket. It reads what is
there and writes only the difference. Refuses a URL that does not name
`--ref`, a non-staff owner, an out dir in the repo, unclean coverage.

- **On the deployment:** owner Engr. MJ Butaya (the only staff account, the
  admin), book `41ca1c63-…`, 864 pages: **1 book, 381 figure rows (381 keys,
  4 charts), 381 PNG objects, 25.3 MB; every row's crop exists.** The full
  re-run, reader included, planned "0 to insert, 0 to update, 0 to upload"
  and wrote nothing. Denied: the bucket's public URL (400), no token (400),
  the anon key (object 400, listing and table empty). One crop downloaded
  back: byte-identical, and opened (15.4, the interference graph).
- **The reader is deterministic:** two runs, 381 crops byte-identical, the
  same `figures.json`. That is what makes "a re-run changes nothing" hold.
- 9 tests on `plan()`, the unchanged state as the canary; watched red
  against two planted bugs. `pnpm test:assistant` now 25.

**B3, the engine chain, session 1 of 2 (7 Oct 2026) — RETIRED the same night by round six** (`eb90e63`; the code stays in git at `f1d87d3` as the reference for the app's Python port). What it was:
`services/api/src/assistant/`:

- `engines/core.ts`: the one `draft(step, context)`. Timeout per call
  (120 s), 2 retries for overloaded / unavailable / timeout with backoff
  (a retry-after longer than 30 s counts as out of quota), quota read from
  any `*ratelimit*remaining*` header and `retry-after`, cost from the
  catalogue's price, the step's JSON parsed and checked against its Zod
  schema (a ```json fence is stripped; anything else that fails is
  `malformed`). One error shape (`EngineErrorBody` in
  `@octa/contracts/assistant`); the key is scrubbed from every message.
- Adapters: **Claude** through Anthropic's SDK (0.131; its retries off so the
  core's apply; `claude-opus-5-5`, effort high, server-side fallbacks
  `"default"`, a `refusal` or `max_tokens` ending fails the call); **Groq**
  (OpenAI-compatible, JSON mode, vision through image parts); **Ollama Cloud**
  (`https://ollama.com/api/chat`, never this laptop); **Cloudflare** (the key
  stored as `accountId:apiToken`; text-only here). Each reply checked by a
  Zod contract.
- `engines/catalogue.ts`: default model, vision, price. **Provisional for the
  three free engines** until B0 measures them.
- `chain.ts`: the first engine in the job's order with a key that can see the
  step; failures move on, each kept for the step record; all out of quota →
  `waiting`, saying so, with the shortest retry-after.
- `seal.ts` + `keys.ts`: AES-256-GCM, HKDF from `ASSISTANT_KEY_SECRET` (added
  to the server env, `SERVER_ONLY_SECRETS` and the boot leak check), the
  owner and engine as associated data. `putKey`, `listKeys` (last four and
  date only), `openKeys` (a key that will not open is left out and named).
- `tick.ts`: `POST /internal/assistant/tick`, `x-cron-secret` against
  `CRON_SECRET` (every call refused while it is unset); claims one waiting
  step of a RUNNING job (`for update skip locked`), answers 202, runs it
  after replying; a step past its 15-minute lease is resumed; the job closes
  when its last step settles. **Step handlers are B5's**; until then a
  claimed step fails with `no_handler`.
- `db/addendum-assistant-tick.sql` (twelfth): `assistant_tick()` calls the
  API through `pg_net` only while a job is running, reading `octa_api_url`
  and `octa_cron_secret` from Vault; revoked from every client role;
  scheduled each minute. **On the deployment first** (hard rule 10): job
  scheduled, functions not executable by `authenticated` or `anon`, nothing
  due, invariants 0 failures. Both Vault secrets set; `CRON_SECRET` is in
  the root `.env` and **must be copied to Render** by the instructor.
- **Tests: 28 engine tests on fixtures that follow each provider's
  DOCUMENTED reply shape and are NOT RECORDED** (no key exists), and 17 tick
  and key tests on the local database. Watched red: 6 denials against three
  planted bugs (no associated data, no scrub, any engine name accepted); 4
  against three more (an unset secret accepted, a non-running job claimed,
  execute granted to `authenticated`). `pnpm verify` green, API 996.

**What replaces B3 (round six):** the app (§4-six), after the teacher
accounts (T1, `TEACHERS-AND-SUBJECTS-PLAN.md`): pairing, heartbeats to an
`assistant_devices` table, the locked `/assistant`, the keys in Windows
Credential Manager, the engine chain in Python beside B1's reader, results
handed to the API with their tokens and cost, the token log. Sized when T1
is done.

**B0's keys, for the measurement only:** in the root `.env` (gitignored,
server-side names, never `VITE_*`): `ANTHROPIC_API_KEY`, `OLLAMA_API_KEY`,
`GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`. The
assistant itself will keep teachers' keys sealed in the API (§4-now), not
in `.env`.

## 10. Decisions

**All made, 7 Oct 2026** (the second-round table at the top), and changed
once since: **round five** (v5) paused local Ollama and moved the engine
calls into the API. Left for later, not for now: the separate plan for
OCTA serving several courses and teachers, and the future update that
switches local Ollama on. **Waiting on the instructor:** the four engine
keys for B0 (they now go into the app, not OCTA; B0 can still read them
from the root `.env` for the measurement); and question C of the teachers
plan (one book per subject, or per class). `ASSISTANT_KEY_SECRET` and
`CRON_SECRET` on Render are **no longer needed** (round six).
