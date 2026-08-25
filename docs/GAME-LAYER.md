# GAME-LAYER.md
### OCTA as a game — the core loop, all 8 petals implemented, and the per-student accent system

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

The brainstorm template is the design brief. This file turns all 52 of its ideas into concrete
mechanics, anchored to what's actually in the two source decks. Nothing here is a skin over a
worksheet — every mechanic is doing pedagogical work.

---

## 1. The frame: The Bring-Up

Real engineers call it *hardware bring-up* — you get a dead board and you bring subsystems online
one at a time until the machine runs a program. **That is literally the arc of your course
content**: language levels → organization → registers → FDE cycle → memory → performance.

So the game frame isn't a fantasy. It's the truth about the material:

> **Stage 00, the board is dark. Stage 17, it runs the payroll program from Figure 1.3 of your
> own Day 1 deck — and you can trace that program from BASIC down to the gates.**

Each stage brings one subsystem online. `/app/machine` shows the board: dim outlines for what's
still dark, lit and labelled for what's online, with the Register Bar across the top going from
an idle pulse to real values around Stage 12.

| Stage | Subsystem that lights up |
|---|---|
| 01–02 | Power rail + the switches (machine code, 0s and 1s — deck slide 3) |
| 03 | The assembler bench |
| 04 | Compiler / interpreter path |
| 05 | The reason you're here — BIOS/OS/processor interface |
| 06–07 | The clock. It starts ticking, at a real frequency you calculate. |
| 08 | The spec plate on the case |
| 09 | The data bus — now carrying real encoded values |
| 10 | Gate level. The board's lowest layer becomes visible for the first time. |
| 11 | All six abstraction layers stack up on screen |
| 12 | CPU / memory / I-O — and **the von Neumann bottleneck becomes a visible constriction** |
| 13 | Control unit + ALU. The machine executes for the first time. |
| 14 | Instruction decoder |
| 15 | You write the program |
| 16 | Cache tiers stack in front of RAM |
| 17 | Second core appears — and Moore's Law starts ticking against Rock's Law |

This is the Knob & Switch Computer's insight, which the research literature already validated:
<cite index="81-1">it can be presented one component at a time, starting with a simple interactive data path and building incrementally to a full-featured stored program machine — and it incorporates cognitive hooks in the form of knobs and switches that encourage exploration and discovery.</cite> The Bring-Up is that idea as a progression system.

---

## 2. The core loop

Every stage runs the same seven beats. Consistency is what makes it feel like a game rather than
a pile of features.

```
  BRIEF  →  LEARN  →  PROBE  →  LAB  →  CHECK  →  BRING-UP  →  LOG
   30s      8-12m     inline    5m     graded    the payoff   automatic
```

1. **Brief** — one instructor-authored line: *why this concept matters for the exam and for real
   systems.* (Petal 1.6)
2. **Learn** — content in 3–5 minute chunks. <cite index="76-1">Duolingo keeps lessons to 3–5 minutes because the biggest barrier is starting, not finishing — short sessions lower the activation energy to near zero.</cite> Your students are on phones between classes; respect that.
3. **Probe** — 2–3 ungraded inline checks. No score, no record. Purely "did that land?"
4. **Lab** — the sandbox for this stage. Optional but always available.
5. **Check** — the graded Concept Check, seeded and unique per student.
6. **Bring-Up** — the subsystem lights up. ~2 seconds, one jingle, once per stage. **This is the
   only celebration in the app**, which is exactly why it works.
7. **Log** — an entry auto-writes into the Engineer's Log: what you mastered, what you got wrong
   and later fixed, one figure you annotated.

---

## 3. All eight petals, implemented

### Petal 1 — Epic Meaning & Calling · White Hat · dial ▓▓▓▓▓

| Idea from your template | Implementation |
|---|---|
| Bare-metal arc as one story | **The Bring-Up** (§1) + `/app/machine` |
| Engineer's Log, exportable | Auto-written per stage; PDF export; real study artifact |
| "Why this matters" → real hardware | Callouts tied to ESP32 register-level work and embedded firmware — their actual degree path, not a fantasy |
| Capstone poster | Stage 17 completion unlocks a full annotated architecture diagram, print-quality PDF |
| Sandbox as "the lab" not "playground" | Named "the lab" everywhere. Register matters for a college audience. |
| Instructor mission brief | Beat 1 of the core loop, authored in `/console/content` |
| "Explain to a study partner" | Post-mastery prompt; the response can be shared to the cohort thread |
| Branded PDF summary | End-of-course concept map, university-branded |

**The capstone is the whole design in one artifact.** Take the BASIC payroll program from
Figure 1.3 of your Day 1 deck — `gross = hours * rate`, the tax deductions, `print name$, net` —
and trace it down: BASIC → assembly (Figure 1.2's style) → machine code (Figure 1.1's style) →
FDE cycle → the adder you built in Stage 10. Four figures from the instructor's own deck,
connected into one continuous object. That's a thesis demo that lands in thirty seconds.

### Petal 2 — Development & Accomplishment · ▓▓▓▓▓

- **Per-objective mastery**, not one global bar. 18 graded stages and 110 syllabus outcomes = 110 mastery dials.
- **Skill tree = the real prerequisite graph.** Stage 13 (FDE) genuinely requires Stage 12; Stage
  10 (logic) genuinely requires Stage 09 (number systems). The tree is honest, not decorative.
- **Growth curve**, not a hidden history: "attempt 1 wrong → attempt 3 correct" plotted.
- **Self-selected difficulty tiers: Guided / Standard / Challenge.** Guided gives worked examples
  and a scaffolded first attempt; Challenge draws only `bloom >= apply` items.
- **Competency-named badges, no generic XP.** "Cycle-Time Calculator: Fluent". "Two's Complement:
  Fluent". "FDE Tracer: Fluent". "Cache Analyst: Fluent". A badge names a skill you could put in
  a sentence about yourself; XP names nothing.
- **Compare to past self only.** Never to peers. Every chart in `/app/progress` has one series.
- **Weak-spot queue** built from wrong responses, spaced-repetition ordered.

### Petal 3 — Empowerment of Creativity & Feedback · ▓▓▓▓▓

| Idea | Implementation |
|---|---|
| Build an FDE sequence and step it | `/app/lab/fde` — author instructions, watch PC/IR/MAR/MBR/ACC move |
| What-if sliders | `/app/lab/cache` — cache size, block size, associativity, miss penalty → live hit ratio + AMAT |
| Debugging activity | "Find the fault": a broken x86-16 program, a mislabelled truth table, a K-map with a wrong grouping |
| **Remix the BASIC payroll** | Change hours/rate → recompute live → **then show the same computation in assembly, then in machine code.** One remix, three abstraction levels. This single feature teaches Stages 02–04 by itself. |
| Student-authored questions | Write an MC item; optionally submit to the cohort pool; instructor can promote a good one into the real bank with credit |
| Inline diagram annotation | Saved to the student's own notebook |
| Rubric-scored open challenges | Instructor-unlockable, e.g. "write an x86-16 program that finds the larger of two inputs" |
| **Break it on purpose** | Deliberately misconfigure, **predict the failure before running**, then run. The prediction is the assessment. |

### Petal 4 — Ownership & Possession · ▓▓▓░░

**This is where the per-student accent color lives.** Full design in §4.

Plus: Architecture Notebook · "My Mistakes" permanent deck · per-stage mastery certificate ·
student-authored glossary entries · "My Roadmap" bookmarks · personal bests, **private by
default** · exportable end-of-course concept map.

### Petal 5 — Social Influence & Relatedness · ▓▓▓░░ · social, not competitive

- **Cohort-scoped opt-in leaderboard** — a rolling group of ~15 students with similar recent
  activity, not the whole class. Opt in, opt out any time, no persistent record.
- **Class benchmark in Lecture Mode** — aggregate accuracy on the projector. **No names, ever.**
- **Study-pair matching** for students on the same current stage.
- **Threaded annotation on hard concepts** — cohort-visible. The von Neumann bottleneck and
  two's-complement overflow will generate the most threads; seed them deliberately.
- **"Ask a classmate"** — flag a question; it resurfaces to peers who are ahead. Async peer
  tutoring.
- **"Hardest question in class this week"** — anonymized, framed as shared struggle. Pulls
  directly from your `item_stats.p_value`, so it's free.
- **Instructor "great answer" spotlight** — opt-in, anonymizable.
- **Self-formed groups of 3–4** with a private board. Competition with people you know is much
  less anxiety-producing than a class ranking.

### Petal 6 — Scarcity & Impatience · ▓░░░░ · always opt-in

- Sequential unlock **with a read-only preview** of the next stage's objectives. Scarcity that
  still respects autonomy.
- **Time-boxed class challenge** in Lecture Mode — instructor-triggered, synchronous, **framed
  collectively** ("the class got 78%"), never individually.
- **Daily-regenerating hint tokens.** Light scarcity, but help is never fully blocked.
- **"First correct in this session"** — exists only inside one Lecture Mode session, never
  written to a record.

> Keep this petal small, exactly as your template says. Never attach scarcity to grades or to
> permanent status.

### Petal 7 — Unpredictability & Curiosity · ▓░░░░ · aimed at content only

**Every one of these comes from your own Chapter 1 deck** — you already have the material:

- Rock's Law: a chip plant cost about $12,000 in 1968, when $12,000 bought a nice suburban home
  and an executive earning $12,000/year was living comfortably. By 2005: over $2.5 billion — more
  than the GDP of Belize, Bhutan, or Sierra Leone.
- Moore's Law vs Rock's Law: for one to hold, the other must fail, and nobody knows which gives
  out first.
- Adleman's DNA computer solving a seven-city travelling salesman problem in 1994.
- IBM's Blue Gene: over a million processors, announced 1999.
- Hollerith punched cards, still used for computer input into the 1970s.
- The ENIAC took skilled technicians *days* of moving plugs and wires to solve one problem.

Mechanics: random trivia card after a section · "Myth or fact" quick-checks · "What happens
if…" prompts inside the lab · a bonus challenge that sometimes unlocks after a Check.

**And the best one, which is free:** the **re-roll** on any parameterized item. Variable reward
that is also pedagogically sound, because you're practising the concept rather than memorising
one answer.

> Aim all uncertainty at content. **Never at grading.** No surprise pop quizzes — that's the
> exact pattern flagged as harmful for CS learners.

### Petal 8 — Loss & Avoidance · ▓░░░░ · smallest dose

- Opt-in streak **with a genuine freeze**. Never a hard reset to zero.
- "Pick up where you left off" — framed as continuity, not loss.
- Append-only attempt history, framed as a growth record.

**Explicitly not built:** decaying XP · losing earned badges · "you're falling behind your
classmates" · hearts/lives that lock you out · surprise assessment.

---

## 4. Per-student accent colour

Your explicit ask, and it's the right instinct — it's Petal 4's cheapest, highest-value mechanic.
But it's harder than a colour picker, and doing it naively will break your accessibility.

### The problem with storing a hex

If a student picks `#FFEE00` and your theme is Blueprint (light background), their accent fails
contrast and their entire progress UI becomes unreadable. You cannot let a free colour wheel
choose a token that carries meaning.

### The fix: store a hue, derive the colour

Store `profiles.accent_hue` (0–360) — **not a hex.** Derive the actual colour at runtime in
OKLCH, holding lightness and chroma fixed per theme and varying only hue.

This works because <cite index="86-1">HSL lightness is not perceptually uniform — a yellow and a blue at the same HSL lightness can look very different — whereas OKLCH gives a useful lightness axis</cite>, and <cite index="84-1">OKLCH keeps lightness consistent across hues, so a scale generated in OKLCH steps evenly to the human eye.</cite> Fixed L in OKLCH means **contrast is constant no matter which hue the student picks.** That's the whole trick.

```css
/* packages/tokens/accent.css */
:root {
  --accent-hue: 250;              /* from profiles.accent_hue */
}
[data-theme="bare-metal"] {       /* dark: accent must be light enough to read */
  --accent:       oklch(0.72 0.15 var(--accent-hue));
  --accent-hover: oklch(0.78 0.16 var(--accent-hue));
  --accent-muted: oklch(0.30 0.06 var(--accent-hue));
  --accent-fg:    oklch(0.15 0.02 var(--accent-hue));
  --accent-ring:  oklch(0.72 0.15 var(--accent-hue) / 0.45);
}
[data-theme="blueprint"] {        /* light: accent must be dark enough to read */
  --accent:       oklch(0.48 0.14 var(--accent-hue));
  --accent-hover: oklch(0.42 0.15 var(--accent-hue));
  --accent-muted: oklch(0.92 0.04 var(--accent-hue));
  --accent-fg:    oklch(0.98 0.01 var(--accent-hue));
  --accent-ring:  oklch(0.48 0.14 var(--accent-hue) / 0.45);
}
[data-theme="phosphor"] {         /* high contrast: clamp chroma hard */
  --accent:       oklch(0.80 0.11 var(--accent-hue));
  --accent-hover: oklch(0.86 0.12 var(--accent-hue));
  --accent-muted: oklch(0.26 0.05 var(--accent-hue));
  --accent-fg:    oklch(0.12 0.02 var(--accent-hue));
  --accent-ring:  oklch(0.80 0.11 var(--accent-hue) / 0.45);
}
```

One CSS variable set on `<html>` from the profile. No JS colour maths at runtime. No per-user
stylesheet.

### Twelve presets, not a colour wheel

Ship 12 named hues at 30° spacing, each pre-verified for AA on all three themes and checked
under protanopia/deuteranopia. A free wheel gives you infinite untested combinations and a
CVD hazard; twelve presets give ownership with zero risk — and naming them is more memorable
anyway.

Name them from the subject's own world: **Copper · Solder · Phosphor · Trace · Oscilloscope ·
Ferrite · Anode · Silicon · Flux · Bus · Ground · Magnet.**

### Scope — what the accent may and may not colour

| May | May **not** |
|---|---|
| Their node on the stage map | Correct / incorrect feedback |
| Their progress rings and mastery bars | Danger, warning, success states |
| Register Bar highlight | Lock states |
| Their Engineer's Log cover and certificate | Anything in Lecture Mode aggregates (anonymity) |
| Focus rings and selection | Any other student's data |

**Semantic colours are never derived from the accent.** Red must always mean danger and green
must always mean success, regardless of what hue the student chose. Some palette generators will
happily derive semantics from your primary; don't — it breaks colour-blind safety and it breaks
learned meaning.

### Tools for building and verifying the twelve
- https://oklch.com — the standard OKLCH picker
- https://www.inclusivecolors.com — <cite index="87-1">shows whether colours meet WCAG and APCA contrast requirements</cite>
- https://accessibility.build/tools/accessible-palette-studio — <cite index="84-1">state-aware WCAG + APCA grading and colour-blindness simulation</cite>
- https://oklchcolorpalettegenerator.com — Tailwind v4 variable export

**Audit:** add INV-26 — every one of the 12 preset hues passes AA against all three themes, and
no two presets are indistinguishable under deuteranopia. Run it in CI.

---

## 5. Game feel — and the one trap to avoid

<cite index="69-1">Duolingo fires a confetti explosion on lesson completion, timed immediately after the trigger so cause and effect is obvious, with the amount and vibrancy scaled to the level of achievement so bigger milestones feel more special.</cite>

The scaling is the part people copy wrong. Confetti on *every* question is noise by week three.
**One celebration per stage — the Bring-Up — and nothing else.** Correct answers get a 120ms
accent flash. That's it.

The finding that matters most for your audience:
<cite index="76-1">wrong answers should trigger gentle animations and encouraging feedback, not red error screens — users need to feel safe making mistakes to learn, and the visual design has to reinforce that safety.</cite>

This is the same conclusion your Petal 8 caution reached from the CS test-anxiety research. So:
incorrect answers get a **neutral low tick and a calm rationale card**, never a buzzer, never a
red flash, never a shake. Your app is for students who are already anxious about a hard course.

Two more borrowings, both cheap:
- <cite index="76-1">Layered progress means something is always advancing, even on a bad day.</cite> Your layers: objective mastery, stage completion, subsystems online, badges, notebook entries. A student who fails a Check still added a notebook entry and a mistakes-deck card.
- Vary the activity type. Your spec already has six (MC, T/F, numeric, matching, ordering, diagram-label) plus three simulators. Rotate them within a stage rather than running six MCQs in a row.

---

## 6. More content for the topic — expand from here

Your two decks are Null & Lobur Chapter 1 plus a Day 1 languages deck. These are the references
to build Stages 09–17 from.

**Simulators to study before building yours (Stage 13/15/16)**
- **MarieSim** *(reference only — this course uses TASM x86-16, see TOOLCHAIN-CORRECTION.md)* — <cite index="77-1">a MARIE-architecture simulator for teaching beginning computer organization, where students observe how assembly statements affect registers and memory, with an integrated assembler and data path simulator.</cite> Written by Null & Lobur — the same authors as your Chapter 1 deck, so it matches your material exactly. https://dl.acm.org/doi/abs/10.1145/982753.982754
- **Little Man Computer** — the 1965 Madnick/Donovan paradigm. Open-source web implementation to read: https://github.com/IbrahimAni/LittleManSim
- **Knob & Switch Computer** — the incremental-reveal design that inspired the Bring-Up (§1)
- **Nand2Tetris** — https://www.nand2tetris.org — the canonical gates-to-computer curriculum, and a good structural model for your Stage 10 → 15 progression

**Research worth citing in the thesis**
- Kawash, *Where Do Students Struggle Most in a First Course on Assembly Language?* (WCCCE 2024)
  — **use this to weight your item bank.** Concentrate items where students actually fail rather
  than spreading them evenly.
- Wörister & Knobelsdorf, *Block-Based Programming in Low-Level Computing: How Blocks Facilitate
  Learning Assembler* (EDUCON 2025) — **directly actionable:** make the **Guided** difficulty tier
  in Stage 15 block-based, and Standard/Challenge text-based. That's a research-backed
  differentiation, not a guess.
- <cite index="71-1">Reviews of gamification in learning report positive outcomes for motivation, engagement and enjoyment, but do not identify which specific gamification elements produce them — the interactions between elements and learning outcomes at the micro level remain understudied.</cite> **That gap is your thesis contribution.** You have per-item, per-mechanic telemetry. You can measure which petal actually moves mastery — almost nobody in this literature can.

**Topics to add if you want more depth per Act**
- Act II: floating-point edge cases (denormals, NaN, catastrophic cancellation); Gray code; error
  detection — parity, checksums, Hamming codes
- Act III: pipelining and hazards; microprogrammed vs hardwired control (already named in your
  deck's Level 1); interrupt handling
- Act IV: virtual memory and paging; RAID; SPEC benchmarks; power/thermal limits and the end of
  Dennard scaling — the modern sequel to the Moore-vs-Rock collision your deck sets up

---

## 7. Design templates for the *learning* surface

The console templates are in `DESIGN-REFERENCES.md`. These are for the student side.

| Source | Link | Use for |
|---|---|---|
| LMS topic index | https://github.com/topics/learning-management-system | Browsing real learner-dashboard layouts |
| Student dashboard index | https://github.com/topics/student-dashboard | Progress and roster patterns |
| **husnulfk/demo-fe-lms** | https://github.com/husnulfk/demo-fe-lms | <cite index="67-1">React + Vite + TailwindCSS, frontend-only with mock data, showing manager and student dashboards.</cite> Same stack as ours. Best flow reference on this list. |
| whatDeepak/lms-project | https://github.com/whatDeepak/lms-project | <cite index="65-1">shadcn/ui + Tailwind + Framer Motion + Zod + Zustand.</cite> Read its motion patterns. |
| LMS template roundup | https://adminlte.io/blog/lms-dashboard-templates/ | Comparison with screenshots |

**Important caveat:** almost every LMS template is shaped like a **course marketplace** — catalog,
pricing, enrollment, instructor payouts. OCTA is a **single-course cohort tool**. Take the learner
dashboard, the progress components, and the lesson-reader layout. Delete everything commerce.
Don't let a template's information architecture drag you toward building a Udemy clone.

Gamification UI reading:
- https://blakecrosley.com/guides/design/duolingo — the sharpest analysis of *why* it works
- https://www.uinkits.com/blog-post/how-to-design-like-duolingo-gamification-engagement
