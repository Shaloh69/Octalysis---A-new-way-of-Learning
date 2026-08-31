# PAGE-SPECS.md
### Every route, its contents, its states

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

Conventions used throughout:
- **Empty / error copy is specified, not left to the implementer.** Errors explain what happened
  and how to fix it. They don't apologize and they're never vague.
- Every page lists its **data source** so nobody invents a fetch.
- Every page lists **who can see it**.

---

## 1. Public site — `apps/web`, unauthenticated

### `/` — Landing
**Hero is the course map, not a headline.** An interactive 17-node graph, greyed for locked,
that anyone can hover to see what each stage covers. The content is the pitch.

Sections, in order:
1. Hero — live stage map + one line: *"Fourteen weeks from `input "Enter Name"` to the gate."*
2. **The unique-paper demo** — a real parameterized item rendered live with a **Re-roll** button.
   Each click shows different numbers and a different correct answer. This one interaction sells
   the entire product; give it room.
3. What the course covers — the four Acts, one card each
4. For teachers — three bullets, link to `/for-teachers`
5. Footer — attribution, licenses, accessibility statement, GitHub

CTA is **"Sign in with your student ID"** — not "Get started free". Access is roster-gated.

### `/course` — Full course map
All 19 stages expanded: title, act, estimated minutes, prerequisites, learning objectives.
Public because there's nothing secret in a syllabus, and it doubles as the course outline the
department will ask for.

### `/how-it-works` — The question engine
Explains seeding, blueprints, and server-side grading in plain language, for students who will
absolutely ask "why is my test different from my seatmate's?". Include the fairness argument
explicitly: different items, same blueprint. Ends with the re-roll demo again.

### `/for-teachers`
Roster import, lock matrix, item analytics, gradebook export, feedback loop. Screenshots.

### `/accessibility`
What we support, what we don't yet, and how to report a barrier. Links to the feedback form.
Not decoration — it's a marking rubric item and a genuine obligation.

### `/about`
Credits. **"Motivation design based on the Octalysis Framework by Yu-kai Chou."** Course material
credited to the instructor. Full third-party license list including every audio file.

### `/login`
Single field labelled **"Student ID or email"** + password. On submit: if the input isn't an
email, `POST /auth/resolve` maps ID → email first.
- Error copy, for *every* failure case: **"We couldn't sign you in. Check your ID or email and
  password."** Identical message for unknown user and wrong password — no enumeration.
- Rate limited. After 5 failures, a 60-second cooldown with a visible countdown.

### `/register`
Three fields: **Student ID**, **Email**, **Password** (+ confirm). Inline: *"Your student ID must
be on your section's roster. If it isn't, contact your instructor."*
- Unknown ID and already-claimed ID both return: **"We couldn't verify that ID. Contact your
  instructor if you think this is wrong."** Same message, deliberately.
- Password rules shown before typing, not after failing.

### `/forgot-password`, `/reset-password`, `/404`, `/500`, `/maintenance`
Standard. `/maintenance` matters — you will need it during a mid-semester migration.

---

## 2. Student app — `apps/web/app/*`, role `student`

### `/app` — The galaxy (the hub)

**3D map, the student's default.** Clicking a planet opens a dialog naming the stage, its state,
its lock reason and distance, and what the encounter actually is — then offers "Enter stage".
`prefers-reduced-motion`, absent WebGL, and viewports ≤ 640px **fall back to the flat presentation
in place, on this same route — they do not redirect.** `VISUAL-SYSTEM-3D.md` §5's degradation
ladder is the owner of that rule (R0 ruling, `docs/PROGRESS.md` F-5). For the map itself see
`docs/redesign/SOLAR-SYSTEM-SPEC.md`.

### `/app/map` — Flat stage map

**A first-class route, not a fallback.** Same 19 nodes and 18 edges as SVG plus real focusable
buttons, always in the header, bookmarkable. Focus order follows curriculum order. This is the
surface the accessibility floor is measured against, and it is what ships if the galaxy runs long.

### `/app` — Stage Map (original spec, now split across the two routes above)
**Data:** `stages`, `stage_progress`, `is_stage_unlocked()` per stage.

- The 17-node dependency graph, laid out by Act. Node states: locked / available / in progress /
  mastered. Not a linear progress bar — a real dependency graph, because the content genuinely
  has one.
- **Locked node click → shows *why*:** "Unlocks when Stage 09 reaches 70%. You're at 45%." Never
  a bare padlock. A lock without a reason is the single most demotivating UI element in ed-tech.
- Read-only **preview** of the next locked stage's objectives (Petal 6: scarcity that still
  respects autonomy).
- Resume card: "Pick up where you left off — Stage 07, section 3."
- Register Bar pinned at top, idling.

### `/app/stage/:id` — Stage reader
**Data:** `content_blocks` where stage unlocked.

Left: content (prose, figures, code listings, diagrams, embedded sims). Right rail on desktop /
bottom sheet on mobile: objectives checklist, glossary terms used on this page, "add to notebook"
button, section progress.
- Figures from the source decks render as `kind='code'` blocks in **mono**, verbatim.
- Locked state: full-page lock card naming the prerequisite and the current mastery.

### `/app/stage/:id/check` — Concept Check (attempt runner)
**Data:** `POST /attempts` → paper with keys stripped.

- One item per screen. Register Bar shows item index as PC.
- Item types: MCQ, true/false, numeric entry (parameterized), matching, ordering, diagram label.
- **Every drag interaction has a tap-to-select fallback.** Non-negotiable.
- Immediate per-item feedback with rationale. Correct → 120ms accent flash + rising two-tone.
  Incorrect → neutral low tick, never a buzzer, plus the rationale and a "try a similar one"
  re-roll.
- Hint tokens (daily-regenerating) available but never required.
- Autosave every answer. Refreshing mid-attempt resumes exactly where you were.
- `aria-live="polite"` announces the verdict.

### `/app/stage/:id/results/:attemptId`
Score, per-objective breakdown, every item with the student's answer and the correct answer
(now readable — attempt is submitted), and what unlocked as a result. Weak objectives get a
direct "review this" link back into the content.

### `/app/final` — Final Knowledge Check
The 70-item blueprint. Item palette showing answered / flagged / unanswered. Review-before-submit
screen. Server-enforced time window. One confirmation before submit — this one is high stakes,
so an accidental submit is unacceptable.

### `/app/lab` — Explore Sandbox
Hub for the three simulators. **Called "the lab", not "the playground"** — register matters for
a college audience.
- `/app/lab/fde` — steppable Fetch–Decode–Execute with a live Register Bar; students can author
  an instruction sequence and watch it run
- `/app/lab/asm` — x86-16 interpreter + VM, memory view, breakpoints, plain-language errors
  pointing at the offending line
- `/app/lab/cache` — sliders for cache size, block size, associativity, miss penalty; live hit
  ratio and AMAT against a sample trace
- **"Break it on purpose" mode** on each: misconfigure deliberately, predict the failure, then run

### `/app/notebook` — Architecture Notebook
Auto-curated: diagrams the student annotated, glossary entries they pinned, corrected mistakes,
their own notes. **Exportable as PDF** — a real artifact they keep after the course ends.

### `/app/mistakes` — My Mistakes
Weak-spot review queue built from wrong `responses`, grouped by objective, spaced-repetition
ordered. Every entry can be re-rolled into a fresh variant of the same item type — practise the
*concept*, not the memorised answer.

### `/app/progress`
Per-objective mastery (not one global bar). Attempt history as a growth curve. **Compare to past
self only — never to peers.** Competency-named badges ("Cycle-Time Calculator: Fluent"), no
generic XP.

### `/app/live` — Lecture Mode, student view
Locked to the teacher's current pushed question. Answer, then see the anonymous class
distribution. No names, ever.

### `/app/settings`
Theme (three options, live preview), audio (per-channel sliders, ambient defaults to 0), profile,
accessibility preferences (reduce motion, larger text), sign out.

### `/app/help`
How stages unlock. Why your test differs from your seatmate's. Who to contact. Link to the
student feedback form.

---

## 3. Teacher console — `apps/console`, roles `teacher` | `admin`

Route guard reads role from **JWT `app_metadata`**, not from the `profiles` table.

### `/console` — Overview
Sections taught, active students this week, stages currently open, items flagged for review,
open feedback items, next scheduled unlock. Each is a link, not just a number.

### `/console/roster`
TanStack Table. CSV import (`student_id,full_name,section_code`) with a **dry-run preview
modal** showing new / existing / conflicting before anything is written. Claim status per row,
resend invite, deactivate, bulk section move. Every write → `audit_log`.

### `/console/students/:id` — The page you'll use most
Every attempt. Expand a row to see **the exact variant that student saw**, regenerated from their
stored seed: their numbers, their options in their order, their answer, the correct answer, the
rationale they were shown, and time on item. This is what makes a grade dispute a 30-second
conversation.

### `/console/locks` — Lock Matrix
Students × stages grid. Click a cell to toggle. Shift-click for bulk. Three visual states: auto /
manually unlocked / manually locked. Every toggle opens a short **reason prompt** and writes to
`audit_log`. Hover shows who overrode it, when, and why. Section-level and scheduled
(`unlock_at`) overrides get their own tab.

### `/console/content`
Edit `content_blocks` with live preview. Versioned. **A typo fix must never require a redeploy** —
that's the whole reason content lives in the database.

### `/console/items` — Question bank
Browse by stage / objective / type / status. Inline stats: p-value, discrimination, exposures.
Review queue of flagged items. **"Preview instance" panel with a re-roll button** so the teacher
sees what students actually get. Bulk approve drafts. Import/export JSON.

### `/console/items/:id/edit`
Editing a **live** item creates version+1 and retires the old version; stats do not carry over.
The confirmation dialog says exactly that, in those words.

### `/console/assessments`
Create from a blueprint, scope to a section, set open/close window and attempts allowed, rotate
`exam_salt` between terms.

### `/console/analytics`
Cohort mastery heatmap (objectives × students). Item difficulty distribution. **Variant drift**
for parameterized items — is one number range measurably harder? Time-on-item outliers.
Completion funnel per stage.

### `/console/gradebook`
Per-stage mastery + final score. Weighting configuration. CSV / XLSX export shaped for the
university's format.

### `/console/live` — Lecture Mode control
Push an item to all connected students. Live aggregate distribution via Supabase Realtime.
Separate **projector view** at `/console/live/present` — large type, high contrast, **no names**.
Timer for collective timed challenges (framed as a class effort, not individual pressure).

### `/console/feedback` — see §4

### `/console/audit`
Every lock override, grade adjustment, item edit, roster change. Immutable, filterable,
exportable. If a grade is ever challenged, this is the evidence.

### `/console/settings`
Section config, curriculum policy defaults (the mastery threshold for auto-unlock), notification
prefs, API health.

---

## 4. Teacher feedback system

**Purpose:** the teacher tells you what's wrong with the platform, and you can prove you fixed it.

Three channels, because a single "Feedback" button won't get used. <cite index="36-1">Passive widgets typically see 1–3% response rates, while well-targeted in-context prompts pull 5–15%.</cite>

### 4.1 Contextual flag — the workhorse
A small flag icon in the console header, present on every page. One click opens a compact popover:

```
What's wrong here?
( ) Something's broken
( ) This is confusing
( ) This is slow
( ) Idea / request

[ one text field, autofocused, placeholder: "Describe it in a sentence." ]

Automatically attached: page, browser, screen size, app version
                                                   [Cancel] [Send]
```

Auto-captured, no typing required: `route`, `role`, `section_id`, `app_version`, `viewport`,
`user_agent`, last 20 UI events, last API error if any. **Show the teacher exactly what's
attached** — a black-box telemetry blob destroys trust in the channel.

### 4.2 Inline content report — the highest-value one
On every rendered item and content block, in both the console and the student app:
**"Report a problem with this question."**

Reasons: *wrong answer key · ambiguous wording · typo · doesn't match what I taught · broken
figure · too hard/easy for this stage*.

Attaches `item_id`, `item_version`, and **the exact resolved variant** — so you're debugging the
instance the person actually saw, not a generic item. Routes straight into the
`/console/items` review queue, not the general inbox.

This is the feature that closes the loop between teaching and the item bank. When a teacher says
"question 34 is wrong," you can regenerate exactly what they saw.

### 4.3 Periodic usability survey — the quantitative backbone
The 10-item **System Usability Scale**. <cite index="40-1">Ten standardized statements rated 1–5 producing a single 0–100 score, with robust benchmarking data behind it.</cite> <cite index="36-1">Average product scores sit around 68</cite> — that's your benchmark.

Rules, straight from the research:
- **Trigger gate: ≥3 sessions AND ≥1 completed core workflow.** <cite index="40-1">SUS measures usability perception, which requires experience; a user who just logged in cannot meaningfully rate the ten statements.</cite>
- Max once every 6 weeks per person. Dismissible. Never blocks the UI.
- Render items **verbatim**, including the negatively-phrased ones (2, 4, 6, 8), and score them
  inverted. <cite index="37-1">Watch for double negatives and confusing language, and have someone proofread before going live.</cite>
- <cite index="40-1">Aim for ≥20 responses for a reliable average, and don't over-interpret small differences.</cite> With three teachers you won't hit that — so **also survey students** and report the two groups separately. Say so plainly in the thesis rather than quoting a mean of n=3.
- Track the score release over release. That trend line is a better result than any single number.

Add a **CSAT** one-liner after specific completed workflows ("How was importing your roster?" 1–5
+ optional comment). Skip NPS — "would you recommend this to a colleague" is close to meaningless
for a tool a course mandates, and a panel will ask why you used it.

### 4.4 `/console/feedback`
Two tabs.

**"My feedback"** — everything this teacher submitted, with a **status** and, when shipped, a
**"Released in v1.4.2"** badge. Closing the loop visibly is the single biggest driver of repeat
submissions. If feedback disappears into a void, the second one never comes.

**"All feedback"** (admin only) — inbox with triage: `new → triaged → in progress → shipped |
won't fix`. Auto-deduped by route + text similarity. Severity. Filter by channel, route, role,
version. SUS score trend chart. Export CSV.

### 4.5 Schema addendum

```sql
create type feedback_channel as enum ('flag','content_report','sus','csat');
create type feedback_status  as enum ('new','triaged','in_progress','shipped','wont_fix');

create table feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  role         user_role not null,
  channel      feedback_channel not null,
  category     text,                      -- broken | confusing | slow | idea
  body         text,
  rating       int,                       -- CSAT 1-5
  sus_answers  int[],                     -- exactly 10 values, 1-5
  sus_score    numeric(5,2),              -- computed 0-100
  route        text,
  app_version  text,
  context      jsonb not null default '{}',  -- viewport, ua, last events, last api error
  item_id      uuid references items(id),
  item_version int,
  resolved_variant jsonb,                 -- the exact instance they saw
  status       feedback_status not null default 'new',
  severity     text,
  released_in  text,
  triaged_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on feedback (status, created_at desc);
create index on feedback (channel, route);
create index on feedback (item_id) where item_id is not null;

create table feedback_prompts (      -- gates the SUS trigger; prevents nagging
  user_id    uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,          -- 'sus'
  shown_at   timestamptz,
  answered   boolean not null default false,
  dismissed_count int not null default 0,
  primary key (user_id, prompt_key)
);

alter table feedback enable row level security;
alter table feedback_prompts enable row level security;

-- anyone signed in may submit
create policy fb_insert on feedback for insert
  with check (user_id = auth.uid());
-- you see your own; admins see all
create policy fb_read on feedback for select
  using (user_id = auth.uid() or jwt_role() = 'admin');
create policy fb_admin on feedback for update
  using (jwt_role() = 'admin') with check (jwt_role() = 'admin');
create policy fp_own on feedback_prompts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- SUS scoring: odd items (x-1), even items (5-x), sum x 2.5
create or replace function sus_score(a int[]) returns numeric
language sql immutable as $$
  select round(2.5 * (
    select sum(case when i % 2 = 1 then a[i] - 1 else 5 - a[i] end)
    from generate_subscripts(a, 1) i
  ), 2)
$$;
```

---

## 5. Shared UI states — specify once, use everywhere

| State | Rule |
|---|---|
| **Loading** | Skeletons matching final layout. Never a centred spinner on a full page. |
| **Empty** | An invitation to act, not an apology. "No items in this stage yet. Add one." |
| **Locked** | Always name the reason and the current distance to unlocking. |
| **Error** | What happened + how to fix it. Never a stack trace, never a bare code. |
| **Offline** | Banner + queued autosave. Lecture Mode must degrade gracefully — a Supabase hiccup in front of 40 students is the worst failure mode in this app. |
| **Saving** | Optimistic, with a quiet "Saved" confirmation. Attempt answers are never optimistic — they're server-graded. |
