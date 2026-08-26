# CPE412-CURRICULUM.md
### The real syllabus, its topics, its references — and what it changes about OCTA

Extracted from `CPE 412.docx.pdf` in this repository. Everything in §1–§4 is
transcribed from that document, not inferred.

---

## 0. The finding, first

**CPE 412 is not the course OCTA was built for.**

| | OCTA as built | CPE 412 as documented |
|---|---|---|
| Course title | "Computer Systems & Assembly Language" | **Computer Architecture and Organization** |
| Source material | `day1-deck.md` (programming languages) + `chapter1-deck.md` (Null & Lobur ch.1) | **Stallings, *COA: Designing for Performance*, 9th ed.** |
| Prerequisite | none stated | **Microprocessors** |
| Assessment periods | one Final Knowledge Check | **four — Prelim, Midterm, Semi-finals, Finals** |
| Major output | none | **a 20% Project** |
| Lab | ungraded practice | **10% of the grade, submitted** |

Stages 01–05 as currently authored — what programming is, machine language,
assembly language, high-level languages, why assembly matters — **are not in
this syllabus.** They are prerequisite-level material, covered by Microprocessors
before a student reaches CPE 412.

**What survives, and it is the important half:** the syllabus has an orientation
block plus **eighteen chapters**. OCTA's architecture is Stage 00 plus eighteen
graded stages. The *shape* is exactly right; the *content* has to be replaced.

> **It was seventeen until the syllabus was read properly.** The first pass read
> the PDF, whose landscape table interleaves columns under `pdftotext`. Chapter
> 18, *Distributed Systems Architecture*, has an **empty topics cell** — so
> unlike every other chapter it left no fragment behind, and it vanished without
> a trace. Reading the DOCX instead, where table cells are discrete XML,
> recovered it along with all 110 unit outcomes. See `scripts/extract_syllabus.py`.

---

## 1. Course information, as documented

Transcribed from the syllabus. Credit where it is due: this document was
**prepared and approved by Engr. Roland B. Fernandez, MEP**, Faculty and
Dean/Program Head, College of Engineering.

| Field | Value |
|---|---|
| Institution | University of Cebu (UC), College of Engineering (COE) |
| Programme | BSCPE — Bachelor of Science in Computer Engineering |
| Governing issuance | CMO No. 87 series of 2017 |
| Course code | **CPE 412** |
| Course title | **Computer Architecture and Organization** |
| Prerequisite | Microprocessors |
| Co-requisite | None |
| Lecture units | 3 |
| Lab hours | 3 |
| School year / term | 2024-2025, 1st semester |
| Date effective | August 2025 |
| Date revised | 7 July 2025 |
| Prepared / approved by | Engr. Roland B. Fernandez, MEP |

**Course description, verbatim:**

> This course includes the study of the evolution of computer architecture and
> the factors influencing the design of hardware and software elements of
> computer systems. The focus is on the understanding of the design issues
> specifically the instruction set architecture and hardware architecture.

### 1.1 Assessment weighting

| Component | Weight | Remarks (from the syllabus) |
|---|---|---|
| **Project** | **20%** | "a real life OS algorithm design and implementation case … how the students will make judicious choices of OS algorithm design and constructs" |
| **Quizzes** | **30%** | chapter quizzes, long quizzes |
| **Major Examinations** | **30%** | **Prelim, Midterm, Semi-finals, Finals** |
| **Laboratory Exercises** | **10%** | |
| **Class Participation** | **10%** | seatwork, assignment |

### 1.2 Time allocation

Orientation 1 hr · Chapter 1 (Introduction) 1 hr · **every other chapter 3 hrs**.
Seventeen 3-hour blocks appear in the plan — chapters 2 through 18 — which with
the two 1-hour blocks (orientation and chapter 1) totals **53 lecture hours**,
consistent with 3 units over a standard term.

Teaching activities named throughout: Lecture · Discussion · **Hands-on
Laboratory**. Assessment tasks: Seat-work · Quiz · **Laboratory Exercises**.
Learning resources named: DLP · Computer/Laptop · **Simulation Software**.

> That last one matters. The syllabus itself calls for simulation software on
> almost every chapter. The simulator work in `GAME-DESIGN.md` Track D is not a
> flourish — it is what the course document asks for.

---

## 2. The eighteen chapters

Transcribed from §VII, *Teaching and Learning Plan*.

| # | Chapter | Hrs |
|---|---|---|
| — | University/College VMGO, PEO/PILO, CILO orientation | 1 |
| 1 | **Introduction** — 1.1 Organization and Architecture · 1.2 Structure and Function | 1 |
| 2 | **Computer Evolution and Performance** — 2.1 A Brief History (vacuum tubes, transistors, ICs, later generations) · 2.2 Designing for Performance · 2.3 Multicore, MICs, GPGPUs · 2.4 Evolution of the Intel x86 · 2.5 Embedded Systems and the ARM · 2.6 Performance Assessment (clock speed, benchmarks, **Amdahl's Law**, **Little's Law**) | 3 |
| 3 | **Top Level View of Computer Function and Interconnection** — 3.1 Computer Components · 3.2 Computer Function (instruction fetch/execute, interrupts, I/O) · 3.3 Interconnection Structures · 3.4 Bus Interconnection · 3.5 Point-to-Point Interconnect (QPI layers) · 3.6 PCI Express | 3 |
| 4 | **Cache Memory** — 4.1 Memory System Overview (characteristics, **the memory hierarchy**) · 4.2 Cache Memory Principles · 4.3 Elements of Cache Design (addresses, size, mapping) · 4.4 Pentium cache · 4.5 ARM Cache Organization | 3 |
| 5 | **Internal Memory** — 5.1 Semiconductor Main Memory · 5.2 Error Correction · 5.3 Advanced DRAM Organization | 3 |
| 6 | **External Memory** — 6.1 Magnetic Disk · 6.2 RAID · 6.3 Solid State Drives · 6.4 Optical Memory · 6.5 Magnetic Tape | 3 |
| 7 | **Input/Output** — 7.1 External Devices · 7.2 I/O Modules · 7.3 Programmed I/O · 7.4 Interrupt-Driven I/O · 7.5 Direct Memory Access · 7.6 I/O Channels and Processors · 7.7 The External Interface | 3 |
| 8 | **Operating System Support** — 8.1 OS Overview · 8.2 Scheduling · 8.3 Memory Management · 8.4 Pentium Memory Management · 8.5 ARM Memory Management | 3 |
| 9 | **Computer Arithmetic** — 9.1 The Arithmetic and Logic Unit · 9.2 Integer Representation · 9.3 Integer Arithmetic · 9.4 Floating-Point Representation · 9.5 Floating-Point Arithmetic | 3 |
| 10 | **Instruction Sets: Characteristics and Function** — 10.1 Machine Instruction Characteristics · 10.2 Types of Operands · 10.3 Intel x86 data types · 10.4 Types of Operations · 10.5 Intel x86 operations | 3 |
| 11 | **Instruction Sets: Addressing Modes and Format** — 11.1 Addressing · 11.3 Instruction Formats | 3 |
| 12 | **Processor Structure and Function** — 12.1 Processor Organization · 12.2 Register Organization · 12.3 Instruction Cycle · 12.4 **Instruction Pipelining** · 12.5 The x86 processor · 12.6 The ARM Processor | 3 |
| 13 | **Reduced Instruction Set Computers** — 13.1 Instruction Execution Characteristics · 13.2 Large Register File · 13.3 Compiler-Based Register Optimization · 13.4 Reduced Instruction Set Architecture · 13.5 RISC Pipelining · 13.6 MIPS R-series · 13.7 SPARC · 13.8 **RISC versus CISC Controversy** | 3 |
| 14 | **Instruction Level Parallelism and Superscalar Processors** — 14.1 Overview · 14.2 Design Issues | 3 |
| 15 | **Control Unit Operation** — 15.1 Micro-Operations · 15.2 Control of the Processor (control unit inputs, control unit logic) · 15.3 Hardwired Implementation | 3 |
| 16 | **Microprogrammed Control** — 16.1 Basic Concepts · 16.2 Microinstruction Sequencing · 16.3 Microinstruction Execution | 3 |
| 17 | **Multicore Computer** — 17.1 Hardware performance issues · 17.2 Software performance issues · 17.3 Multicore organization · 17.4 Intel x86 multicore | 3 |
| 18 | **Distributed Systems Architecture** — the topics cell is **empty in the syllabus**; the four unit outcomes are the whole specification: *explain the advantages and disadvantages of different distributed systems architecture* · *discuss client-server and distributed object architecture* · *discuss the underlying principles of the CORBA standards* · *identify the new models in distributed computing* | 3 |

---

## 3. References — the syllabus's own

Transcribed verbatim from §VIII, *Textbook(s) and References*, APA as printed.

**Textbook**

> Stallings, William. *Computer Organization and Architecture: Designing for
> Performance.* 9th Ed. Pearson Education, Inc.

**References**

> Hennessy, J. and Patterson, D. *Computer Architecture: A Quantitative
> Approach.* 5th Edition.
>
> Yadin, A. (2016). *Computer Systems Architecture.* CRC Press, Taylor & Francis
> Group.
>
> Null, L. and Lobur, J. (2003). *The Essentials of Computer Organization and
> Architecture.* Jones and Bartlett Publishers.
>
> Stallings, W. (2013). *Computer Organization and Architecture: International
> Edition.* 8th Edition, Pearson Education Limited.
>
> UC. (2011). *Students Manual 2015.* Cebu: Rex Book Store.

**Note:** Null & Lobur is already the source of `docs/source/chapter1-deck.md`.
That deck is chapter 1 of a book this syllabus lists as a *reference*, not the
textbook — which is consistent with the finding in §0.

---

## 4. Additional open references, per chapter

The requirement was **at least two documents per topic** with author credit. The
syllabus's five above apply across the whole course; these are freely accessible
sources that can be cited per chapter, each with its authorship recorded.

### 4.0 The four open works used throughout

| Work | Authors | Access | Licence |
|---|---|---|---|
| ***Dive into Systems*** — https://diveintosystems.org | **Suzanne J. Matthews** (US Military Academy), **Tia Newhall** (Swarthmore), **Kevin C. Webb** (Swarthmore) | Free online, full text | Free to read; used at 45+ institutions |
| **MIT 6.004 *Computation Structures*** — https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/ | MIT EECS faculty, via **MIT OpenCourseWare** | Free, full lecture slides and problems | CC BY-NC-SA |
| **UC Berkeley CS61C *Great Ideas in Computer Architecture*** — https://notes.cs61c.org | **Lisa Yan** and CS 61C staff, UC Berkeley | Free course notes | Course-notes licence |
| **CMU 18-447 *Introduction to Computer Architecture*** — https://users.ece.cmu.edu/~jhoe/doku/doku.php?id=18-447_introduction_to_computer_architecture | **James C. Hoe**, Carnegie Mellon ECE | Free lecture materials | Course materials |

Also cited where it is the best fit:

| Work | Authors | Access |
|---|---|---|
| ***The Elements of Computing Systems*** (nand2tetris) — https://www.nand2tetris.org | **Noam Nisan** (Hebrew University), **Shimon Schocken** (Reichman University) | First six chapters free |

### 4.1 Per-chapter mapping

Each row lists the primary text plus **two or more** additional sources.

| Ch | Topic | Primary | Additional references |
|---|---|---|---|
| 1 | Organization vs Architecture | Stallings ch.1 §1.1–1.2 | Null & Lobur ch.1 · *Dive into Systems* ch.1 (Matthews, Newhall, Webb) |
| 2 | Evolution & Performance; Amdahl's, Little's Law | Stallings ch.1 §1.4–1.7 + ch.2 | Hennessy & Patterson ch.1 (quantitative principles, Amdahl's Law) · CS61C notes, performance (Yan et al.) |
| 3 | Function & Interconnection; buses, PCIe | Stallings ch.3 | Null & Lobur ch.4 · CMU 18-447 lectures on datapath and interconnect (Hoe) |
| 4 | Cache Memory | Stallings ch.4 | *Dive into Systems* ch.11, storage & memory hierarchy · Hennessy & Patterson ch.2, memory hierarchy design |
| 5 | Internal Memory; DRAM, ECC | Stallings ch.5 | Yadin (2016) ch. on memory · CMU 18-447, main memory and DRAM (Hoe) |
| 6 | External Memory; RAID, SSD | Stallings ch.6 | Hennessy & Patterson, appendix on storage systems · Yadin (2016) |
| 7 | Input/Output; DMA, interrupt-driven I/O | Stallings ch.7 | Null & Lobur ch.7 · *Dive into Systems* ch.13 (Matthews, Newhall, Webb) |
| 8 | Operating System Support | Stallings ch.8 | *Dive into Systems* ch.13, OS interaction · CS61C notes, virtual memory (Yan et al.) |
| 9 | Computer Arithmetic; two's complement, IEEE-754 | Stallings ch.10 (+ ch.9) | *Dive into Systems* ch.4, binary and integer representation · MIT 6.004 arithmetic lectures (MIT OCW) |
| 10 | Instruction Sets: characteristics | Stallings ch.12 | Hennessy & Patterson appendix A, instruction set principles · MIT 6.004, instruction sets |
| 11 | Addressing Modes and Formats | Stallings ch.13 | Null & Lobur ch.5 · CS61C notes, RISC-V instruction formats (Yan et al.) |
| 12 | Processor Structure; pipelining | Stallings ch.14 | Hennessy & Patterson appendix C, pipelining · MIT 6.004, pipelined processors |
| 13 | RISC; RISC vs CISC | Stallings ch.15 | Hennessy & Patterson ch.1 and appendix A · CMU 18-447, ISA design tradeoffs (Hoe) |
| 14 | ILP and Superscalar | Stallings ch.16 | Hennessy & Patterson ch.3, ILP and its exploitation · CMU 18-447, out-of-order execution (Hoe) |
| 15 | Control Unit Operation; micro-operations | Stallings ch.20 | Null & Lobur ch.4, control unit · nand2tetris ch.5, computer architecture (Nisan & Schocken) |
| 16 | Microprogrammed Control | Stallings ch.21 | Null & Lobur ch.4, microprogrammed control · Yadin (2016) |
| 17 | Multicore | Stallings ch.18 (+ ch.17) | Hennessy & Patterson ch.5, multiprocessors · *Dive into Systems* ch.14, parallel processing |
| 18 | Distributed Systems Architecture | **none — Stallings does not cover this** | van Steen & Tanenbaum ch.2, architectures · OMG, *CORBA* v3.4 · Fielding (2000), architectural styles |

### 4.1 Chapter 18 has no textbook, and that is worth saying plainly

Every other chapter maps to a Stallings chapter of the same number. **Chapter 18
does not.** *Computer Organization and Architecture* ends at multicore; the
syllabus's own textbook does not contain a distributed-systems chapter, and the
syllabus does not name a substitute. Its topics cell is empty.

So this chapter is the one place where the teaching material has to be sourced
entirely from outside the prescribed text. These three are open, citable, and
each maps to a specific outcome rather than to the chapter in general:

| Source | Author / body | Access | Which outcome it serves |
|---|---|---|---|
| *Distributed Systems*, 4th ed., ch. 2 (architectures) and ch. 3 | **Maarten van Steen & Andrew S. Tanenbaum** | Free personalised digital copy from [distributed-systems.net](https://www.distributed-systems.net/index.php/books/ds4/); v4.03, Jan 2025 | *Advantages and disadvantages of different architectures*; *client-server and distributed object architecture* |
| *Common Object Request Broker Architecture (CORBA)*, v3.4, Feb 2021 | **Object Management Group (OMG)** | Free download, [omg.org/spec/CORBA/3.4](https://www.omg.org/spec/CORBA/3.4/) | *The underlying principles of the CORBA standards* — the primary source, not a summary of one |
| *Architectural Styles and the Design of Network-based Software Architectures* (PhD dissertation, UC Irvine, 2000) | **Roy T. Fielding** | Free full text, [ics.uci.edu/~fielding](https://ics.uci.edu/~fielding/pubs/dissertation/top.htm) | *Identify the new models in distributed computing* — where REST came from, and why it displaced distributed objects |

The Fielding dissertation earns its place: the outcome says *new* models, and a
chapter that teaches CORBA without saying what replaced it and why teaches a
dead standard as though it were current. CORBA is the syllabus's named
requirement; the contrast is what makes it educational.

### 4.2 The book is the 10th edition, and it is numbered differently

The syllabus prescribes the **9th edition**. The copy actually available is the
**10th**, which splits chapter 1 in two, inserts *Number Systems* and *Digital
Logic* as chapters 9 and 11, and moves the control-unit chapters to the end.

**Ten of the eighteen chapters therefore carry a different number in the book
than the number the syllabus gives them.** The worst case is silent: syllabus
chapter 15 is *Control Unit Operation*, but **book chapter 15 is RISC** — a
citation of "Stallings ch.15" sends a student to a real chapter about the wrong
subject.

The chapter numbers in the table above are the **10th edition's**.
`content/book-map.json` is the machine-readable mapping, and `pnpm book:map`
checks it against the extracted book — including a title check that fails loudly
if someone swaps the edition.

Two consequences worth knowing before authoring:

- **Syllabus chapter 2 spans two book chapters.** Evolution is book ch.1 from
  §1.4 on; performance assessment (clock speed, MIPS, Amdahl, Little) is the
  whole of book ch.2.
- **The 10th edition dropped the functional-view figures** the 9th had at
  Figures 1.2–1.5, which is what syllabus outcome 01.4 alludes to. The content
  survives as the four functions in §1.2; the pictures do not. Stage 01 says so
  in a callout rather than omitting it quietly.

**Recording these in the system.** Every reference belongs in the database, not
in a bundle — a `references` table joined to `stages`, surfaced on each stage
page and collected on `/about`. Schema sketch in §6.3.

---

## 5. What this changes about OCTA

### 5.1 The architecture survives; the content does not

The 18-node shape, the prerequisite graph, the seeded-paper engine, the RLS
model, the console — **all of it is course-agnostic** and needs no change.

What must be replaced: `db/schema.sql`'s stage seed (titles, acts, levels,
archetypes, prereqs), `content/stages/*.md`, and the item bank.

### 5.2 Four assessment periods, not one

This is the largest structural change and it reaches the schema.

`blueprints.scope` is currently `'stage' | 'final'`. The syllabus has **Prelim,
Midterm, Semi-finals, Finals** — four major examinations at 30% combined, plus
chapter quizzes at 30% separately.

Chapters map to periods by the 3-hour blocks:

| Period | Chapters (proposed) |
|---|---|
| **Prelim** | 1–4 |
| **Midterm** | 5–8 |
| **Semi-finals** | 9–12 |
| **Finals** | 13–17 |

That proposal needs the instructor's confirmation — the syllabus lists the four
examinations but does not print the chapter split.

### 5.3 A 20% Project, which OCTA has no surface for

"A real life OS algorithm design and implementation case." That is a submitted
artifact with a rubric, and nothing in the current build handles submission,
rubric-scoring, or instructor feedback on a document.

### 5.4 Laboratory Exercises are graded

Currently labs are ungraded practice by design — `GAME-LAYER.md` §2 beat 4 calls
the lab "optional but always available". The syllabus makes them 10% of the
grade and says "must be submitted on time".

### 5.5 The syllabus asks for simulation software

Named as a learning resource on nearly every chapter. This raises Track D from
"the part that makes it a game" to **a course requirement**.

---

## 6. Proposed rebuild

### 6.1 Stage map

Orientation plus eighteen chapters, one stage each — the existing shape, new
content. Archetypes assigned by what the chapter actually asks a student to do.

| Stage | Chapter | Archetype | Why |
|---|---|---|---|
| 00 | Orientation (VMGO, PEO/PILO, CILO) | — | Ungraded, as now |
| 01 | 1 Introduction | A concept | Definitions and distinctions |
| 02 | 2 Evolution & Performance | B computation | CPI, MIPS, MFLOPS, Amdahl, Little — all parameterized |
| 03 | 3 Function & Interconnection | D simulator | Instruction cycle state diagram, bus arbitration |
| 04 | 4 Cache Memory | B computation | Addresses, size, mapping, hit ratio, AMAT |
| 05 | 5 Internal Memory | C artifact | Read a DRAM datasheet; ECC by hand |
| 06 | 6 External Memory | C artifact | RAID levels compared on a real spec |
| 07 | 7 Input/Output | D simulator | Programmed vs interrupt-driven vs DMA, stepped |
| 08 | 8 OS Support | D simulator | Scheduling and paging — **and the Project's home** |
| 09 | 9 Computer Arithmetic | B computation | Two's complement, IEEE-754 — the heaviest drill stage |
| 10 | 10 Instruction Sets: Characteristics | C artifact | Read x86 listings |
| 11 | 11 Addressing Modes and Formats | D simulator | Encode an instruction, field by field |
| 12 | 12 Processor Structure; pipelining | D simulator | Pipeline hazard visualiser |
| 13 | 13 RISC | A concept | RISC vs CISC is an argument, not a calculation |
| 14 | 14 ILP and Superscalar | D simulator | Dependency and reordering |
| 15 | 15 Control Unit Operation | D simulator | Micro-operations, hardwired control |
| 16 | 16 Microprogrammed Control | D simulator | Write microcode |
| 17 | 17 Multicore | B computation | Speedup, scaling, Amdahl again — a deliberate callback to Stage 02 |
| 18 | 18 Distributed Systems Architecture | A concept | Architectures and standards, argued. The only chapter with no computation in its outcomes |

**Prerequisites are a linear chain — settled, not proposed.** An earlier draft of
this section proposed joins the material implies (12 needs 03 and 11, 17 needs 02
and 14, and so on). Asked directly, the instructor said: *"I teach based on the
order of the syllabus topics and go down the line."*

`stages.prereq` gates real students out of real content, so it has to model the
course **as taught**, not the subject's intellectual decomposition. Each chapter
requires exactly the one before it: 18 edges, no forks, no joins, `18` the only
leaf. The reasoning is in `SKILL-TREE-3D.md` §1.2.

### 6.2 What the level hierarchy becomes

`LESSON-PLAN-AND-LEVELS.md`'s L6→L0 Computer Level Hierarchy came from Null &
Lobur ch.1 §1.6 — a *reference* here, not the textbook. It still works as a depth
axis, and Stallings covers the same strata, but **the Stage 11 "reveal" no longer
has a chapter to land on.** That needs re-siting or dropping. Flagged, not
decided.

### 6.3 Schema additions

```sql
-- References, per stage, surfaced on the stage page and collected on /about.
create table references_ (
  id          uuid primary key default gen_random_uuid(),
  stage_id    text references stages(id) on delete cascade,
  kind        text not null check (kind in ('textbook','reference','open','course')),
  authors     text not null,
  title       text not null,
  edition     text,
  publisher   text,
  year        int,
  url         text,
  licence     text,
  apa         text not null,          -- the formatted citation, authored not generated
  ordinal     int  not null default 1
);

-- Four grading periods.
alter type blueprint_scope add value 'period';   -- or a new column
alter table blueprints add column period text
  check (period in ('prelim','midterm','semifinals','finals'));

-- Graded lab submissions and the project.
create table submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stage_id    text references stages(id),
  kind        text not null check (kind in ('lab','project')),
  body_md     text,
  media_ref   text,
  submitted_at timestamptz not null default now(),
  score       numeric(5,2),
  rubric      jsonb,
  feedback_md text,
  graded_by   uuid references auth.users(id),
  graded_at   timestamptz
);
```

`submissions` needs the same treatment as `responses`: RLS so a student reads
only their own, staff read all, and grading writes only from the service.

---

## 7. Decisions needed before any of this is built

1. **Is CPE 412 the target course, replacing the old one — or an additional
   course?** Everything downstream depends on this. If OCTA must serve both, the
   schema needs a `courses` table and every stage, blueprint and item becomes
   course-scoped. **That is a significant change and it is better made now than
   after the item bank exists.**
2. **The prerequisite edge list** in §6.1 is my proposal from the chapter
   dependencies. `stages.prereq` IS the curriculum, so the instructor should
   confirm it.
3. **The chapter-to-period split** in §5.2 is proposed, not documented.
4. **The Project (20%)** — is it in scope for OCTA, or handled outside it?
5. **What happens to the existing Stages 01–05 content?** It is correct work
   against the wrong syllabus. It maps to the *Microprocessors* prerequisite, so
   it could become a review module rather than being deleted.
6. **The Stage 11 Depth Gauge reveal** no longer has a home chapter (§6.2).
