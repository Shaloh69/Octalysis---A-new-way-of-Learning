# STAGE-ENCOUNTERS.md
### What a student actually touches at each node

`PAGE-SPECS.md` says what routes exist. `LESSON-PLAN-AND-LEVELS.md` says which archetype each
stage uses. **This file says what the interaction physically is** — the thing under the student's
finger.

**The rule that governs all of it:** vary the *practice*, keep the *assessment* steady. Week 9
should not feel like week 3, so the learning beats differ wildly. But a graded Self-Test must use
formats the student has already practised. Meeting a brand-new interaction for the first time
*during* a graded assessment tests the interface, not the concept — and that's the anxiety pattern
the brainstorm template flags.

So: drag gates around freely in Stage 10's lab. The Self-Test that follows uses formats the student
has already met — including interactive ones like ordering and diagram-labelling, but ones they
have *practised*. `DESIGN-MANDATE.md` §2 makes this checkable as **INV-31**: no graded item may use
a format the student has not met ungraded.

---

## 0. The skill tree is the curriculum

The map between nodes is not a layer on top of the syllabus — **the tree's connections *are* the
prerequisites, and the prerequisites *are* the syllabus order.** Week 1 is Stage 00–01, week 5 is
Stage 07, week 14 is Stage 17. `stages.prereq` in `db/schema.sql` is the single edge list, and
`is_stage_unlocked()` is the only thing that decides whether a node is lit.

What the tree adds over a list is **legibility of the ordering**. A syllabus is a list of weeks; a
tree shows why the order exists. Stage 13 (fetch–decode–execute) sits above Stage 12 (von Neumann)
because you cannot trace a cycle through a machine you cannot describe. That argument is invisible
in a list and obvious in a shape.

**Three genuine forks**, and they are real in the seed data, not decorative:

| Fork | Meaning |
|---|---|
| After **07** → 08 or 09, either order | Both list `{07}` as their only prerequisite |
| After **13** → 14 or 16, either order | Both list `{13}` as their only prerequisite |
| **15** needs both **03** and **14** | You cannot write assembly until you have met mnemonics *and* instruction encoding |

Small, but real. And the teacher overrides any of it from the lock matrix, so if the class runs
ahead or behind, **the tree bends to the class rather than the class to the tree.**

> The full graph — 18 nodes, 20 edges, four forks, three joins, the 15-node critical path, and the
> fact that Stage 08 is currently a dead end nothing depends on — is derived and drawn in
> **`SKILL-TREE-3D.md` §1**, along with the galaxy rendering, the spatial grammar, and the
> accessible DOM layer that is the actual source of truth.

---

## The encounter table

| Stage | Arch | The interaction | Primary element |
|---|---|---|---|
| **00** Boot Sequence | — | Pick a theme and accent, meet your seeded avatar, ungraded diagnostic. Power rail lights. | accent picker |
| **01** What Programming Is | A | **Card sort** — twenty statements into natural language vs programming language | drag + tap fallback |
| **02** Machine Language | C | **Eight toggle switches.** Flip bits, watch Figure 1.1's instruction assemble byte by byte | switch bank |
| **03** Assembly Language | C | **Split pane** — type `ADD`, the opcode appears opposite. Then mnemonic ↔ opcode matching | two-column editor |
| **04** High-Level Languages | C | **The payroll remix.** Sliders for hours and rate; three panes update live — BASIC (Fig 1.3), assembly, machine code | linked panes |
| **05** Why Assembly | C | A real ESP32 register write in C, then its disassembly. **Find the time-critical section** | annotated listing |
| **06** Org vs Architecture | A | **Card sort**, twenty statements into two buckets | drag + tap fallback |
| **07** Units & Cycle Time | B | **Bench instrument** — turn a frequency dial, cycle time reads out in mono. Then infinite re-rollable numeric drill | rotary dial + readout |
| **08** Spec Sheet | C | A 2026 spec sheet with **clickable hotspots**. Decode each line. Then: which machine is faster, and why | hotspot overlay |
| **09** Number Systems | B | **Bit-flip toggles** for two's complement at 8 and 16 bits. Watch overflow happen live | bit array |
| **10** Digital Logic | D | **Drag gates onto a canvas and wire them.** Build a half adder. The truth table fills as you go | node canvas |
| **11** Level Hierarchy | A | **Order the seven levels** — then the Depth Gauge reveal | ordering list |
| **12** von Neumann | A | **Assemble the data path** by dragging components into place. Watch the bottleneck constrict | slot diagram |
| **13** Fetch–Decode–Execute | D | **The stepper.** Play / pause / step with live 8086 registers. Predict the next value before you step | Register Bar, live |
| **14** Instruction Set | D | **Instruction encoder** — pick fields, build the byte, see the hex. Real MOD-REG-R/M | field builder |
| **15** Writing Assembly | D | A real **code editor**. Write TASM x86-16, run it, watch registers. Then: here's a program that crashes — fix it | editor + VM |
| **16** Memory Hierarchy | B | **Cache simulator.** Tune size, block size, associativity to beat a 90% hit rate | slider rig |
| **17** Performance | B | **Upgrade puzzle** — one budget, several components, which do you buy? Amdahl's Law decides the winner | budget allocator |

Stages **10, 15, and 16** are the most game-like. Building a half adder from gates and tuning a
cache to hit a target are genuine puzzles, not quizzes wearing a costume.

---

## Assessment tiers — the "boss fights"

Don't call them bosses. Every computer runs a **POST — Power-On Self Test** — at startup. That is
real hardware vocabulary, and it does the work a boss fight does without the arcade skin a college
CpE audience will roll their eyes at.

| Tier | When | What |
|---|---|---|
| **Subsystem Self-Test** | End of every stage | The graded Concept Check. Seeded, unique per student. |
| **Bench Test** | After Stage 10 | Cumulative across Acts I–II. Optional, ungraded by default — the teacher can make it count. |
| **Power-On Self Test** | Week 14 | The 70-item final. Every subsystem you brought online, tested at once. |

The POST screen is the one place the app allows itself real theatre: the Register Bar goes live,
subsystems check in one at a time as you clear their sections, and the Depth Gauge lights bottom
to top on submit. Two seconds of it. Then the score.

---

## What each encounter needs to exist

For Claude Code, per stage:

- [ ] `content_blocks` rows of the right `kind` for the archetype (INV-27 enforces this)
- [ ] The interaction component, keyboard-operable and tap-operable
- [ ] At least 4 live parameterized templates for archetype **B** stages
- [ ] The artifact file (listing, spec sheet, source) for archetype **C** stages
- [ ] The simulator mounted as `kind='sim'` for archetype **D** stages
- [ ] A Bring-Up subsystem symbol from `packages/tokens/elements.svg`
- [ ] Objectives tagged with `level` and `competency` (INV-28)

---

## Reuse, deliberately

Nine of the eighteen encounters are built from **four** components. Don't build eighteen bespoke
interactions — you'll ship five of them and run out of semester.

| Component | Used by |
|---|---|
| `<CardSort>` | 01, 06 (and every matching item type) |
| `<BitArray>` | 02, 09, 14 |
| `<SliderRig>` | 04, 07, 16, 17 |
| `<NodeCanvas>` | 10, 12 (and 13's data path view) |

Four components, parameterized by content. That's the difference between an achievable P5–P6 and
a wishlist.
