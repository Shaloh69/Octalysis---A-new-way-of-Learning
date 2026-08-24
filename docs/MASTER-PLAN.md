# OCTALYSIS — Master Build Plan
### Computer Systems & Assembly Language · Interactive Learning Platform
**Stack:** Vite + React + TS (Vercel) · Node API (Render) · Supabase (Postgres + Auth + Storage)
**Replaces:** `Computer-Systems-Interactive-Lecture-Companion-` (full rebuild, content preserved)

---

## 0. Before anything else — two decisions to make

**0.1 — The name.** "Octalysis" is Yu-kai Chou's trademarked framework name. Using it as
your app's public name is a real (if small) risk if this ever goes past your class. Two
options:

- **Keep `Octalysis`** as the internal codename and thesis title — totally fine academically.
- **Ship as `OCTA`** — reads as *octal* (base-8, a CpE concept the course actually teaches)
  and as *8 core drives*. Credit the framework in the About page: "Motivation design based on
  the Octalysis Framework by Yu-kai Chou." You get the pun, the citation, and no legal edge.

This plan uses **OCTA** in UI copy and `octalysis` in code/repo names. Swap if you disagree.

**0.2 — Render's free tier spins down after ~15 min idle.** Cold start is 30–60 seconds. If
your grading API is asleep when a lecturer starts Lecture Mode in front of 40 students, the app
looks broken.

**Decided: everything stays on free tiers** — Vercel Hobby, Render Free, Supabase Free. That makes
this a constraint to design around rather than a budget line, and it changes the fix:

- **Render Free has no cron jobs at all** (web services, static sites, Postgres and KV only). The
  keep-alive cannot live on Render. It becomes a **`pg_cron` + `pg_net` GET to `/healthz` from
  Supabase**, which is free on every plan.
- Same move for scheduled unlocks, the nightly `item_stats` recompute, and the nightly invariant
  run. Three of those four are *better* in Postgres — they run where the data is.
- Free instances also carry an ephemeral filesystem, no shell, a single instance with no scaling,
  and 750 instance-hours/month per workspace (keeping one service awake 24/7 uses ~730 of them).

**Supabase Free has no backups and pauses a project after 7 days without API requests.** Both need
a plan, not a hope. Full analysis in `VERIFICATION.md` V-26; the deployment topology and the
schedule replacements are in `DELIVERY.md` §2.

---

## 1. What the platform is

A **semester-long** (14-week) interactive companion for Computer Systems & Assembly Language,
where:

- Every student receives a **structurally different but psychometrically equivalent** set of
  questions — different numbers, different distractors, different order.
- Progress is gated by **stages** that the teacher controls globally, per-section, and
  per-student.
- The teacher gets a real console: roster, live class view, per-item analytics, lock matrix,
  question authoring, gradebook export.
- Motivation design follows the Octalysis dial you set: heavy White Hat (Drives 1–3), moderate
  Ownership/Social (4–5), light and always opt-in Black Hat (6–8).

---

## 2. Curriculum — 14 weeks, Stage 00 plus 17 graded stages

Built from your two decks, then extended. **Deck coverage is exact** — nothing from your source
material is dropped.

### Act I — Languages & Abstraction (Weeks 1–3)

| Stage | Title | Source | Key content |
|---|---|---|---|
| **00** | Boot Sequence | new | Orientation, how stages work, sound/theme setup, diagnostic pre-test (ungraded) |
| **01** | What Programming Is | Day1 s2 | Programs, programmers, natural language ↔ programming language analogy, COBOL/Pascal/C/BASIC/Assembly |
| **02** | Machine Language | Day1 s3–5 | Switches, 0/1, machine code, Figure 1.1 walkthrough, why it's error-prone |
| **03** | Assembly Language | Day1 s6–8 | Mnemonics, ADD/MUL, the assembler, Figure 1.2 walkthrough |
| **04** | High-Level Languages | Day1 s9–15 | Interpreter vs compiler, procedure-oriented (BASIC payroll, Figure 1.3), OO/event-driven (Visual Basic, Figure 1.4) |
| **05** | Why Assembly Still Matters | Day1 s16–17 | Processor/OS/BIOS interface, memory representation, time-critical recoding, TSRs & ISRs |

### Act II — The Machine (Weeks 4–7)

| Stage | Title | Source | Key content |
|---|---|---|---|
| **06** | Organization vs Architecture | Ch1 1.1–1.2 | Physical vs logical, why study it, Principle of Equivalence of Hardware and Software, the three-piece computer |
| **07** | Units, Measures & Cycle Time | Ch1 1.3 | K/M/G/T/P, milli→femto, powers of 10 vs 2, Hz, cycle time = 1/f **← heaviest parameterized-question stage** |
| **08** | Reading a Spec Sheet | Ch1 1.3 ad | Modernize the 2005 ad: give students a **2026** spec sheet (Ryzen/Intel, DDR5, NVMe, PCIe 5.0, USB4) and have them decode it. Keep the original ad as a "then vs now" comparison — that contrast *is* the lesson. |
| **09** | Number Systems & Data Representation | **new** | Binary/octal/hex/decimal conversion, signed magnitude, one's & two's complement, overflow, BCD, IEEE-754 single precision, ASCII/Unicode **← second heaviest parameterized stage** |
| **10** | Digital Logic Level | Ch1 1.6 L0 + **new** | Gates, truth tables, Boolean algebra, DeMorgan, K-maps, half/full adder, latches & flip-flops. This is the payoff for "Level 0" in the hierarchy. |

### Act III — Execution (Weeks 8–11)

| Stage | Title | Source | Key content |
|---|---|---|---|
| **11** | The Computer Level Hierarchy | Ch1 1.6 | Levels 6→0 in full, each level's job, why abstraction layers exist |
| **12** | The von Neumann Model | Ch1 1.7 | ENIAC rewiring, stored program, CPU/memory/I-O, single data path, **the von Neumann bottleneck** |
| **13** | Fetch–Decode–Execute | Ch1 1.7 (ALU1–4) | Full cycle with PC, IR, MAR, MBR, ALU, registers — animated, steppable, and student-programmable |
| **14** | Instruction Set Architecture | **new** | Instruction formats, opcode/operand, addressing modes (immediate, direct, indirect, indexed, register), CISC vs RISC |
| **15** | Writing Assembly | **new**, extends Day1 | **TASM x86-16** (see TOOLCHAIN-CORRECTION.md) — registers, MOV/ADD/SUB/JMP/JNS/HALT, loops, branching, subroutines. Students write and run real programs in-browser. |

### Act IV — Performance & Beyond (Weeks 12–14)

| Stage | Title | Source | Key content |
|---|---|---|---|
| **16** | Memory Hierarchy | Ch1 1.3 cache + **new** | Registers→L1→L2→L3→RAM→disk, locality, direct-mapped/associative/set-associative, hit ratio, AMAT **← parameterized** |
| **17** | Performance & the Future | Ch1 1.5, 1.8 + **new** | Generations 0–4, Moore's Law, Rock's Law, the collision between them, CPI/MIPS/Amdahl's Law, multiprocessing, DNA & quantum computing, Adleman's travelling salesman |

**Capstone (Week 14):** trace one BASIC payroll calculation (Figure 1.3, your own deck) all the
way down — high-level → assembly → machine code → FDE cycle → gate level. One artifact, every
stage in it. That's Petal 1's "bringing a machine up from bare metal" arc, made literal.

---

## 3. The unique-questions engine — the technical heart

**Requirement:** each student gets a unique set of 70 questions *and* unique answers.
**Non-requirement:** every student gets a *harder* or *easier* paper. Uniqueness without
equivalence is unfair, and a thesis panel will ask about it.

### 3.1 Three item types

**Type S — Static.** Conceptual MCQ / true-false pulled from a bank.
Uniqueness comes from: sampling *k* of *n* per objective, sampling 3 distractors from a pool
of 6–8, and shuffling option order.

```
stem:        "Which converts assembly mnemonics into machine code?"
correct:     "An assembler"
distractors: ["A compiler","An interpreter","A linker","The control unit",
              "A microprogram","The ALU"]   ← pool of 6, student sees 3
```

**Type P — Parameterized.** A template with variable slots and a solver. This is where "unique
answers" is literally true — no two students compute the same number.

```js
{
  id: "P-07-cycle-time",
  objective: "07.3",
  vars: { f: { unit: "MHz", range: [66, 4200], step: 1 } },
  stem: "A system bus operates at {f} MHz. What is its cycle time, in nanoseconds?",
  solve: ({f}) => 1000 / f,               // ns
  tolerance: 0.01,                         // accept ±1%
  distractors: ({f}) => [                  // wrong answers from REAL misconceptions
    1_000_000 / f,                         // wrong unit scale
    f / 1000,                              // inverted
    1 / f                                  // forgot the nano
  ],
  rationale: ({f}) => `Cycle time is the reciprocal of frequency. 1/(${f}×10⁶ Hz) = ${(1000/f).toFixed(2)} ns.`
}
```

Stages 07, 09, 16, 17 are near-infinite question sources this way. So are 10 (random truth
tables / K-maps) and 13 (random instruction traces).

**Type G — Generated structural.** Matching, ordering, diagram labelling, FDE trace ordering,
K-map solving. Built from a structured spec — e.g. an ordering item draws 5 of the 7 FDE
sub-steps and shuffles them; a matching item draws 4 of 12 level-hierarchy pairs.

### 3.2 Deterministic seeding

```
seed = SHA256(student_id ‖ stage_id ‖ attempt_no ‖ exam_salt)
```

Same seed always regenerates the same paper. This matters more than it sounds:

- A student disputes a grade → you regenerate their exact paper months later.
- Item analytics stay valid because you know exactly which variant each student saw.
- No need to store 70 full question bodies per student — store the seed and the item IDs.

`exam_salt` is per-assessment and rotated between semesters so last year's leaked screenshots
are worthless.

### 3.3 Blueprint, not random draw

Each assessment is defined by a **blueprint** — the fairness guarantee:

```yaml
final_knowledge_check:
  total: 70
  by_act:   { I: 18, II: 20, III: 20, IV: 12 }
  by_bloom: { remember: 14, understand: 21, apply: 25, analyze: 10 }
  by_type:  { static: 38, parameterized: 22, generated: 10 }
  difficulty_target: 0.62      # mean p-value across the paper
  max_per_objective: 3
```

The generator fills every cell of the blueprint. Two students get different *items* but the
same *shape* of paper. That is the sentence that survives a thesis defence.

### 3.4 Bank size

To keep two students' 70-item papers from overlapping more than ~15%:

| | Target |
|---|---|
| Static items | **≈ 40 per stage × 17 = 680** |
| Parameterized templates | **≈ 4 per stage = 68** (effectively unbounded item count) |
| Generated specs | **≈ 2 per stage = 34** |

That's a lot of authoring. Plan for it:
1. **You author 8–10 seed items per stage by hand** (these set the tone and the answer style).
2. Use an LLM in the admin console to draft the remaining ~30, constrained to the stage's
   learning objectives and your seed items as style examples.
3. **Every drafted item enters `status = 'draft'` and requires human approval** before it can be
   sampled. Never let generated items reach students unreviewed — a wrong answer key in a
   70-item bank is a grading incident.

### 3.5 Server-side only

The answer key **never** reaches the browser. This is non-negotiable and it's the biggest fix
versus your current build, where `lessonData.js` ships every answer to devtools.

```
POST /api/v1/attempts          → { attempt_id, items: [...answer key stripped] }
POST /api/v1/attempts/:id/answer → { correct, rationale, next }   (graded server-side)
POST /api/v1/attempts/:id/submit → { score, breakdown }
```

The Render API owns generation and grading. Supabase owns storage. The browser owns nothing.

---

## 4. Authentication — ID number + email + password

Supabase Auth is email/password. Student ID becomes a **verified roster claim**, not a free-text
field.

### Flow

1. **Teacher imports a roster CSV** → `student_directory` (student_id, full_name, section,
   status='unclaimed').
2. **Sign-up** requires `student_id` + `email` + `password`. `POST /api/v1/auth/register`:
   - looks up `student_id` in `student_directory`
   - rejects if not found, or if `status = 'claimed'`
   - creates the Supabase auth user (service role, server-side only)
   - writes `profiles` row linking `auth.uid()` ↔ `student_id`
   - sets `app_metadata.student_id` and `app_metadata.role` on the JWT
   - marks the directory row `claimed`
3. **Login** accepts *either* identifier. If a student ID is submitted,
   `POST /api/v1/auth/resolve` maps it to the email server-side (rate-limited to 5/min/IP, no
   enumeration in the error message — always "Check your ID and password"), then normal Supabase
   password sign-in runs.

**Why this shape:** random people can't sign up, IDs can't be duplicated, and `student_id` lands
in the JWT so RLS policies and the gradebook can trust it.

**Roles:** `student` | `teacher` | `admin`, in `app_metadata` (JWT-signed, not client-editable).
A `profiles.role` column alone is not enough — a student could try to update it. Set role via
service-role API only.

---

## 5. Stage locking — three layers, resolved server-side

| Layer | Set by | Example |
|---|---|---|
| **Curriculum policy** | System default | Stage N unlocks when Stage N-1 mastery ≥ 70% |
| **Cohort override** | Teacher, per section | "Section BSCPE-2A: open Stage 09 on Oct 14, 08:00" |
| **Student override** | Teacher, per student | "Unlock Stage 12 for student 21-1234 — makeup exam" |

Resolution order: **student override → cohort override → curriculum policy.** A single Postgres
function is the only authority:

```sql
create function is_stage_unlocked(p_user uuid, p_stage text) returns boolean
```

Called by RLS on every content and attempt table. The client may *render* a lock icon, but it
never *decides* one. Every override writes to `audit_log` with actor, reason, and timestamp.

Also supported: `unlock_at` / `lock_at` timestamps for weekly release, and a global "exam mode"
that locks all practice content during an assessment window.

---

## 6. Teacher / Admin console

Eight sections. This is a real product surface, not a bolt-on.

**6.1 Roster** — CSV import with dry-run preview, claim status per student, resend invite,
deactivate, section assignment, bulk move.

**6.2 Live Class (Lecture Mode)** — projector view. Teacher pushes a question to all connected
students; aggregate answer distribution appears in real time via Supabase Realtime. **No names on
the projector, ever.** Per your Petal 5 note: shared struggle, not individual exposure.

**6.3 Student drill-down** — the page you'll use most. For one student: every attempt, every
item, **the exact variant they saw** (regenerated from their seed), their answer, the correct
answer, time on item, and the rationale they were shown.

**6.4 Lock Matrix** — students × stages grid. Click a cell to toggle. Shift-click to bulk apply.
Colour-coded: auto-locked / auto-unlocked / manually overridden. Hovering shows who overrode it
and why.

**6.5 Item Analytics** — the differentiator, and the thing that makes 70 unique papers
defensible:

- **p-value** (difficulty): proportion correct. Flag < 0.20 or > 0.95.
- **Discrimination index**: does this item separate strong from weak students? Flag D < 0.20.
- **Distractor analysis**: which wrong option is pulling people? A distractor nobody picks is
  dead weight; a distractor that top students pick is a broken item.
- **Variant drift**: for parameterized items, is one number range measurably harder? If
  `f = 66 MHz` is answered right 80% of the time and `f = 3300 MHz` only 40%, your ranges need
  narrowing.

Anything flagged goes to a review queue.

**6.6 Question Bank** — browse by stage/objective/type, edit, version (never destructive — new
version, old one retired), preview a live parameterized instance with a re-roll button, bulk
approve drafts, import/export JSON.

**6.7 Gradebook** — per-stage mastery, final check score, CSV/XLSX export shaped for the
university's format, weighting configuration.

**6.8 Audit Log** — every lock override, grade adjustment, item edit, roster change. Immutable,
filterable, exportable. If a grade is ever challenged, this is your evidence.

---

## 7. Data model

Full DDL in `db/schema.sql`. The shape:

```
auth.users (Supabase)
  └─ profiles          uid, student_id, full_name, section_id, role, theme, audio_prefs

student_directory      student_id PK, full_name, section_id, status, claimed_by
sections               id, code, term, teacher_id

stages                 id, act, ordinal, title, est_minutes, prereq[]
objectives             id, stage_id, code, bloom_level, description
content_blocks         id, stage_id, ordinal, kind, body_md, media_ref, version
                       ← content lives in the DB, NOT in a lessonData.js bundle

items                  id, stage_id, objective_id, type(S|P|G), status(draft|review|live|retired),
                       version, stem_template, params_schema, solver_ref,
                       correct_spec, distractor_pool, rationale_template,
                       bloom, target_difficulty, author_id
item_stats             item_id, n_exposures, p_value, discrimination, distractor_hist, updated_at

blueprints             id, scope(stage|final), total, constraints_json
assessments            id, blueprint_id, section_id, opens_at, closes_at, attempts_allowed, exam_salt

attempts               id, user_id, assessment_id, attempt_no, seed, started_at,
                       submitted_at, score, status
attempt_items          attempt_id, ordinal, item_id, item_version, resolved_params,
                       resolved_options, correct_value        ← the answer key, RLS-denied to students
responses              attempt_id, ordinal, raw_answer, is_correct, points,
                       time_ms, answered_at

stage_progress         user_id, stage_id, mastery, best_score, attempts, last_seen_at
stage_locks            scope(global|section|user), scope_id, stage_id, state,
                       unlock_at, lock_at, reason, actor_id, created_at
audit_log              id, actor_id, action, target_type, target_id, payload_json, at
```

**Key rules**
- `attempt_items.correct_value` is protected by RLS: students `SELECT` their own row **only
  after** `attempts.status = 'submitted'`. Never before.
- `responses` is append-only. No updates, no deletes. That's your growth record (Petal 8) *and*
  your audit trail.
- Content in the DB means the teacher can fix a typo without a redeploy. This is the single
  biggest architectural change from your current build.

---

## 8. Design direction

### 8.1 Templates to actually use

**Admin console — `satnaing/shadcn-admin`.** Vite + React + TypeScript + shadcn/ui, MIT.
It's the right pick because you're already on Vite, not Next. <cite index="9-1">It's a free, open-source admin dashboard template built with shadcn/ui, Vite, React, and TypeScript, with 10+ pre-built pages, automatic light/dark theming, a global command palette, and WAI-ARIA accessible components.</cite> The command palette alone is worth it for a teacher jumping between 40 students.

**Fallback / alternative — TailAdmin React.** <cite index="6-1">React 19, TypeScript, Tailwind CSS v4, Vite.</cite> Larger component set, less opinionated. Use if shadcn-admin's structure fights you.

**Take the layout, not the identity.** These templates give you sidebar, data tables, form
patterns, and dark mode — a month of work, free. They do **not** give you a look. Every one of
these ships with the same slate-and-blue palette and Inter everywhere. If you use it as-is your
app looks like every other admin panel on the internet. Replace the token layer.

### 8.2 Three themes (Petal 4 — Ownership)

Theme choice is the student's, persisted to `profiles.theme`.

| Theme | Concept | Background | Ink | Accent | Notes |
|---|---|---|---|---|---|
| **Bare Metal** (default) | Etched PCB, dark | `#0B0E11` | `#D7DEE6` | copper `#C4703B` | Carries over your existing circuit aesthetic |
| **Blueprint** | Engineering drawing, light | `#F2F4F7` | `#16222E` | drafting blue `#1F5F8B` | Hairline grid, sits well on a projector |
| **Phosphor** | CRT terminal | `#07100B` | `#8FE38F` | amber `#E0A93B` | High contrast, genuinely useful for low-vision students |

### 8.3 Typography

Don't ship Inter-for-everything. Three roles:

- **Display:** `Space Grotesk` — engineered, slightly mechanical, not the usual geometric sans.
- **Body:** `Inter` or `Source Sans 3` — it's fine to be neutral where readability rules.
- **Data/code:** `JetBrains Mono` — and it must be a *real* role, not an afterthought. Machine
  code, assembly listings, register values, hex dumps, spec sheets, and every number in a
  parameterized question set in mono. That consistency *is* the design: in this app, monospace
  means "this is what the machine sees."

### 8.4 The signature element

**The Register Bar.** A thin, always-present strip along the top of every stage showing PC, IR,
MAR, MBR, ACC as live hex values. In Stages 12–15 it's real — it tracks the actual simulator. In
earlier stages it idles with a faint pulse, hinting at where the course is going. In the Final
Knowledge Check it shows your question index as the PC.

It's the one memorable thing, it teaches register names by osmosis over 14 weeks, and it makes
Petal 1's "bringing a machine up from bare metal" arc visible on every single screen. Spend your
boldness here and keep everything else quiet.

### 8.5 Motion

One orchestrated moment per stage, not scattered effects:
- Stage unlock: a bus-line trace animates from the previous stage node to the new one (~700ms).
- FDE cycle: the *only* place with continuous animation, because there it's the content.
- Correct answer: 120ms accent flash on the option, nothing more. No confetti on every question
  — it degrades to noise by week 3.
- `prefers-reduced-motion` disables all of it and falls back to instant state change.

### 8.6 Public browser / landing page

Separate route group, same token system. Sections: what the course covers (the 17-stage map as
the hero — the content *is* the pitch), how the question engine works (with a live re-rollable
sample item — that single interaction sells the whole product), teacher features, and sign-in.
Sign-up is invite-gated, so the CTA is "Sign in with your student ID," not "Get started free."

---

## 9. Audio

**Library:** `howler.js` — sprite support, autoplay-policy handling, per-channel volume.

**Sources, all license-clean:**
- **Kenney audio packs** (kenney.nl/assets — UI Audio, Interface Sounds, Music Jingles). <cite index="18-1">Released under CC0 1.0 Universal, meaning no credit is legally required even in a commercial project.</cite> Consistent naming and quality across packs — this is your primary source.
- **Pixabay Music / Sound Effects** — <cite index="14-1">free under the Pixabay Content License with commercial use and no attribution required.</cite> Use for longer ambient loops.
- **OpenGameArt** and **Freesound**, both filtered to CC0 — <cite index="14-1">licenses vary per file on these, so filter for CC0 before downloading.</cite>

**Sound design list**

| Event | Character | Channel |
|---|---|---|
| Option select | Soft mechanical click | UI |
| Correct | Short rising two-tone | Feedback |
| Incorrect | **Neutral low tick — not a buzzer** | Feedback |
| Stage unlock | Ascending 4-note jingle | Event |
| Mastery reached | Fuller resolve of the same motif | Event |
| FDE clock tick | Faint square-wave pulse, tempo-linked to the sim | Sim |
| Ambient loop | Per theme: Bare Metal = low server-room hum, Blueprint = silence, Phosphor = CRT whine | Ambient |

**Rules**
1. **Ambient defaults OFF. UI/feedback defaults ON at 40%.** Auto-playing music on load is the
   fastest way to get an app muted permanently.
2. Wrong answers get a *neutral* sound. A punishing buzzer is exactly the Black Hat pressure your
   Petal 8 warning tells you to avoid.
3. Mute persists to `profiles.audio_prefs` and syncs across devices.
4. Ambient ducks to 20% when any feedback sound plays.
5. One `<audio>` sprite per channel, preloaded on first user gesture (browser autoplay policy
   blocks anything earlier).

---

## 10. Architecture & hosting

```
┌─────────────────────────────┐
│ Vercel — octa-web           │  Vite + React + TS SPA
│  /            public site   │  vercel.json rewrites → /index.html
│  /app/*       student       │
│  /console/*   teacher/admin │
└──────────┬──────────────────┘
           │ HTTPS, Bearer JWT
┌──────────▼──────────────────┐
│ Render — octa-api           │  Node 20 + Fastify
│  /api/v1/auth/*             │  register, resolve-id
│  /api/v1/attempts/*         │  generate, grade, submit
│  /api/v1/console/*          │  roster, locks, analytics
│  (no cron here - free tier) │  scheduled unlocks (*/5), nightly item stats,
│                             │  keep-alive ping during class hours
└──────────┬──────────────────┘
           │ service_role key (server-side only, never in the browser)
┌──────────▼──────────────────┐
│ Supabase                    │  Postgres + RLS · Auth · Storage · Realtime
└─────────────────────────────┘
```

**Why the API exists at all:** answer keys, seeded generation, grading, and lock resolution must
run where students can't reach them. Direct Supabase-from-browser is fine for reads of unlocked
content; everything scored goes through Render.

**Env split**
- Browser gets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` only.
- Render gets `SUPABASE_SERVICE_ROLE_KEY`, `EXAM_SALT_SECRET`, `JWT_AUDIENCE`.
- **The service role key never appears in a `VITE_` variable.** Vite inlines every `VITE_*` var
  into the bundle at build time.

**Correction to the diagram above:** the Render Cron line is wrong — **Render's free tier has no
cron jobs.** Scheduled unlocks, nightly item stats, the nightly invariant run, and the keep-alive
all run on **Supabase Cron (`pg_cron` + `pg_net`)**. See `DELIVERY.md` §2.2.

**Also note `EXAM_SALT_SECRET` is currently doing nothing**, because `assessments.exam_salt` is
stored in a table students and anonymous visitors can read. That is `VERIFICATION.md` V-15, and it
is blocking — the salt must move to a service-role-only table before any assessment is generated.

---

## 11. Octalysis mapping — features to drives

| Drive | Dial | Features in this build |
|---|---|---|
| **1 Epic Meaning** | ▓▓▓▓▓ | The bare-metal arc across all 18 stages; the Register Bar; capstone trace; exportable Engineer's Log PDF |
| **2 Accomplishment** | ▓▓▓▓▓ | Per-objective mastery (not one global bar); stage map as real dependency graph; attempt history as growth curve; weak-spot review queue; competency-named badges (**no generic XP**) |
| **3 Creativity** | ▓▓▓▓▓ | Write-your-own assembly (Stage 15); FDE sequence builder; what-if sliders in Stage 16 cache sim; "break it on purpose" mode; re-roll a parameterized question to practise the *type* |
| **4 Ownership** | ▓▓▓░░ | Theme choice; Architecture Notebook (auto-curated, exportable); "My Mistakes" deck; personal bests, private by default |
| **5 Relatedness** | ▓▓▓░░ | Anonymous class benchmark in Lecture Mode; anonymized "hardest item this week"; opt-in self-formed groups of 3–4. **No global leaderboard.** |
| **6 Scarcity** | ▓░░░░ | Sequential unlock with read-only preview of what's next; daily-regenerating hint tokens; teacher-triggered timed class challenges (collective, not individual) |
| **7 Unpredictability** | ▓░░░░ | Re-rollable parameterized items; random history trivia after a stage (Moore's/Rock's Law, Adleman's DNA problem — straight from your deck); optional bonus challenge. **Aimed at content, never at grading.** |
| **8 Loss & Avoidance** | ▓░░░░ | Opt-in streaks with a freeze; "resume where you left off"; append-only attempt history framed as growth |

**Explicitly not built:** decaying XP, losing earned badges, "you're behind your classmates,"
surprise pop quizzes, public failure. These were on your own anti-pattern list.

---

## 12. Build phases

**`PHASES.md` is authoritative and lists P0-P10.** The duplicate table that used to live here has
been deleted rather than maintained in two places -- see `VERIFICATION.md` V-8. The alpha release
milestone (complete skill tree, partial content) is defined in `DELIVERY.md` section 3.

## 13. Risks worth writing down now

1. **Authoring 700 items is the real project.** The code is 6 weeks; the item bank is ongoing all
   semester. Start writing items in Phase 2, not Phase 7.
2. **Parameterized ranges drift in difficulty.** Ship variant-drift monitoring in P7 or you won't
   know. This is also your best thesis chapter.
3. **Render cold starts.** See §0.2.
4. **Mobile + drag interactions.** Matching and ordering items must have a tap-to-select
   fallback. A large share of your students will be on phones.
5. **Content editing = grade integrity.** Editing a live item invalidates its stats. That's why
   items are versioned and never edited in place.
6. **Scope.** Stages 15 (assembler) and 16 (cache sim) are each a small project on their own. If
   the semester gets tight, ship them as Stage 15/16 "read + parameterized questions only" and
   add the simulator later.
