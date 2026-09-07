# DELIVERY.md
### Where this ships, on what branch, on whose free tier, and what "alpha" means

`PHASES.md` says what gets built in what order. **This file says where it lands.**

---

## 0. Live coordinates

| Thing | Value |
|---|---|
| **Repository** | https://github.com/Shaloh69/Octalysis---A-new-way-of-Learning |
| **Branch** | **`main`**, and only `main`. See §1.1 |
| **Supabase project** | `lqvkqdaqtkhxmnvodmyr` · https://lqvkqdaqtkhxmnvodmyr.supabase.co |
| **Supabase region** | `ap-northeast-1` (Tokyo) — closest free region to the Philippines |
| **Supabase compute** | NANO (free), 60 max connections |
| **Pooler host** | `aws-0-ap-northeast-1.pooler.supabase.com` — verified; `aws-1-…` returns "tenant not found" |
| **Schema status** | **Applied and verified live** — 19 stages, 18 edges, 0 failing invariants |
| **Denial suite vs Supabase** | **38/38 pass** against the live project |
| Vercel / Render | Not yet created |

```bash
pnpm db:push:check    # connect, confirm it is Supabase, report state, change nothing
pnpm db:push          # apply schema.sql + the two addenda (never local-bootstrap.sql)
pnpm db:push:reset    # drop the public schema first, then apply

# run the denial suite against Supabase instead of local Docker:
DATABASE_URL="$SUPABASE_DB_SESSION" pnpm test:rls
```

`db-push-supabase.mjs` has three guards: it refuses the transaction pooler (`:6543` cannot run DDL
reliably — use session mode on `:5432`), it refuses to run if `auth.users` is absent (that would
mean it is pointed at a local database needing the four-file order), and it hard-refuses to load
`local-bootstrap.sql` at all.

### 0.1 Supabase setup checklist — do these before applying the schema

Two of these are settings visible in the project-creation screen, and one of them Supabase itself
recommends changing:

- [ ] **Turn OFF "Automatically expose new tables."** Supabase's own UI says *"We recommend
      disabling this to control access manually."* It is on by default. With it on, a table added
      later is granted to the Data API roles automatically — which is precisely the mistake
      `schema.sql` spends a `revoke all … from anon` undoing. Turn it off and grant deliberately.
- [ ] **Leave "Enable Data API" ON.** The student app reads unlocked content through supabase-js,
      and RLS is what protects it. Turning it off would push every read through the API service
      for no security gain.
- [ ] **Disable public signup.** Registration is roster-gated through `/auth/register`; public
      signup would let anyone create an account.
- [ ] **Enable email enumeration protection**, set the Site URL, and remove default wildcard
      redirect entries.
- [ ] **Do NOT apply `db/local-bootstrap.sql`.** Supabase already provides the `auth` schema,
      `auth.uid()`, and the three roles. Applying it there shadows the real ones and every RLS test
      silently becomes meaningless. Apply files 1–3 only.
- [ ] **Confirm the dashboard shows "LAST BACKUP: No backups."** It will. That is the free tier, it
      is expected, and it is why the `pg_dump` plan in §2.2 is not optional (V-26.2).
- [ ] Run the **Security Advisor** after applying the schema.

### 0.2 Rotate the database password — outstanding

The database password was pasted into a chat transcript. It works, and it is currently in `.env`
(gitignored, verified not tracked, and confirmed absent from every commit). **It should still be
rotated**, because a credential written into a transcript, a log, or a screenshot is no longer a
secret regardless of where else it is stored.

**Project Settings → Database → Reset database password**, then update the three
`SUPABASE_DB_*` lines in `.env`. Nothing else reads it.

The same applies to the `service_role` key once it is added: it bypasses RLS entirely, so it is the
single most dangerous string in the project. It belongs in `.env` and in Render's environment, and
nowhere else — never in a message, never in a screenshot, never under a client-inlined prefix.

---

> **Status update.** Two things in this file have changed since it was written, both by decision:
>
> 1. **The repository will be one the user creates**, not the existing course repo. §1 below is
>    retained because the old repo is still the app OCTA replaces, and the `lessonData.js`
>    deletion is still worth doing as evidence — but on a fresh repo the branch is simply the
>    working branch. **That branch is now `main`** — see §1.1 for why it stopped being
>    `shaloh-build`.
> 2. **There are no cloud projects, and none are needed yet.** "Production" runs locally in
>    Docker — see §2.0. The same `db/schema.sql`, the same policies, and the same denial suite
>    that will run on Supabase run here first. This is not a mock; it is the real schema on real
>    Postgres.

## 1. The repository

**https://github.com/CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-**

This is not a new repo — **it is the app OCTA replaces.** Verified contents of `master`:

| Fact | Value |
|---|---|
| Default branch | `master` |
| Stack | React (JSX) + Vite, Supabase optional with a **localStorage fallback** |
| Deployment | Vercel-ready |
| Structure | `src/`, `supabase/`, `index.html`, `package.json`, `vite.config.js` at root |
| **`src/data/lessonData.js`** | **Present.** Lesson content for two topics, shipped to the browser |

Two hard rules are violated by `master` as it stands today, which is the entire reason this
project exists:

- **Rule 1** — `lessonData.js` ships lesson content, and in the original build the answer keys with
  it, into the client bundle.
- **`localStorage` for anything gradeable** — explicitly on the do-not-add list in `CLAUDE.md`.

**Do not treat `master` as a starting point to refactor.** OCTA is a rebuild with a different
architecture (pnpm monorepo, server-side grading, RLS). The old tree and the new tree share no
files.

### 1.1 The branch is `main`, and this was learned the hard way

**Work on `main`. Push to `main`. There is no second branch.**

For eighteen commits the work lived on `shaloh-build` while `main` sat at the P0
skeleton — 70 files, where `apps/web` contained one `CLAUDE.md` and nothing
else. That was fine right up to the moment anything outside this repository had
an opinion, and then it cost an hour:

- **Render's new-service form defaulted to `main`.** Caught before deploying.
- **Vercel cloned `main` and built it.** No `package.json`, no `vercel.json`, so
  it fell through to the Vite preset's `vite build` and died with
  `vite: command not found`, exit 127, in two seconds. The log named the branch
  on line two and the error on line eleven, and only the error looked relevant.

Every host defaults to `main`. A default branch that does not build is a trap
that arms itself once and fires on every service you ever connect. `main` was
fast-forwarded to `shaloh-build` (a clean ancestor, no merge commit) and
`shaloh-build` was deleted on both ends.

The original plan below cut the branch from the old repo's `master`. It is kept
because the reasoning about the `lessonData.js` deletion still holds:

```bash
git clone https://github.com/CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-.git octa
cd octa
git checkout -b octa-rebuild master   # historical; the work now lives on main
```

**Why from `master` rather than `--orphan`:** the first commits on this branch delete
`src/data/lessonData.js` and the localStorage progress path. That deletion, with a commit message
explaining *why*, is the single most useful artifact in the repository for a thesis defence — it is
the before-and-after of the security fix, in the history, with a diff. An orphan branch throws that
evidence away to save a little tidiness.

`CLAUDE.md` already says it: *"Conventional commits, small and frequent. The commit history is
project evidence."* This is what that rule is for.

**Suggested first three commits, in order:**

1. `docs: add OCTA planning bundle` — the `docs/`, `db/`, `packages/tokens/` material as it stands
2. `feat!: remove client-side lesson data and localStorage grading path` — deletes
   `src/data/lessonData.js` and the old progress store. **Body explains the vulnerability.**
3. `chore: scaffold pnpm monorepo` — `apps/`, `services/`, `packages/`, workspace config

The old `src/` and `index.html` come out in commit 3, not commit 1 — so that anyone reading the
history sees the old app, then sees the specific security deletion, then sees the replacement.

### 1.2 What is blocked — resolved

Both git blockers are cleared. The working directory is a repository, `origin` points at
`Shaloh69/Octalysis---A-new-way-of-Learning`, and everything is on `main`.
Credentials were already cached, so `gh auth login` was never needed — note that
`gh` itself is **not** authenticated, so anything needing the GitHub API (default-branch
checks, release automation) needs `gh auth login` first.

What remains blocked, and on what:

| Blocked | Needs |
|---|---|
| Real email/password sign-in | Supabase Auth settings configured (§0.1), plus the anon + service-role keys in `.env` |
| Deployed URLs, keep-alive, cold-start measurement | Vercel and Render projects, which need `apps/web` to exist first (P2) |
| Bundle scan against a real build | `apps/web` to exist (P2) |

---

## 2.0 Running production locally — what exists today

No Supabase, Vercel, or Render project is required to develop, test, or verify OCTA. The full data
tier runs in Docker, and the security model is exercised against it exactly as it will be in
production.

```bash
pnpm install
pnpm db:up          # Postgres 16 in Docker on :54329
pnpm db:reset       # drop, recreate, apply all four SQL files, run invariants
pnpm test:rls       # the denial suite
pnpm verify         # typecheck + all tests + invariants
```

**What makes this equivalent rather than approximate:**

| Concern | How it is handled locally |
|---|---|
| `auth.users`, `auth.uid()` | `db/local-bootstrap.sql` supplies the schema shim Supabase would provide. **Applied only locally** — never against a Supabase project, where it would shadow the real one |
| The three roles | `anon`, `authenticated`, `service_role` created with the same privileges Supabase grants, including `BYPASSRLS` on `service_role` |
| JWT claims | The harness sets `request.jwt.claims` with `set_config(..., true)` — the same GUC PostgREST populates per request, and the one `auth.uid()` and `jwt_role()` read |
| RLS actually applying | Tests `SET LOCAL ROLE` to `authenticated`/`anon`, so the current role is neither superuser nor table owner. Querying as `postgres` would silently bypass every policy |
| Proof the harness is real | `assertIdentity()` asserts `current_user`, `auth.uid()` and `jwt_role()` agree **before** any denial test runs, and throws if not |

**Verified on Postgres 16:** all four SQL files apply from scratch · `run_invariants()` returns 22
clean, 0 failures · **38/38 denial tests pass** · TypeScript strict clean across the workspace.

**And the denial tests were watched failing first.** Three policies were deliberately sabotaged in
the running database; six tests went red, each mapping to its break — including the one asserting
the literal answer string never appears in a response body. See `VERIFICATION.md`, fourth pass.

### What still needs a cloud account, and when

| Needed for | Blocked until |
|---|---|
| Real email/password auth (GoTrue) | A Supabase project exists — or `supabase start` is used locally, which runs the full stack including GoTrue and PostgREST |
| Deployed URLs, the keep-alive, the 7-day-pause behaviour | Supabase + Render projects exist |
| Bundle scan against a real build | `apps/web` exists (P2) |

None of these block P0 through P3. **The question engine can be built and fully tested against the
local stack.**

---

## 2. Hosting — everything on free tiers (when cloud projects exist)

**Confirmed constraint: Vercel Hobby, Render Free, Supabase Free. No paid plan anywhere.**

```
  Vercel Hobby (project 1)        Vercel Hobby (project 2)
  octa-web                        octa-console
  public + student                teacher + admin
        │                                │
        └──────────── Bearer JWT ────────┘
                       │
              Render Free (1 web service)
              octa-api  ·  Fastify  ·  /healthz
              spins down at 15 min · ~60s cold start
                       │
              service_role (server only)
                       │
              Supabase Free (1 project)
              Postgres + RLS + Auth + Storage
              pg_cron + pg_net  ←  ALL SCHEDULED WORK
```

### 2.1 What the free tiers actually give you

| Platform | Relevant limits |
|---|---|
| **Vercel Hobby** | Non-commercial personal use only · 100 GB bandwidth/month · **no password protection on preview deployments** (Pro feature) |
| **Render Free** | Web services + static sites + Postgres + KV **only — no cron jobs, no background workers** · spins down after 15 min idle · ~1 min cold start · 750 instance-hours/month per workspace · ephemeral filesystem · no shell · single instance, no scaling |
| **Supabase Free** | 500 MB database · 500 MB RAM · 1 GB file storage · 5 GB egress · 50,000 MAU · **max 2 active projects** · **paused after 7 days with no API requests** · **no automatic backups** (daily backups and PITR are Pro) |

Full analysis and the consequences for four exit criteria: **`VERIFICATION.md` V-26.**

### 2.2 The scheduler moves into Postgres

Render Free has no cron, so every scheduled job in the plan moves to **Supabase Cron
(`pg_cron` + `pg_net`)**, which is available on the free tier.

| Job | Was | Now | Type |
|---|---|---|---|
| Scheduled stage unlocks | Render Cron `*/5` | `pg_cron` | pure SQL |
| Nightly `item_stats` recompute | Render Cron | `pg_cron` calling a Postgres function | pure SQL |
| Nightly invariant run | Render Cron | `pg_cron` → `run_invariants()` → `audit_runs` | pure SQL |
| Keep-alive ping to `/healthz` | Render Cron | `pg_cron` + `pg_net` HTTP GET | outbound HTTP |

**Three of these four are better in Postgres than they ever were on Render** — they run where the
data is, with no network hop and no service to keep awake.

**Do not use GitHub Actions as the scheduler.** 2,000 free minutes/month on private repos versus
~4,300 minutes for a 10-minute cadence, scheduled workflows auto-disabled after ~60 days of repo
inactivity, and known-unreliable cron firing on private repos.

### 2.3 The two free-tier risks that need a decision in P0

1. **Supabase pauses after 7 days of no API requests.** A long weekend plus a holiday reaches that.
   The `pg_cron` heartbeat *may* count as activity — **verify it in a scratch project with a
   deliberately quiet week; do not assume it.** If internal cron does not count, an external pinger
   is required.
2. **There are no backups.** P10's "restore from backup, rehearsed" cannot be met as written. The
   replacement is a scheduled `pg_dump` to Storage plus **one rehearsed restore into local Postgres
   before launch.** A dump you have never restored is a guess, and that reasoning does not change
   just because the vendor stopped providing the dump.

---

## 3. The alpha release

**Definition, as set by the user:** *not all topics are implemented, **but the skill tree is
complete.***

That is a good milestone because it is honest about content and uncompromising about the thing that
carries the demo.

### 3.1 What "the skill tree is complete" has to mean

Complete means complete in **data and behaviour**, not just pixels. All of the following, or it is
not done:

- [ ] **All 19 nodes present** — Stage 00 through 18, from `stages`, none hard-coded
- [ ] **All 18 edges drawn** from `stages.prereq` — one linear chain, `00 → 01 → … → 18`
- [ ] **Four node states** render correctly: locked / available / in progress / mastered
- [ ] **Every lock states its reason and the distance** — *"Unlocks when Stage 09 reaches 70%.
      You're at 45%."* (`DESIGN-MANDATE.md` §1)
- [ ] **Lock state comes from `is_stage_unlocked()`**, never computed in the browser (hard rule 4)
- [ ] **Teacher can override any node** from the lock matrix, and the map reflects it on reload
- [ ] **Read-only preview** of the next stage's objectives (Petal 6, scarcity with autonomy)
- [ ] **Keyboard-only operable**, focus order = curriculum order
- [ ] **380px**, three themes at AA, `prefers-reduced-motion` honoured
- [ ] **Works with WebGL disabled** — the DOM layer is the source of truth (`SKILL-TREE-3D.md` §4)
- [ ] **INV-32 and INV-33 pass** — no invented nodes, no invented or missing edges
      · **They exist now.** This gate cited them by name for days while the
        invariant set stopped at INV-31, so it could be neither passed nor
        failed. `INV-32` fails on a published stage unreachable from any root
        (a planet floating outside the system); `INV-33` fails on a prereq
        pointing at an *unpublished* stage — which INV-19 passes, because the
        row exists — or on a stage listing itself. Both `fail` severity.

### 3.2 Alpha scope

**This scope was widened during the build.** What actually shipped is below; the narrower plan it
replaced is recorded in §3.5, because the difference is the useful part.

| In | Out |
|---|---|
| Auth: roster import, ID + email + password | Stage prose for chapters **08–18** |
| **The complete skill tree, both layers** | Simulators (FDE stepper, cache, pipeline, microcode) |
| Stage content for **00–07** | The 70-item Power-On Self Test |
| Per-stage Self-Test, the generator, and grading | The five themed encounter *components* |
| Teacher console: 11 routes, roster + lock matrix | `/console/analytics`, `/console/settings` |
| Submissions: labs, the project, late marking | Audio |
| Lecture Mode and the projector view | Off-site backups |
| Feedback, the SUS survey, item psychometrics | |
| Depth Gauge, competency grid (sparse but real) | |
| The 38-test denial suite green | |

**What the alpha must not do:** be used for a real grade. Mastery numbers over seven stages and a
starter bank are not psychometrically meaningful, and `item_stats` will not have the ≥30 exposures
that make a p-value mean anything. Say so on the page.

**Chapters 08–18 are a declared future update, not a gap.** Each of those eleven stage files
carries its **verbatim syllabus objectives** and topic outline — `pnpm check:objectives` gates all
110 against the DOCX — plus a `kind="planned"` callout that says so in the student's own reading
view. Hard rule 5 forbids inventing course content, and a chapter of plausible paragraphs nobody
had checked against Stallings would be **worse than an honest gap**: a student cannot tell the
difference, and would revise from it.

Those stage nodes still exist, still lock and unlock, still carry objectives. It is the prose that
is pending, and the page says which.

### 3.3 Phase mapping, and the one re-ordering this forces

Alpha ≈ **P0 → P1 → P2 → P3 → P4 (partial) + the map**.

The complication: `SKILL-TREE-3D.md` §8 puts the 3D galaxy in **P9**, deliberately, because it is
the highest-risk lowest-necessity component in the app. An alpha whose headline is the skill tree
pulls it forward to roughly P4.

**This is a real trade and it should be made consciously:**

- **The 2D map is not negotiable and is already P2.** It is the canonical layer, it satisfies every
  requirement in §3.1, and it is what "complete" is measured against.
- **The 3D galaxy is what makes the alpha a demo rather than a screenshot.** If the alpha exists to
  be shown to the instructor or a panel, the galaxy earns its place early.
- **The cost is that 3D work happens before the question engine is finished**, and the question
  engine is what the project is actually for. `START-HERE.md` §6 is blunt about this: *"Start with
  P0 and P3. Everything else is scaffolding around the question engine."*

**Recommendation:** ship the alpha with the **complete 2D map** and treat the galaxy as a
**stretch item within the alpha**, built only after P3's engine tests are green. If P3 runs long,
the alpha ships with a complete, accessible, honest 2D skill tree and loses nothing that meets the
§3.1 definition of complete.

### 3.4 Alpha exit criteria

- [ ] Every box in §3.1 ticked
- [ ] The six P0 denial tests pass, **and were seen failing first**
- [ ] V-15, V-16, V-19, V-25 applied (`VERIFICATION.md` third pass) — the blocking schema findings
- [ ] `run_invariants()` returns zero `fail`-severity rows on the deployed database
- [ ] Deployed: two Vercel projects, one Render service, one Supabase project — all free tier
- [ ] `pg_cron` heartbeat live, and the 7-day pause behaviour actually observed
- [ ] A student account can complete Stages 00–07 end to end, keyboard-only, at 380px
- [ ] Bundle scan finds zero answer strings in either client bundle
- [ ] `main` pushed, with the `lessonData.js` deletion commit in the history

### 3.5 What changed from the original alpha scope, and why

The table in §3.2 used to end at chapter 05 and put the feedback system, Lecture Mode and item
psychometrics **out** of scope. All three shipped anyway, and two content chapters were added.

The reason is that the cut line moved from *"how much"* to *"how verifiable"*. Everything that
could be **proven** — a denial test, a computed contrast ratio, a quote checked against the
extracted book, an invariant — went in, because that work is cheap to trust later. Everything
whose correctness rests on someone having read it carefully once — eleven more chapters of prose,
eight simulators — was held back rather than shipped unverified.

That is also why the two remaining console routes are the ones they are: `/analytics` cannot say
anything true until items have ≥30 exposures, and `/settings` would only wrap environment
variables in a form.

---

## 4. How new work gets built

Everything from here follows the loop in `CLAUDE-CODE-PRACTICES.md` and the four templates in
`PROMPT-LIBRARY.md` §1, which align with Anthropic's published guidance for agentic coding:

> **Explore → Plan → Code → Commit.** Research and planning are separated from implementation,
> because without them the model jumps straight to a solution — and on this project the wrong
> solution is a security bug, not a wasted afternoon.

Three points from that guidance that bite hardest here:

1. **Separate research from implementation.** Use plan mode. The kickstart prompt in
   `START-HERE.md` §5 is this idea applied once, at the start; do it again at every phase boundary.
2. **Start from a clean git state and commit checkpoints often**, so a bad direction is one
   `git revert` away. This matters more than usual here — `main` is the only branch, so there
   is no other copy and nothing to fall back to.
3. **`CLAUDE.md` is persistent memory and is kept in context.** When a rule gets discovered the
   hard way, it goes in `CLAUDE.md`, not in a comment nobody reloads.

**One phase per session. `/clear` between phases.** Context fills fast and quality degrades as it
does — this is the constraint every other practice follows from.

Sources: [Claude Code best practices](https://code.claude.com/docs/en/best-practices) ·
[Anthropic engineering: agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
