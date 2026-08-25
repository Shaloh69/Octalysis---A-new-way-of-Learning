# LAB-MANUAL.md
### CPE 412 — eighteen laboratory exercises, authored for OCTA

The syllabus allots **3 laboratory hours** alongside 3 lecture units, weights
**Laboratory Exercises at 10%**, requires they be **submitted on time**, and names
**Simulation Software** as a learning resource on nearly every chapter.

It does not prescribe the exercises. These are ours.

---

## 0. How these are designed

### 0.1 The rule every lab obeys

From `GAME-DESIGN.md` §8.3, and it is not a style preference:

> **The lab's core VERB must be the objective's verb.**

Strip the theme and the tooling away. If what remains is still the learning
objective, the lab is content. If it is a different activity wrapped around a
quiz, it is a **seductive detail** — and the research on those is that they
*measurably reduce* comprehension and transfer.

Every lab below states its verb. If you add one, state its verb too.

### 0.2 Three tiers of lab, by cost

| Tier | Build cost | Used for |
|---|---|---|
| **A — Paper/DOM** | Low. Forms, tables, drag-and-drop | Computation, classification, reading an artifact |
| **B — Simulator** | High. A real model with real state | Anything where the *behaviour over time* is the concept |
| **C — External tool** | Low to build, high to support | Where a real industry tool teaches more than we could model |

**Ten of eighteen are Tier A.** That is deliberate: Tier A labs can ship for
the whole semester while Tier B is still being built, and a lab that exists beats
a simulator that is planned.

### 0.3 Submission and grading

Every lab produces **one artifact** — a completed worksheet, a saved
configuration, a short written justification, or a screenshot with annotation.

Graded on a **4-point rubric**, identical across all eighteen so students learn
it once:

| Points | Criterion |
|---|---|
| 4 | Correct, complete, and the reasoning is stated |
| 3 | Correct and complete; reasoning thin or missing |
| 2 | Partially correct, or complete with a conceptual error |
| 1 | Attempted, substantially incorrect |
| 0 | Not submitted |

**Reasoning is worth a full point on every lab.** A right answer with no
explanation caps at 3. That is the single most important line in this manual —
it is what separates a lab from a quiz, and it is what makes the 10% worth
having.

### 0.4 Academic honesty

Labs are individual unless stated. Where a lab draws on parameterized data, each
student's numbers come from their own seed — so two students comparing answers
find different numbers and have to compare *method*, which is the point.

---

## 1. The eighteen labs

### LAB 01 — Organization or Architecture?
**Chapter 1 · Tier A · Archetype A · 1 hr**

**Verb:** *classify* — matching objective: differentiate organization from architecture.

Twenty statements about a computer system. Sort each into **Architecture**
(visible to the programmer, affects logical execution) or **Organization**
(how it is realised, invisible to the program).

Deliberately included: several that students reliably get wrong — instruction
set (arch), whether multiply is implemented by a dedicated unit or repeated
addition (org), memory addressing modes (arch), the control signals that
implement them (org).

**Artifact:** the completed sort, plus **one sentence** on the hardest three and
why.

**Why the reasoning matters:** the boundary is the whole lesson. A student who
sorts correctly by pattern-matching has learned nothing.

---

### LAB 02 — Reading a Performance Claim
**Chapter 2 · Tier A · Archetype B · 1 hr**

**Verb:** *compute and compare* — matching: compute CPI, MIPS, MFLOPS; apply
Amdahl's Law.

Given two real processor spec sheets (2015 and 2025), compute for each: clock
period, CPI from a given instruction mix, MIPS rate. Then: a proposed
optimisation makes floating-point 4× faster; floating point is 25% of the
workload. **Compute the overall speedup with Amdahl's Law, then state in one
sentence why the marketing number differs.**

Numbers are **parameterized per student** — everyone gets different processors.

**Artifact:** worked computation with units at every step, plus the sentence.

**The point:** Amdahl's Law is the antidote to the whole "faster processor"
marketing frame. This lab exists so that Stage 17 can call back to it.

---

### LAB 03 — Trace the Instruction Cycle
**Chapter 3 · Tier B · Archetype D · 2 hr**

**Verb:** *trace* — matching: draw the instruction cycle state diagram; identify
the registers used during execution.

A stepping simulator with PC, IR, MAR, MBR and AC visible. Given a short program,
**predict the contents of every register before each step**, then step and check.

**Predict-before-step is the assessment**, not the animation. The commitment is
what makes the mental model explicit.

Second half: the same program, but an **interrupt fires** mid-execution. Trace
what is saved, where, and in what order.

**Artifact:** the prediction table with a hit/miss column, plus an explanation of
each miss.

**Build cost note:** this is one of the four genuine simulators. If it is not
ready, LAB 03 runs on paper with a printed register table and loses very little.

---

### LAB 04 — Cache Mapping by Hand
**Chapter 4 · Tier A · Archetype B · 2 hr**

**Verb:** *compute and map* — matching: compute cache addresses and size;
illustrate memory mapping.

Given a memory size, cache size and block size, split a stream of addresses into
**tag / line / word** fields for direct-mapped, then fully associative, then
2-way and 4-way set-associative. Count hits and misses for each. Compute the hit
ratio and **AMAT**.

Then the argument: **which mapping wins for this access pattern, and why** — and
one where the answer reverses.

Parameterized per student.

**Artifact:** the four completed mapping tables, hit ratios, AMAT, and the
comparison paragraph.

**Why it is Tier A:** cache mapping is arithmetic on bit fields. A simulator
would let a student get the right answer without ever splitting an address, which
is the skill.

---

### LAB 05 — Inside the Chip: DRAM and ECC
**Chapter 5 · Tier A · Archetype C · 1.5 hr**

**Verb:** *read a datasheet and encode* — matching: illustrate DRAM cell
structure; define error correction code.

Part 1: a real DDR4 datasheet excerpt. Identify organisation (banks, rows,
columns), find tRCD/tRP/tRAS, and **compute the theoretical peak bandwidth**.

Part 2: **Hamming code by hand.** Encode an 8-bit word, inject a single-bit
error, and show the syndrome locating it. Then inject two errors and show why
SEC-DED detects but cannot correct.

**Artifact:** annotated datasheet extract, and the worked Hamming encode/decode.

---

### LAB 06 — RAID Under Failure
**Chapter 6 · Tier A · Archetype C · 1.5 hr**

**Verb:** *choose under constraint* — matching: identify and discuss the RAID
levels.

Four scenarios with different requirements — a video editing scratch volume, a
student records database, a home NAS, a write-heavy log server. For each:
**choose a RAID level, compute usable capacity from N disks, state how many
simultaneous failures it survives, and name the write penalty.**

Then: one scenario where the "obvious" choice is wrong. Justify.

**Artifact:** the four decisions with capacity/failure/penalty computed, and the
justification for the trap case.

---

### LAB 07 — Three Ways to Move a Byte
**Chapter 7 · Tier B · Archetype D · 2 hr**

**Verb:** *compare mechanisms by tracing them* — matching: programmed vs
interrupt-driven vs DMA.

The same transfer — read 512 bytes from a device — implemented three ways in a
stepping simulator. For each, count: **CPU cycles consumed, bus transactions,
and how many cycles the CPU was free to do other work.**

The result is the lesson: DMA does not make the transfer faster, it makes the
*CPU* free. Students consistently expect the former.

**Artifact:** the three cycle counts, and a paragraph on what DMA actually buys.

---

### LAB 08 — Scheduling and Paging
**Chapter 8 · Tier B · Archetype D · 2 hr · ★ feeds the Project**

**Verb:** *simulate a policy and defend it* — matching: OS scheduling and memory
management.

Part 1: given a process set with arrival and burst times, produce Gantt charts
and compute average waiting and turnaround time for **FCFS, SJF, Round Robin
(two quanta), and Priority**. Identify starvation where it occurs.

Part 2: given a reference string and frame count, count page faults for **FIFO,
LRU and Optimal**. Demonstrate **Bélády's anomaly** with FIFO.

**Artifact:** charts, tables, and a recommendation with justification.

**This lab is the on-ramp to the 20% Project** — "a real life OS algorithm
design and implementation case". A student who does this lab well has the
vocabulary the project assumes.

---

### LAB 09 — Number Systems Workbench
**Chapter 9 · Tier A · Archetype B · 2 hr**

**Verb:** *represent and compute* — matching: integer and floating-point
representation and arithmetic.

Part 1: convert between decimal, binary, octal, hex. Then **two's complement** at
8 and 16 bits: represent negatives, add, subtract, and **identify overflow by the
carry-in/carry-out rule** rather than by eye.

Part 2: **IEEE-754 single precision.** Encode a value by hand, decode a given
bit pattern, and demonstrate a case where `(a + b) + c ≠ a + (b + c)`.

Parameterized per student.

**Artifact:** the conversion table, the arithmetic with overflow flags, and the
IEEE-754 encode/decode with the associativity counterexample.

**The heaviest drill stage in the course.** Everything downstream assumes it.

---

### LAB 10 — Anatomy of an Instruction Set
**Chapter 10 · Tier A · Archetype C · 1.5 hr**

**Verb:** *read and categorise* — matching: machine instruction characteristics,
operand types, operation types.

A short x86 listing with a mix of instruction types. For each line: identify the
**operation class** (data transfer, arithmetic, logical, control transfer, I/O),
the **operand types**, and the **number of addresses**.

Then: rewrite three of them as they would appear in a **1-address** machine, and
count the extra instructions needed.

**Artifact:** the annotated listing and the 1-address rewrite with the count.

---

### LAB 11 — Encode an Instruction
**Chapter 11 · Tier B · Archetype D · 2 hr**

**Verb:** *encode* — matching: addressing modes and instruction formats.

A field-by-field encoder. Choose an operation, an addressing mode and operands;
**watch the instruction assemble byte by byte** with each field highlighted as it
is set. Real MOD-REG-R/M.

Then the reverse: given a hex byte sequence, **decode it back** to mnemonic and
operands.

Then: **the same operation in five addressing modes** — immediate, direct,
indirect, register, indexed — with the effective address computed for each and a
statement of when each is the right choice.

**Artifact:** encoded instructions, the decode, and the five-mode comparison.

---

### LAB 12 — Pipeline Hazards
**Chapter 12 · Tier B · Archetype D · 2 hr**

**Verb:** *identify and resolve hazards* — matching: instruction pipelining.

A pipeline diagram tool. Given an instruction sequence, draw the **space-time
diagram** for a 5-stage pipeline and identify every **data hazard (RAW, WAR,
WAW), control hazard, and structural hazard**.

Then resolve each three ways — **stalling, forwarding, reordering** — and count
the cycles saved by each.

**Artifact:** the annotated diagram, the hazard list, and the cycle counts for
each resolution.

---

### LAB 13 — RISC versus CISC, Argued
**Chapter 13 · Tier A · Archetype A · 1.5 hr**

**Verb:** *argue from evidence* — matching: the RISC versus CISC controversy.

Given the same routine compiled for a RISC and a CISC target, compare: **static
instruction count, dynamic instruction count, code size in bytes, and estimated
cycles**.

Then the assignment: **argue the side you did not expect to.** A student who
thinks RISC obviously wins argues for CISC, from the numbers in front of them.

**Artifact:** the comparison table and a one-page argued position.

**Why this is Tier A and archetype A:** this chapter is a genuine controversy,
not a calculation. The lab has to be an argument or it teaches the wrong thing.

---

### LAB 14 — Find the Parallelism
**Chapter 14 · Tier B · Archetype D · 2 hr**

**Verb:** *reorder under dependence constraints* — matching: instruction-level
parallelism and superscalar issues.

Given a basic block, build the **dependency graph**. Identify which instructions
can issue together on a 2-way and 4-way superscalar machine. Compute the **IPC**
achieved.

Then: apply **register renaming** to eliminate the WAR and WAW dependencies, and
recompute. Show where the true (RAW) dependencies impose a hard floor.

**Artifact:** dependency graph, issue schedule, IPC before and after renaming.

---

### LAB 15 — Micro-operations
**Chapter 15 · Tier B · Archetype D · 2 hr**

**Verb:** *decompose into micro-operations* — matching: micro-operations, control
of the processor.

Take three instructions. Decompose each into its **micro-operation sequence**,
clock cycle by clock cycle, naming **every control signal asserted** in each
cycle.

Then: given a partial control signal table, **fill in the missing signals** for
a fourth instruction.

**Artifact:** the three decompositions and the completed control table.

---

### LAB 16 — Write Microcode
**Chapter 16 · Tier B · Archetype D · 2 hr**

**Verb:** *write microcode* — matching: microinstruction sequencing and
execution.

A microcode editor over the control store. **Implement one new instruction** in
microcode — given its semantics, write the microinstruction sequence, choose the
sequencing (next-address vs increment), and run it.

Then: **break it on purpose.** Change one sequencing field, *predict what will go
wrong before running*, then run.

**Artifact:** the working microcode, and the prediction/outcome for the
deliberate break.

**Predict-before-run is the assessment.** Anyone can flip a field and observe.

---

### LAB 17 — The Upgrade Decision
**Chapter 17 · Tier A · Archetype B · 1.5 hr**

**Verb:** *allocate under constraint* — matching: multicore hardware and software
performance issues.

One budget, several possible upgrades — more cores, faster cores, more cache,
faster memory. Given a workload with a stated **parallelisable fraction**, use
**Amdahl's Law** to compute the speedup each purchase buys, and choose.

Then: change the parallel fraction and **show that the best purchase changes**.

**Artifact:** the speedup computation for each option at both fractions, and the
two decisions with justification.

**A deliberate callback to LAB 02.** Same law, week fifteen instead of week two,
and now the student can see why it governs the whole chapter.

---

### LAB 18 — Place the Boundary
**Chapter 18 · Tier A · Archetype A · 1.5 hr**

**Verb:** *argue a trade-off* — matching the chapter's outcomes: *explain the
advantages and disadvantages of different distributed systems architecture* and
*discuss client-server and distributed object architecture*.

One application, described in plain terms — a campus enrolment system, say, with
a database, some reporting, and a few hundred concurrent users. Three candidate
architectures are given: **two-tier client-server**, **three-tier
client-server**, and a **distributed object** arrangement in the style the CORBA
standards describe.

For each, the student states where the boundary between client and server falls,
which component does the work, and what crosses the wire. Then, for **three named
stresses** — user count triples, the reporting query gets expensive, one server
goes offline — they say what breaks first and why.

**Artifact:** the three-by-three table, plus a one-paragraph recommendation
naming the stress that decided it.

**No arithmetic, on purpose.** Chapter 18 is the one chapter of the course with
no computation in its outcomes — its verbs are *explain*, *discuss*, *identify*.
A lab that invented a formula here would be measuring something the chapter does
not teach. What is assessed instead is whether the student can hold three designs
side by side and say what each one costs. The rubric's reasoning point does the
work it was written for: an answer with no stated "because" caps at 3.

**This is the last stage on the map**, and the only leaf in the graph. It is
also the one lab that asks the student to design rather than trace — a
deliberate close, after seventeen chapters spent taking machines apart.

---

## 2. Build status and dependencies

| Tier | Labs | Status |
|---|---|---|
| **A — Paper/DOM** | 01, 02, 04, 05, 06, 09, 10, 13, 17, 18 | **Buildable now.** Forms, tables, parameterized numbers from the existing engine |
| **B — Simulator** | 03, 07, 08, 11, 12, 14, 15, 16 | Needs Track D. **Every one has a paper fallback** |

**Ten labs can ship without a single simulator.** Eight want one. None is
blocked outright, because each Tier B lab degrades to a printed worksheet that
loses the interactivity but keeps the exercise.

**Schema requirement:** none of this works without the `submissions` table
sketched in `CPE412-CURRICULUM.md` §6.3 — labs are graded and submitted, and
there is nowhere to put them today.

---

## 3. Mapping to the grading periods

| Period | Labs | Weight within the 10% |
|---|---|---|
| **Prelim** | 01–05 | 5 labs |
| **Midterm** | 06–09 | 4 labs |
| **Semi-finals** | 10–13 | 4 labs |
| **Finals** | 14–18 | 5 labs |

This mirrors the stage seed's 5/4/4/5 split exactly, and it has to — a lab
belongs to the same grading period as the chapter it assesses, or the 10% lands
in the wrong column. Chapter 1 is only one contact hour, which is what lets
Prelim carry five.

Eighteen labs across roughly eighteen teaching weeks is one per week with no
slack, and the four examination weeks eat into it. **Two of the Prelim labs are
short** (LAB 01 and LAB 02 are both under an hour) — that is the only give in
the schedule, so plan the doubled-up week there rather than in Finals.

---

## 4. What still needs the instructor

1. **Do these match the intended lab hours?** Each is scoped at 1–2 hrs against a
   3-hour lab block; the remainder is the lecture's hands-on portion.
2. **Is the 4-point rubric acceptable**, and is "reasoning worth a full point"
   the right emphasis?
3. **Individual or paired?** Written as individual. LAB 13's argue-the-other-side
   works well as a pair exercise.
4. **LAB 08 feeds the Project** — is that the intended relationship?
5. **Datasheets and listings** for LABs 05, 06 and 10 need real documents.
   Vendor datasheets are freely available but their redistribution licence needs
   checking before they are vendored into the repo.
