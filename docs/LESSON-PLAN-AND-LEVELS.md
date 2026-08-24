# LESSON-PLAN-AND-LEVELS.md
### How the game maps onto the actual lesson plan, and the level system

---

## 1. The honest answer first: no, the loop did not tightly follow the plan

`GAME-LAYER.md` §2 defines one seven-beat loop —
`BRIEF → LEARN → PROBE → LAB → CHECK → BRING-UP → LOG` — and applies it to every stage.

**That's wrong, and checking it against your actual decks is how you find out.**

| Stage | What the source material actually is | Does the loop fit? |
|---|---|---|
| 00 Boot Sequence | orientation, no content | **No.** No LEARN, no CHECK |
| 01 What Programming Is | one slide of prose (deck s2) | **No lab is possible.** Nothing to manipulate |
| 02 Machine Language | 3 slides + Figure 1.1 listing | Fits, but the "lab" is really *reading a listing* |
| 03 Assembly Language | 3 slides + Figure 1.2 listing | Same |
| 04 High-Level Languages | 7 slides + Figures 1.3, 1.4 | Fits well — richest stage in the Day 1 deck |
| 05 Why Assembly Matters | **2 slides of bullets, nothing else** | **Thinnest stage in the course.** No lab, barely a lesson |
| 06 Org vs Architecture | 2 conceptual slides | No lab |
| 07 Units & Cycle Time | 5 slides, all computation | **Doesn't want a lab — wants drilling** |
| 08 Reading a Spec Sheet | one image, repeated 8× | Almost no prose; it's *all* lab |
| 11 Level Hierarchy | 7 slides + one figure | No lab; wants sorting/ordering |
| 13 Fetch–Decode–Execute | 5 slides, ALU1–ALU4 | Fits perfectly — this is what the loop was designed around |

The loop was designed around Stage 13 and then assumed everywhere. Two stages (05, 08) are
nearly inverted from it, and five have no possible lab beat.

### The fix: four stage archetypes

One loop skeleton, four variants. Every stage declares its archetype in `stages.archetype`.

**A · Concept** — stages 01, 05, 06, 11, 12
`BRIEF → LEARN → PROBE → SORT → CHECK → BRING-UP → LOG`
The `SORT` beat replaces the lab: classify, order, or match. Stage 06 sorts statements into
*organization* vs *architecture*. Stage 11 orders the six abstraction levels. Cheap to build,
and it's real cognitive work rather than a fake sandbox.

**B · Computation** — stages 07, 09, 16, 17
`BRIEF → LEARN → PROBE → DRILL → CHECK → BRING-UP → LOG`
`DRILL` is unlimited, ungraded, re-rollable parameterized items. No sandbox — these stages want
repetition with different numbers, which is exactly what your engine already does. Stage 07 is
the flagship: cycle time, unit conversion, powers of 2 vs 10.

**C · Artifact** — stages 02, 03, 04, 08
`BRIEF → LEARN → TRACE → REMIX → CHECK → BRING-UP → LOG`
Built around a real listing or document from the deck. `TRACE` walks it line by line with
annotation. `REMIX` lets the student change it and see the result. Stage 04's remix of the
Figure 1.3 payroll program is the best single feature in the app.

**D · Simulator** — stages 10, 13, 14, 15
`BRIEF → LEARN → LAB → BUILD → BREAK → CHECK → BRING-UP → LOG`
The full loop. `BUILD` = author your own; `BREAK` = misconfigure deliberately and **predict the
failure before running**. The prediction is the assessment.

**Stage 00** has its own shape: `WELCOME → SETUP → DIAGNOSTIC → BRING-UP(power)`. Diagnostic is
ungraded and never counts.

### Stage 05 needs content, not a loop

Your Day 1 deck gives Stage 05 two slides of bullets — the advantages of assembly and the reasons
for using it. That is 8 minutes of material for what should be the emotional payoff of Act I
("here's why you're taking this course").

**Fix it with material you already have access to:** the TSR/ISR point in the deck opens directly
onto their ESP32 work. Make Stage 05 archetype **C**, and the artifact is a real ESP32 register
write — `GPIO.out_w1ts` — shown in C and then in the compiled disassembly. Same concept as the
deck's "recode time-critical sections in assembly," but on hardware they have in their hands.

---

## 2. Week-by-week lesson plan

Stage 00 is orientation. **17 graded stages** follow it. (See `VERIFICATION.md` finding V-1 — the
docs previously said "17 stages" while the schema seeds 18 rows, 00–17.)

| Week | Stages | Archetype | Deck source | Contact focus |
|---|---|---|---|---|
| 1 | 00, 01 | —, A | s1–s2 | Orientation + what programming is |
| 2 | 02, 03 | C, C | s3–s8, Fig 1.1–1.2 | Machine code and mnemonics, side by side |
| 3 | 04, 05 | C, C | s9–s17, Fig 1.3–1.4 | Payroll remix; why assembly |
| 4 | 06 | A | Ch1 §1.1–1.2 | Org vs arch, Principle of Equivalence |
| 5 | 07 | B | Ch1 §1.3 | **Drill week.** Units, Hz, cycle time |
| 6 | 08 | C | Ch1 §1.3 ad | Decode a 2026 spec sheet vs the 2005 one |
| 7 | 09 | B | new | Number systems, two's complement, IEEE-754 |
| 8 | 10 | D | new (Ch1 L0) | Gates, truth tables, K-maps, adders |
| 9 | 11, 12 | A, A | Ch1 §1.6–1.7 | **The reveal** (see §3), von Neumann, the bottleneck |
| 10 | 13 | D | Ch1 ALU1–4 | Fetch–decode–execute, fully steppable |
| 11 | 14 | D | new | ISA, instruction formats, addressing modes |
| 12 | 15 | D | new | Writing TASM x86-16 assembly |
| 13 | 16 | B | Ch1 cache + new | Memory hierarchy, hit ratio, AMAT |
| 14 | 17 + capstone | B | Ch1 §1.5, §1.8 | Moore vs Rock, Amdahl, non-von Neumann, capstone trace |

**Content volume warning:** the stages sum to roughly 985 minutes (~16.5 hours) of core reading
and lab. That is a *companion* to 14 weeks of lectures, not a replacement for them. The remaining
time is carried by drilling, labs, and the item bank — which means **the item bank is the schedule**,
not a side task. See `VERIFICATION.md` finding V-6.

---

## 3. The level system — the twist

Standard LMS gamification: complete lessons, earn XP, level up. The number means nothing.

**In OCTA, the level system *is* the course content.**

Chapter 1 §1.6 of your own deck defines the Computer Level Hierarchy:

```
  L6  User Level                    ← where every student starts
  L5  High-Level Language
  L4  Assembly Language
  L3  System Software
  L2  Machine / ISA
  L1  Control
  L0  Digital Logic                 ← where the course ends
```

So a student's level is **not a score that goes up. It is how deep into the machine they can
currently see.** You begin at L6, able to see only the user interface. Every stage descends you.
By Stage 10 you can see L0.

### The Depth Gauge

A vertical seven-segment indicator down the left edge of the app. Levels you've reached are lit
and labelled; levels below are dim strata you haven't broken into yet. It replaces the XP bar
entirely.

Clicking a lit level filters the whole app to that level: your notebook entries, your glossary,
your badges, the artifacts you can view.

### The same artifact, at every level — the actual mechanic

This is the part that no LMS does, and it comes straight out of your Figure 1.3.

The payroll program exists **simultaneously at five levels**:

| Level | What you see |
|---|---|
| L5 | `gross = hours * rate` — the BASIC from Figure 1.3 |
| L4 | the assembly, in Figure 1.2's style |
| L2 | the machine code, in Figure 1.1's style |
| L1 | the control signals and register transfers driving it |
| L0 | the adder that performs the multiply-accumulate |

**As your depth increases, you unlock more lenses on the same object.** A student in week 3 sees
one line of BASIC. The same student in week 12 sees five simultaneous views of that identical
line and can switch between them. The artifact never changes — their sight does.

That is the thesis demo. It's also the most honest possible expression of what "abstraction
layers" means, and it's *literally the content of Chapter 1 §1.6*.

### Stage 11 is the reveal

Stage 11 teaches the Computer Level Hierarchy explicitly. By then the student has been descending
it for ten weeks without being told what it was called.

Week 9 is the moment the Depth Gauge gets named: *"the thing on your left edge is Figure 1.5.
You've been reading it since day one."* Frame the whole lesson plan around landing that moment.

### Stage → level mapping

| Stage | Levels touched |
|---|---|
| 01 | L6 |
| 02 | L2 |
| 03 | L4 |
| 04 | L5, L3 (compilers and interpreters are themselves programs) |
| 05 | L4, L3 |
| 06 | spans all — org vs arch is the axis, not a level |
| 07, 08 | L6, L2 |
| 09 | L2, L0 |
| 10 | **L0** |
| 11 | **all seven, named** |
| 12 | L2, L1 |
| 13 | **L1** |
| 14 | L2 |
| 15 | L4 |
| 16 | L3, L2 |
| 17 | L1, L0 and beyond |

---

## 4. Competency, not XP: the 7 × 3 grid

Depth says *how far down you can see*. Competency says *what you can do there*. Three states per
level, in ascending order:

| State | Means |
|---|---|
| **Read** | You can interpret an artifact at this level |
| **Trace** | You can follow execution through it |
| **Build** | You can produce one yourself |

Seven levels × three states = **21 cells**. That grid is `/app/progress`, and it replaces every
progress bar in the app.

Worked example — Level 4, Assembly:
- **Read** — you can say what `mov ax, dseg` does (Stage 03)
- **Trace** — you can follow an x86-16 program's register changes (Stage 13)
- **Build** — you can write one that loops (Stage 15)

The grid is honest in a way XP never is. A student can point at it and say a true sentence about
themselves: *"I can read and trace at the machine level, and build at the assembly level."* That
sentence is a job interview answer. "Level 14, 2,400 XP" is not.

### Three progression axes, all meaning something real

| Axis | Unit | Where it shows | Driven by |
|---|---|---|---|
| **Depth** | 7 levels | Depth Gauge, left edge | Stage completion |
| **Competency** | 21 cells | `/app/progress` grid | Per-objective mastery |
| **Hardware** | subsystems online | `/app/machine` | Bring-Up on stage completion |

None of them is a point score. All three are always advancing on any given day — which is the
layered-progress property that makes a bad day survivable, without inventing a currency.

### Schema additions

```sql
alter table stages add column archetype char(1) not null default 'A'
  check (archetype in ('A','B','C','D'));
alter table stages add column levels int[] not null default '{}';   -- e.g. '{5,3}'

alter table objectives add column level int check (level between 0 and 6);
alter table objectives add column competency text
  check (competency in ('read','trace','build'));

create table level_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  level      int  not null check (level between 0 and 6),
  competency text not null check (competency in ('read','trace','build')),
  mastery    numeric(4,3) not null default 0,
  attained_at timestamptz,
  primary key (user_id, level, competency)
);
alter table level_progress enable row level security;
create policy lp_own on level_progress for select
  using (user_id = auth.uid() or is_staff());
```

`level_progress.mastery` is **derived**, not written directly — recompute it from
`stage_progress` and the objectives at that (level, competency) pair. Deriving it means it can
never disagree with the underlying evidence.

**Every objective must now declare a level and a competency.** That's a real authoring cost —
about 70 objectives to tag — but it's what makes the grid trustworthy rather than decorative.

---

## 5. Does the loop follow the plan now?

Yes, and it's checkable. Add these to the audit suite:

- **INV-27** — every stage has an archetype, and every archetype's required beats exist as
  `content_blocks` of the right `kind`. A type-D stage with no `kind='sim'` block is a
  misconfigured stage.
- **INV-28** — every published stage has at least one objective, and every objective has a level
  and a competency.
- **INV-29** — every level 0–6 is touched by at least one stage, and every one of the 21
  competency cells is reachable by at least one objective. **If a cell is unreachable, a student
  can never complete the grid** — and they will notice.
