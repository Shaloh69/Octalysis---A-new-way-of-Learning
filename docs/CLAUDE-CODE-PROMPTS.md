# OCTALYSIS — Claude Code Prompt Pack

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

How to actually get this built without Claude Code drifting, inventing course content, or
producing a nice-looking app with no working question engine.

---

## Part 1 — `CLAUDE.md`

Put this at the repo root of **both** `octa-web` and `octa-api`. Claude Code reads it every
session. It is the single highest-leverage file in the project.

````markdown
# OCTA — project context

## What this is
Semester-long interactive learning platform for Computer Systems & Assembly Language
(BS Computer Engineering, Stage 00 plus 18 graded stages). Every student receives a structurally
unique but psychometrically equivalent question paper.

## Repos
- `octa-web`  — Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui. Deploys to Vercel.
- `octa-api`  — Node 20 + Fastify + TypeScript. Deploys to Render.
- Database    — Supabase Postgres. Schema in `octa-api/db/schema.sql`. RLS is ON everywhere.

## Absolute rules
1. **Never ship an answer key to the browser.** Answer keys live in `attempt_items.correct_value`
   and are RLS-denied until `attempts.status='submitted'`. All grading happens in octa-api.
2. **Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable.** Vite inlines those into
   the bundle.
3. **Never invent course content.** Stage prose, figures, and item stems come from
   `/content/*.md` (authored by the instructor) or the database. If content is missing, stop
   and say so — do not write plausible-sounding lecture text.
4. **Never decide a stage lock client-side.** Call `is_stage_unlocked()`. The client may render
   a lock icon; it may not compute one.
5. `responses` is append-only. There are DB triggers enforcing this. Don't try to UPDATE it.
6. Items are versioned. Editing a live item creates a new version; it never mutates in place.

## Conventions
- TypeScript strict. No `any` without a `// why:` comment.
- Zod schemas for every API boundary, shared via `packages/contracts`.
- Server errors: `{ error: { code, message } }`. Never leak stack traces or SQL.
- Tests: Vitest. Every question-engine function needs a test. UI does not.
- Commits: conventional (`feat:`, `fix:`, `chore:`). Small and frequent.

## Design tokens (do not improvise colors)
Themes: `bare-metal` (default), `blueprint`, `phosphor`. Defined in `src/styles/themes.css`
as CSS custom properties. Components reference `var(--surface)`, `var(--ink)`, `var(--accent)` —
never a literal hex.
Type: display `Space Grotesk`, body `Inter`, mono `JetBrains Mono`.
**All numbers, register values, hex, machine code, and assembly listings render in mono.**
Motion: one orchestrated moment per stage. Respect `prefers-reduced-motion`.

## Definition of done
A task is done when: it compiles under strict TS, its tests pass, RLS was considered and
stated, and it works keyboard-only. Say which of these you verified and which you didn't.
````

---

## Part 2 — Phase prompts

> **NUMBERING WARNING — this section predates `PHASES.md`.**
>
> The phase numbers below stop at P7 and do **not** match the authoritative list.
> `docs/PHASES.md` is authoritative (P0–P10). Where they disagree:
>
> | Here | Actually |
> |---|---|
> | P5 Item analytics | **P7** in PHASES.md |
> | P6 Simulators | **P6** — agrees |
> | P7 Themes, audio, polish | **P9** in PHASES.md |
> | — | **P5** is Stages 06–11, which has no prompt here |
> | — | **P8** Feedback and **P10** Pilot/launch have no prompts here |
>
> Use the prompts below for their *content*, and take the phase number and the exit
> criteria from `PHASES.md`. A contradiction between two documents is worse than an
> error in one, because an agent reading both picks a side silently.

Run these in order. **One phase per session.** Start each with `/clear`.

---

### P0 — Foundation

```
Read CLAUDE.md and db/schema.sql in full before writing anything.

Set up the octa-api repo:
- Fastify + TypeScript strict, Node 20
- @supabase/supabase-js with the service role key from env (server-side only)
- Zod-validated env loading that fails fast on boot with a clear message naming the
  missing var
- /healthz returning { ok, version, db: 'up'|'down' }
- Vitest configured
- A db/reset.ts script that drops, recreates, and seeds from schema.sql

Then write RLS tests in test/rls.spec.ts proving:
1. A student cannot SELECT from `items` at all
2. A student cannot SELECT attempt_items.correct_value while status='in_progress'
3. The same student CAN after status='submitted'
4. A student cannot UPDATE their own profiles.role
5. A student cannot SELECT content_blocks for a locked stage

Do not build any feature endpoints yet. Show me the failing-then-passing test output.
```

---

### P1 — Auth

```
Implement roster-gated registration. Read the "Authentication" section of
docs/MASTER-PLAN.md first.

Endpoints in src/routes/auth.ts:

POST /api/v1/auth/register  { student_id, email, password, full_name? }
  - look up student_id in student_directory
  - 403 if not found or status='claimed' — use the SAME generic message for both
    ("We couldn't verify that ID"), no enumeration
  - create the Supabase auth user via admin API
  - set app_metadata { role: 'student', student_id }
  - insert profiles row, mark directory row claimed
  - transactional: if the profiles insert fails, delete the auth user

POST /api/v1/auth/resolve   { identifier }
  - if it looks like an email, echo it back
  - else look up student_id -> email
  - rate limit 5/min/IP, always 200 with a generic shape so the endpoint can't be
    used to enumerate enrolled IDs

POST /api/v1/console/roster/import  (teacher only)
  - CSV: student_id,full_name,section_code
  - dryRun:true returns a diff (new / existing / conflicting) without writing
  - writes to audit_log

Tests: duplicate ID claim, unknown ID, dry-run produces no rows, rate limiter trips at 6.
```

---

### P2 — Content

```
Build the content pipeline. Content is authored as markdown in /content/stages/NN.md
with frontmatter, and synced INTO content_blocks — the database is the runtime source
of truth, the markdown is the authoring source of truth.

1. Write scripts/sync-content.ts: parses /content/stages/*.md, splits on ## headings
   into content_blocks rows (kind inferred from a fenced-block annotation), bumps
   version on change, and is idempotent.

2. Seed /content/stages/01.md through 05.md from docs/source/day1-deck.md.
   Use the deck text VERBATIM for definitions and figures — this is the instructor's
   material, not yours to rewrite. You may add heading structure and callouts.
   Figures 1.1-1.4 become kind='code' blocks with the original listings intact.

3. In octa-web, build the stage reader: fetches content_blocks for an unlocked stage,
   renders markdown, and shows a lock screen with the prerequisite names when locked.

Do not build the question engine in this session.
```

---

### P3 — The question engine (the important one)

```
Read docs/MASTER-PLAN.md section 3 in full. This is the core of the product; take it
slowly and write tests first.

Build src/engine/ in octa-api:

1. seed.ts        — deterministic PRNG. seed = sha256(student_id|stage|attempt_no|exam_salt).
                    Use a splitmix64 or xoshiro; NOT Math.random. Export shuffle(), pick(),
                    pickN() that all consume the same stream in a defined order so a seed
                    always reproduces a paper byte-for-byte.

2. solvers.ts     — a registry: Record<string, (params) => { correct, distractors, rationale }>.
                    Implement these four to start:
                      cycle-time        1000/f_MHz ns
                      unit-convert      between K/M/G/T and 2^10/2^20/2^30/2^40
                      twos-complement   n-bit representation + overflow detection
                      amat              hit_time + miss_rate * miss_penalty
                    Every distractor must come from a REAL student misconception
                    (wrong unit scale, inverted ratio, off-by-one bit width) — never a
                    random number near the answer.

3. resolve.ts     — takes an item row + seed -> a resolved instance:
                    { stem, options[], correct_value, rationale }.
                    Type S: pickN(3) distractors from pool, shuffle with correct.
                    Type P: draw params from schema, call solver.
                    Type G: sample and shuffle from the structural spec.

4. blueprint.ts   — fills a blueprint from the live item bank. Must satisfy every
                    constraint cell or throw a BlueprintUnsatisfiable error naming which
                    cell it couldn't fill and how short it was. Never silently under-fill.

5. grade.ts       — server-side. Numeric answers use item.tolerance. Returns
                    { is_correct, points, rationale }.

Tests (write these first):
- same seed -> identical paper, 100 runs
- different student_id -> <15% item overlap across 1000 simulated pairs
- every generated paper satisfies its blueprint's constraint cells exactly
- no resolved instance ever contains the string 'correct_value' in what the API returns
  to a student
- cycle-time solver: 133 MHz -> 7.52 ns (this is the worked example from the source deck)

Then wire the three attempt endpoints. Strip correct_value in a single serializer function
used by every student-facing route — not ad hoc per endpoint.
```

---

### P4 — Console v1

```
Scaffold the teacher console from the shadcn-admin template
(github.com/satnaing/shadcn-admin — Vite + React + TS + shadcn/ui, MIT).

- Clone it into apps/console, strip the demo pages, keep: layout shell, sidebar,
  command palette, data table, theme provider, auth guard.
- Replace its color tokens with our three themes from src/styles/themes.css.
  Do NOT keep its default slate/blue palette.

Build four pages:
1. /console/roster        — TanStack Table, CSV import with dry-run preview modal
2. /console/students/:id  — every attempt; expand a row to see the exact variant that
                            student saw (regenerate from their stored seed), their answer,
                            the correct answer, and time on item
3. /console/locks         — students x stages matrix. Click toggles. Shift-click bulk.
                            Three cell states: auto / manually unlocked / manually locked.
                            Every toggle opens a small reason prompt and writes audit_log.
4. /console/gradebook     — per-stage mastery + final score, CSV export

Route guard reads role from the JWT app_metadata, not from the profiles table.
```

---

### P5 — Item analytics

```
Build the psychometrics. This is what makes 70 unique papers defensible.

1. Supabase Cron job via pg_cron (nightly) recomputing item_stats.
   NOT a Render Cron -- Render's free tier has no cron jobs. Write it as a
   Postgres function and schedule it with pg_cron; see docs/DELIVERY.md 2.2.
   - p_value = n_correct / n_exposures
   - discrimination = point-biserial correlation between item score and total score
   - distractor_hist = counts per option
   - variant_drift (type P only): bucket resolved_params into quintiles, p_value per bucket,
     store the spread

2. Auto-flag after >= 30 exposures when: p_value < 0.20, p_value > 0.95,
   discrimination < 0.20, a distractor chosen by 0% of students, or variant_drift
   spread > 0.25.

3. /console/items — bank browser with the stats inline, a review queue of flagged items,
   and a "preview instance" panel with a re-roll button so I can see what students
   actually get.

4. /console/items/:id/edit — editing a LIVE item creates version+1 and retires the old
   version. Stats do not carry over. Make this explicit in the UI with a confirmation
   that says so.
```

---

### P6 — Simulators

```
Three interactive components in octa-web. Build them one at a time; do not start the
second until I've reviewed the first.

1. FDE stepper (stage 12 — Processor Structure and Function)
   Register Bar (PC, IR, MAR, MBR, ACC) as live mono hex. Step / play / reset.
   Students can also author a short instruction sequence and watch it execute.
   Mirrors the ALU1-ALU4 progression in the source deck exactly.

2. x86-16 interpreter (stage 15) — SUPERSEDED, see docs/PROMPT-LIBRARY.md §4
   TASM x86-16, ~35 instructions plus INT 21h. NOT MARIE.
   Two-pass assembler, symbol table, memory view, breakpoints.
   Assembly errors point at the line and say what's wrong in plain language.

3. Cache simulator (stage 16)
   Sliders: cache size, block size, associativity, miss penalty.
   Live hit-ratio and AMAT readout against a sample address trace.
   This is Petal 3's "what-if sliders" — the sliders ARE the lesson.

All three: keyboard operable, reduced-motion safe, and they must work at 380px wide.
```

---

### P7 — Themes, audio, polish

```
1. Themes: implement bare-metal / blueprint / phosphor as CSS custom property sets.
   Verify WCAG AA contrast on all three with an automated check in CI.

2. Audio via howler.js:
   - one sprite per channel (ui, feedback, event, sim, ambient)
   - ambient defaults to 0 volume, ui/feedback to 0.4
   - preload on first user gesture only (autoplay policy)
   - ambient ducks to 20% during feedback sounds
   - persist to profiles.audio_prefs
   - the incorrect-answer sound is a NEUTRAL low tick. Not a buzzer. This is a
     deliberate motivation-design decision, do not "improve" it.
   Assets: Kenney CC0 packs in /public/audio/. Write /public/audio/CREDITS.md listing
   each file's source and license even where CC0 doesn't require it.

3. Accessibility pass: keyboard-only run through one full stage, visible focus rings,
   aria-live on answer feedback, tap-to-select fallback for every drag interaction.

4. Register Bar: implement as a persistent top strip on every stage. Idle pulse in
   stages 00-11, live in 12-15, question-index-as-PC during assessments.
```

---

## Part 3 — Prompting rules that actually matter here

**Give it the schema before the feature.** The failure mode on a project this size is Claude
Code inventing a table that half-overlaps one you already have. Paste or reference
`schema.sql` at the start of any data-touching session.

**One vertical slice per session, then `/clear`.** "Build the question engine" works. "Build the
app" produces a demo. Context rot is real past ~50 exchanges.

**State the done-criteria in the prompt.** Every phase prompt above ends with something
checkable. Without it you get code that compiles and doesn't work.

**Make it write the test first for anything with a correct answer.** The seeded generator and
the solvers are the two places where a subtle bug becomes a grading incident affecting real
students. Tests are not optional there.

**Forbid content invention explicitly and repeatedly.** An LLM asked to build a lecture app
will cheerfully write lecture content. Yours has to come from the actual course material, or
your instructor will find paraphrased-and-slightly-wrong definitions in week 6.

**Ask for the diff, not the file.** On a big codebase, "show me what changed and why" catches
drift that a wall of regenerated code hides.

**Ask what it didn't verify.** End sessions with "which parts of this did you actually run, and
what are you unsure about?" The honest answer is usually the most useful output of the session.
