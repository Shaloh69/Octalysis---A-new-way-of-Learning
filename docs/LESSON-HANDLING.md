# LESSON-HANDLING.md
### How a lesson travels from your Drive folder to a student's screen

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

---

## 0. What I could and couldn't reach

**The Drive folder is not accessible to me.** I can see its title — *Computer Organization and
Architecture* — but Drive builds its file list with JavaScript, so a fetch returns an empty
shell. There is also **no PDF in this conversation**; if you meant to attach one, it didn't come
through.

**What I need from you, uploaded directly:** the decks, PDFs, syllabus, lab handouts, and exam
papers. Any of `.pptx`, `.pdf`, `.docx`, `.md`. Once those are in, I can map each one to a stage
and tell you exactly which stages still have no source material.

**What I already have and have used:** `Day1.pptx` (programming language levels, Figures 1.1–1.4)
and `1.ppt` (Null & Lobur Chapter 1). Both are extracted into `docs/source/` in the bundle, and
every stage in the plan traces back to specific slides in them.

---

## 1. The pipeline

```
  YOUR FILES            AUTHORING              RUNTIME              STUDENT
  ──────────            ─────────              ───────              ───────
  .pptx / .pdf   →   docs/source/*.md   →   content_blocks   →   stage reader
  in Drive           (extracted,            (Postgres,           (archetype-
                      verbatim)              versioned)           driven beats)
                            │                      ▲
                            │                      │
                            └── content/stages/NN.md ──┘
                                (你 author here;
                                 sync-content.ts pushes)
```

Four properties this buys you:

1. **Git-reviewable.** Content lives as markdown in the repo, so a content change is a diff.
2. **No redeploy for a typo.** The database is the runtime source, so `/console/content` edits
   land immediately.
3. **Verbatim-checkable.** CI diffs quoted spans in `content/stages/*.md` against
   `docs/source/*.md`. If a definition drifts, the build fails. This is the guard against the
   single biggest risk of building with an LLM — plausible-sounding invented lecture text.
4. **Versioned.** `content_blocks.version` bumps on change, so you can tell which cohort saw
   which wording.

---

## 2. What one lesson actually contains

A stage is a row in `stages` plus an ordered list of `content_blocks`. Blocks have a `kind`, and
`kind` is what the reader dispatches on:

| kind | Renders as | Example from your decks |
|---|---|---|
| `prose` | Body text | "A program is a set of instructions…" (Day 1, s2) |
| `figure` | Image + caption + annotation layer | The 2005 spec-sheet ad (Ch1 §1.3) |
| `code` | Mono listing, line-numbered, verbatim | Figures 1.1–1.4, character for character |
| `diagram` | Interactive SVG with labelled hotspots | von Neumann data path (Ch1 §1.7) |
| `sim` | Mounts a simulator component | FDE stepper, cache sliders, x86-16 VM |
| `callout` | Boxed aside | "Why this matters for your ESP32 work" |
| `probe` | Inline ungraded check | 2–3 per stage, no score, no record |

Plus, in `stages`: `archetype`, `levels` (which Computer Level Hierarchy levels it touches),
`prereq`, `est_minutes`, `gradeable`, `published`.

---

## 3. How the four archetypes handle different lesson shapes

This is the part that makes the system fit *your* material rather than an imagined uniform course.
Stage 05 in the Day 1 deck is two slides of bullets. Stage 08 in Chapter 1 is one image repeated
eight times. A single loop can't serve both.

```
A · CONCEPT     BRIEF → LEARN → PROBE → SORT  → CHECK → BRING-UP → LOG
                stages 01 05 06 11 12
                SORT replaces the lab: classify, order, match.
                Stage 06 sorts statements into organization vs architecture.
                Stage 11 orders the six abstraction levels.

B · COMPUTATION BRIEF → LEARN → PROBE → DRILL → CHECK → BRING-UP → LOG
                stages 07 09 16 17
                DRILL is unlimited, ungraded, re-rollable parameterized items.
                No sandbox — these stages want repetition with fresh numbers,
                which the question engine already produces for free.

C · ARTIFACT    BRIEF → LEARN → TRACE → REMIX → CHECK → BRING-UP → LOG
                stages 02 03 04 05 08
                Built around a real listing or document from the deck.
                TRACE walks it line by line. REMIX lets the student change it.

D · SIMULATOR   BRIEF → LEARN → LAB → BUILD → BREAK → CHECK → BRING-UP → LOG
                stages 10 13 14 15
                BUILD = author your own. BREAK = misconfigure deliberately and
                PREDICT the failure before running. The prediction is the assessment.
```

**Stage 00** has its own shape: `WELCOME → SETUP → DIAGNOSTIC → BRING-UP(power)`. The diagnostic
is ungraded and never counts.

The reader component reads `stages.archetype` and renders the matching beats. A type-D stage with
no `kind='sim'` block is a misconfigured stage, and **INV-27** catches it.

---

## 4. How a student moves through a lesson

1. **Arrives** at `/app/stage/07`. Server calls `is_stage_unlocked()`. If locked, the screen names
   the reason and the distance: *"Unlocks when Stage 06 reaches 70%. You're at 45%."* Never a bare
   padlock.
2. **Brief** — one instructor-authored line on why this matters.
3. **Learn** — content in 3–5 minute chunks, because the barrier is starting, not finishing.
4. **Probe** — inline checks with no record. Purely "did that land?"
5. **Beat 4** varies by archetype (SORT / DRILL / TRACE+REMIX / LAB+BUILD+BREAK).
6. **Check** — `POST /attempts`. The API seeds from `sha256(student_id ‖ stage ‖ attempt_no ‖
   exam_salt)`, fills the stage blueprint, resolves each item, strips every answer key through the
   one serializer, and returns the paper. Grading happens server-side, per answer.
7. **Bring-Up** — the subsystem lights up. ~2 seconds, one jingle, once per stage. The only
   celebration in the app.
8. **Log** — an entry auto-writes into the Engineer's Log.
9. **Three axes advance:** Depth (the gauge descends), Competency (cells in the 7×3 grid),
   Hardware (`/app/machine`). No XP anywhere.

---

## 5. Design elements and "characters"

**Straight answer to the earlier question: the zip I gave you before had *no* assets — only
documentation and SQL.** That's now fixed. `packages/tokens/` contains real, working files:

| File | What's in it |
|---|---|
| `tokens.css` | 80 tokens. Three complete themes in OKLCH. Type scale, spacing, motion vocabulary, semantic colours, the register cast. Validated: braces balanced, every `var()` resolves. |
| `accents.ts` | The twelve named accent presets with hues and the apply function. |
| `elements.svg` | 19 SVG symbols, stroke-based, `currentColor`, each with a `<title>`. Validated: parses as XML. |

### The cast — and why it isn't a mascot

Your brainstorm template warns against a *"childish arcade skin"* for a college CpE audience.
A cartoon mascot is exactly that risk. So the characters here are the **six registers**, drawn
from how the things are actually notated:

| Character | Glyph | Role, in one line | Hue |
|---|---|---|---|
| **PC** | box with a chevron | where next | 20° |
| **IR** | brackets holding a block | what now | 60° |
| **MAR** | crosshair on a grid | which cell | 130° |
| **MBR** | open box, arrow through | in transit | 190° |
| **AC** | circle with a sum | the result | 280° |
| **ALU** | the standard trapezoid with the input notch | the doing | 320° |

Same glyph, same colour, every screen, for fourteen weeks. By week 10 a student recognises MAR by
its silhouette before reading the label. That's dual coding doing real work, and it costs you
nothing beyond consistency.

The register hues live in a **bounded context** — the Register Bar and the simulators only — so
they never collide with the student's chosen accent.

The second cast is the **subsystems** that light up on Bring-Up: power rail, clock, bus, memory,
cache, gate, control unit, core. Eight symbols, all in the sprite.

### Where to get the rest

| Need | Source | License |
|---|---|---|
| Illustrations (landing, empty states) | <cite index="9-1">unDraw — open-source SVG illustrations, free even commercially without attribution, with live colour editing to match your palette</cite> | free, no attribution; <cite index="10-1">but note its license prohibits redistributing them as a compiled pack</cite> |
| Hand-drawn people (personas, storyboards) | <cite index="6-1">Open Peeps — a mix-and-match kit of vector arms, legs, emotions, clothing and hairstyles, public domain under CC0</cite> | CC0 |
| Sketchy scene elements | <cite index="5-1">Open Doodles — free for commercial use under CC0, in SVG, PNG and animated GIF</cite> | CC0 |
| Clean UI illustrations | <cite index="4-1">DrawKit — MIT licensed, no credit needed, free for commercial and personal use</cite> | MIT |
| Icons | Tabler Icons · Lucide | MIT |
| Audio | Kenney CC0 packs · Pixabay | CC0 |

**Recommendation:** use unDraw sparingly and only for empty states and the landing page. Its house
style is friendly-startup, which fights the engineering register you're going for. The register
cast and the subsystem sprite are the identity; illustrations are filler.

Run everything through SVGO, inline the small ones, and add `<title>`/`aria-label` — <cite index="11-1">the standard accessibility practice for SVG graphics.</cite>

---

## 6. Research grounding for the lesson design

Everything below is a decision the literature supports, not a preference.

**Narrative framing for a difficult domain.** A Manchester Metropolitan University interactive
learning environment for first-year computer architecture <cite index="18-1">used a narrative-based framework specifically to appeal to students who found the domain difficult, and to raise both their learning and their motivation to learn.</cite> That's precisely what The Bring-Up is for — and precisely the audience your brainstorm template describes.

**Badges over points.** The gamification-on-assembly review finds that <cite index="14-1">badge-based learning systems promote structured progression and encourage students to develop assembly skills at their own pace</cite>, and that gamified approaches improved <cite index="14-1">motivation, retention, and both practical and theoretical understanding compared to traditional methods.</cite> This is the evidence for competency-named badges ("Cycle-Time Calculator: Fluent") and against generic XP.

**Structured tutorial → hands-on challenge.** The same review notes that Assembly Academy <cite index="14-1">implements structured tutorials followed by hands-on challenges, which lets researchers track learning progression and identify where students struggle.</cite> That is exactly the archetype-D loop (LEARN → LAB → BUILD → BREAK), and your per-item telemetry gives you the same tracking.

**Foundations before complexity.** Gamified practice is <cite index="14-1">particularly beneficial in courses covering complex microprocessor architectures like ARM and x86, because it lets students solidify foundational skills before advancing.</cite> Justifies MARIE in Stage 15 rather than jumping to x86.

**Block-based scaffolding for a first assembly course.** Learning-analytics work on modality found that <cite index="15-1">learners in a text-based modality wrote longer code, hit more syntax errors and took longer to debug, while block-based learners achieved better programming knowledge performance.</cite> This is the evidence for making the **Guided** difficulty tier in Stage 15 block-based and Standard/Challenge text-based.

**The gap that is your contribution.** Two separate reviews name the same hole. The CS scoping
review identifies as a future research topic <cite index="16-1">"assessing the role of game design elements in enhancing engagement and understanding of computer science concepts"</cite>, noting how few studies isolate which elements do the work. The assembly-specific proposal is blunter: <cite index="13-1">despite numerous attempts to make assembly language learning more accessible, a common thread is the absence of formal experimentation to assess the effectiveness of the proposed methods.</cite>

You have per-item, per-mechanic, per-student telemetry and a seeded design that lets you hold
difficulty constant while varying a mechanic. **You can run the experiment almost nobody in this
literature has run.** Pick two or three petals, A/B them across sections, and measure mastery
rather than self-reported enjoyment. That's the thesis.

---

## 7. Fidelity back to the brainstorm template

Checking every petal against what's actually specified in the bundle:

| Petal | Dial you set | Built? | Where |
|---|---|---|---|
| 1 Epic Meaning | heavy | ✅ 8/8 ideas | The Bring-Up, `/app/machine`, Engineer's Log, capstone poster, ESP32 callouts, mission briefs, explain-to-a-partner, branded PDF |
| 2 Accomplishment | heavy | ✅ 8/8 | Per-objective mastery, real prereq skill tree, growth curves, Guided/Standard/Challenge tiers, competency badges, auto-summaries, compare-to-past-self, weak-spot queue |
| 3 Creativity | heavy | ✅ 8/8 | FDE builder, what-if sliders, debug activity, payroll remix, student-authored items, diagram annotation, rubric challenges, break-it-on-purpose |
| 4 Ownership | moderate | ✅ 8/8 | **Twelve accent presets** (`accents.ts`), Architecture Notebook, My Mistakes, certificates, student glossary, My Roadmap, private bests, concept map export |
| 5 Relatedness | moderate, opt-in | ✅ 8/8 | Cohort-scoped leaderboard, anonymous class benchmark, study pairs, threaded annotation, ask-a-classmate, hardest-question reveal, spotlight, self-formed groups |
| 6 Scarcity | light | ✅ 4/4 | Sequential unlock + read-only preview, timed class challenge, hint tokens, first-correct-this-session |
| 7 Curiosity | light | ✅ 4/4 + re-roll | Rock's/Moore's Law trivia, bonus challenge, what-if prompts, myth-or-fact — **all sourced from your own Chapter 1 deck** |
| 8 Loss | smallest | ✅ 3/3 | Opt-in streak with freeze, pick-up-where-you-left-off, append-only history as growth record |

**Anti-patterns from your template, explicitly not built:** decaying XP · losing earned badges ·
"you're falling behind your classmates" · surprise pop quizzes · hearts that lock you out · a
global leaderboard · red error states on wrong answers.

**One thing your template asked for that I have not fully delivered:** §"Next round" says to take
your top 2–3 ideas into a second Lotus Blossom and blossom eight *implementation-level* ideas
around each (UI states, data model, exact copy, animation timing). `PAGE-SPECS.md` does this for
the attempt runner and the lock matrix. It has **not** been done for the payroll remix (Stage 04)
or the Depth Gauge — and those are your two most distinctive features. Worth one more brainstorm
round before P2 and P9 respectively.
