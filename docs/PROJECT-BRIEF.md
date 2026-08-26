# PROJECT-BRIEF.md
### CPE 412 — the semester project, 20% of the final grade

The syllabus specifies the project in one line, and every decision below follows
from it:

> a real life OS algorithm design and implementation case … how the students
> will make judicious choices of OS algorithm design and constructs

Three words in that sentence do the work. **Real life** — not a toy trace.
**Judicious choices** — the deliverable is a *decision*, defended, not an
implementation that merely runs. **Case** — a specific situation with
constraints, where a different situation would justify a different answer.

So this is not "implement round-robin." It is: *here is a machine with real
constraints and a real workload; choose the scheduling and memory policies, build
them, measure them, and defend why you chose those and not the obvious ones.*

---

## 1. The brief

**Build a simulator for a small computer's operating-system layer, choose its
scheduling and memory-management policies for an assigned workload, and defend
the choice with your own measurements.**

Anchored in **Stage 08 / Stallings 10th ed. chapter 8** — §8.2 Scheduling and
§8.3 Memory Management — and it deliberately reaches back into three earlier
stages, because the point is that these choices are not independent of the
hardware underneath:

| Reaches back to | For |
|---|---|
| **Stage 04** Cache Memory | why a context switch is expensive, and what a working set is |
| **Stage 05** Internal Memory | what a page actually costs to fetch |
| **Stage 02** Performance | Amdahl's Law, and how to report a speedup honestly |

### 1.1 What you are given

Each team receives a **workload profile** and a **machine profile**, and they
differ per team. Yours is generated from your team number, so the team beside you
is defending a different answer and copying theirs is worse than useless.

A **workload profile** is a set of processes, each with an arrival time, a total
CPU requirement, an I/O pattern, and a memory footprint. It will include at least
one of each awkward case: a long CPU-bound job, a short interactive job that
arrives repeatedly, and a job whose memory footprint does not fit comfortably.

A **machine profile** gives the number of cores, the physical memory available,
the page size, the cost of a context switch, and the cost of a page fault.

### 1.2 What you build

A program, in any language you like, that:

1. **Simulates** the workload on the machine, cycle by cycle or event by event.
2. Implements **at least three scheduling policies** — one of which must be
   your own variant, not a textbook one.
3. Implements **at least two page-replacement policies** from the set the
   syllabus names: LRU, LFU, FIFO, Random.
4. **Reports**, for every combination: average turnaround time, average waiting
   time, CPU utilisation, throughput, page-fault count, and the number of
   context switches.

It must be **deterministic**. Same workload, same policies, same seed, same
numbers — every time. A simulator you cannot re-run identically is a simulator
whose results nobody can check, including you.

### 1.3 What you hand in

| Deliverable | Weight | Notes |
|---|---|---|
| **The decision memo** | **8%** | Two pages. Which policies you chose, and why *these* against *this* workload. See §2 — this is the largest single component, on purpose |
| Source code | 4% | Readable, runs from a documented command, deterministic |
| Measurement table + charts | 4% | Every policy combination, the six metrics above |
| Demonstration | 4% | 10 minutes. Run it live, change one parameter, explain what moved and why |

---

## 2. The decision memo is the project

Everything else is evidence for it.

A memo that says *"we chose Shortest Job First because it gives the lowest
average waiting time"* earns very little. It is true, it is in the textbook, and
it did not require the simulator you built.

A memo that earns full marks does four things:

1. **Names the trade-off you actually hit.** SJF starves the long job in your
   workload — say by how much, in your numbers.
2. **Names the alternative you rejected and why.** Not "round-robin is worse,"
   but "round-robin at a 4 ms quantum cost us 31% more context switches for a
   6% turnaround gain, which on this machine's switch cost is not worth it."
3. **Identifies where your answer would flip.** "If the switch cost were half,
   we would choose differently" — with the run that shows it.
4. **Is honest about what you did not measure.** Every simulation abstracts
   something away. Say what.

That fourth point is worth a mark on its own, and it is the one students skip.

---

## 3. Rubric

Out of 20, mapped to the weights in §1.3.

| Band | Decision memo (8) | Code (4) | Measurement (4) | Demo (4) |
|---|---|---|---|---|
| **Full** | Names a real trade-off in your own numbers, the rejected alternative, the flip point, and a stated limitation | Deterministic, readable, documented run command | All policy pairs, six metrics, charts that answer a question | Runs live, one parameter changed, movement explained correctly |
| **Most** | Trade-off and alternative, no flip point or no limitation | Runs, mostly readable | All pairs, metrics complete, charts decorative | Runs, explanation partly correct |
| **Some** | Restates textbook properties without using your data | Runs with help | Gaps in the table | Runs, cannot explain the movement |
| **Little** | Asserts a choice with no evidence | Does not run reliably | Metrics missing or not reproducible | Does not run |

**A result you cannot reproduce scores nothing**, in any band. That is not
harshness — a number nobody can regenerate is not a measurement.

---

## 4. Schedule

The project runs the whole semester and is deliberately front-loaded so it is
not a Finals-week panic.

| By end of | Milestone | Submitted as |
|---|---|---|
| **Prelim** | Team formed, workload and machine profile collected, simulator skeleton runs and prints a trace | Screenshot + repository link |
| **Midterm** | Two scheduling policies working, first metrics table | Code + table |
| **Semi-finals** | All policies including your own variant; page replacement working | Code + full table |
| **Finals** | Decision memo, charts, demonstration | Everything |

Milestones are checkpoints, not separately graded. They exist so that a team in
trouble is visible in week 6 rather than week 17.

---

## 5. Teams and honesty

**Teams of three.** Two is allowed with a reason; four is not.

Every team's profiles differ, so the answer is not shareable. **Method is
shareable and should be** — comparing approaches with another team is how you
find out your own is odd. Comparing *numbers* is not, because your numbers
describe a workload that is not theirs.

Cite anything you used, including code you adapted and anything an AI assistant
wrote. Using one is fine; presenting its output as your reasoning is not, and the
demonstration in §1.3 is where that shows.

---

## 6. How this sits in the system

- **Submitted through the console**, against the `submissions` table, and graded
  on the rubric in §3.
- The **Finals examination is cumulative** across all eighteen chapters, so the
  project's Stage 08 material is examined there too. They reinforce each other
  rather than duplicating.
- It is **20% of the final grade** — the largest single component, larger than
  any one examination. Weighted that way because it is the only part of the
  course where a student makes a design decision nobody has told them the answer
  to.

---

## 7. Where the material is

| Topic | Stage | Book (10th ed.) |
|---|---|---|
| Scheduling: types, algorithms | 08 | ch. 8 §8.2 |
| Memory management, paging, virtual memory | 08 | ch. 8 §8.3 |
| Replacement algorithms — LRU, LFU, FIFO, Random | 04 | ch. 4 §4.3 |
| Why a context switch costs what it costs | 04, 05 | ch. 4, ch. 5 |
| Reporting a speedup honestly (Amdahl) | 02 | ch. 2 |

Chapter numbers are the **10th edition's**. The syllabus is written against the
9th, and ten of eighteen chapters are numbered differently — see
`content/book-map.json`.
