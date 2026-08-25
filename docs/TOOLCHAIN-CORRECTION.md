# TOOLCHAIN-CORRECTION.md
### The course is TASM x86-16 DOS, not MARIE. This changes Stages 13–15.

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

**Status:** supersedes `MASTER-PLAN.md` §2 (Stage 15), `LESSON-PLAN-AND-LEVELS.md` §2 (weeks
11–12), `GAME-LAYER.md` §3 (Petal 3), and `PHASES.md` P6. Read before P5.

---

## 1. The evidence

The Drive listing shows four content folders — `WORD`, `ASSEMBLY_CODE`, `PDF`, `PPT` — plus
**`Tasm 1.4 Windows 7-Windows 8 64 bit`**, a DOSBox-bundled Borland Turbo Assembler package
shared into the class in 2021.

That single file resolves an ambiguity I had guessed wrong on. Three things line up:

1. **`ASSEMBLY_CODE` is a folder of real source files.** Students write and submit actual
   assembly, not pseudo-code.
2. **TASM 1.4 is 16-bit DOS real mode.** Borland's assembler, MASM-syntax-compatible, run under
   DOSBox on modern Windows.
3. **Your own Day 1 deck already said so and I under-read it.** The listing in Figure 1.2 uses
   `mov ax, dseg` / `mov ds, ax` — that is the standard MASM/TASM segment-setup preamble, not a
   generic teaching notation. The deck's TSR and ISR material is DOS interrupt programming.

**I recommended MARIE in the master plan.** That was reasonable given Null & Lobur wrote both the
Chapter 1 material and MarieSim — but it was wrong for this course. Teaching MARIE here would add
a second instruction set that appears on no lab sheet and no exam.

---

## 2. What changes

| Stage | Was | Now |
|---|---|---|
| **13 Fetch–Decode–Execute** | MARIE registers | **8086 registers.** AX/BX/CX/DX (and AL/AH split), SI/DI, BP/SP, CS/DS/ES/SS, IP, FLAGS. The FDE cycle is the same cycle — just narrate it on the CPU they actually use. |
| **14 Instruction Set Architecture** | generic addressing modes | **8086 addressing modes specifically:** immediate, register, direct, register indirect, base+index, base+index+displacement. Real `MOD-REG-R/M` encoding. |
| **15 Writing Assembly** | MARIE subset | **TASM x86-16.** `.MODEL SMALL`, `.STACK`, `.DATA`, `.CODE`, `ASSUME`, `INT 21h` services, `TASM` → `TLINK` → run. |
| **05 Why Assembly Still Matters** | felt dated | **Now coherent.** TSRs and ISRs aren't nostalgia — they're this semester's material. The stage gets stronger, not weaker. |
| **09 Number Systems** | generic widths | Anchor to **8-bit and 16-bit** two's complement, matching `AL` and `AX`. Overflow questions become concrete. |

### The Register Cast changes with it

`packages/tokens/elements.svg` currently ships PC / IR / MAR / MBR / AC / ALU — the von Neumann
teaching set from Chapter 1. Keep those for Stages 12–13, where they're the right abstraction.

**Add a second set for Stages 14–15:** AX, BX, CX, DX, SI/DI, SP/BP, FLAGS. Same treatment —
fixed hue, fixed glyph, every screen. The transition from the generic set to the real set *is*
Stage 14's lesson: the abstract MAR/MBR you've been watching for two weeks is `DS:SI` on a real
8086.

---

## 3. The simulator decision — the one that matters

Three options. They are not equivalent.

### A · Purpose-built 8086 subset interpreter — **build this**

A TypeScript interpreter covering ~35 instructions: `MOV MOVSX LEA PUSH POP ADD SUB INC DEC MUL
IMUL DIV IDIV CMP AND OR XOR NOT NEG SHL SHR JMP JE/JZ JNE/JNZ JL JG JLE JGE LOOP CALL RET INT
21h`, plus `.MODEL/.STACK/.DATA/.CODE` directives and the common `INT 21h` functions (01h, 02h,
09h, 0Ah, 4Ch).

**Why this and not the authentic option:** it's deterministic, inspectable, and *gradeable*. Your
whole question engine depends on server-side grading with reproducible results. You cannot grade
a DOSBox session. You can grade "after running this program, what is in AX?" — and you can
generate that question parametrically, which makes Stage 15 a source of unique items rather than
a dead end for the blueprint.

It also lets you show register state live in the Register Bar, which nothing else does.

**Scope honestly:** this is 2–3 weeks of work on its own. If the semester tightens, ship Stage 15
as read + trace + parameterized questions, and add BUILD later.

### B · js-dos "authentic mode" — optional, ungraded

<cite index="23-1">The `dosasm/masm-tasm` VS Code extension runs and debugs TASM/MASM code via JSDos, DOSBox and DOSBox-x, built specifically for studying MASM/TASM in DOSBox, and supports all platforms including Web.</cite> Its config runs the real pipeline: <cite index="23-1">`TASM ${file}`, then `TLINK /t ${filename}`, then the executable — with a debug path through `TD`.</cite>

That's an existence proof: **the real TASM toolchain can run in a browser.** Offer it as an
optional "run it for real" panel next to the graded interpreter. Never as the graded path.

### C · Full-system emulation (v86, 86Box) — **no**

Too heavy, ungradeable, and it solves a problem you don't have.

---

## 4. Licensing — read this before you ship anything

**TASM is proprietary.** Borland, now Embarcadero. <cite index="29-1">Turbo Assembler was last updated in 2002 but is still supplied with C++Builder and RAD Studio</cite> — it is a live commercial product, not abandonware. **Do not bundle `TASM.EXE` or `TLINK.EXE` into your repo, your Vercel deploy, or a js-dos bundle you host.** A class passing a zip around is one thing; a public deployment is another.

**The shippable alternative is MASM-compatible open source:**

| Assembler | Notes |
|---|---|
| **UASM** | <cite index="29-1">A free MASM-compatible assembler based on JWasm</cite>, and <cite index="24-1">the actively-maintained fork.</cite> **Use this.** |
| **ASMC** | <cite index="29-1">Also a free MASM-compatible assembler based on JWasm.</cite> |
| JWasm | <cite index="25-1">Masm-compatible, supports 16-, 32- and 64-bit code, written in C — but ended in 2014; new versions live on as ASMC or UASM.</cite> <cite index="29-1">Licensed under the Sybase Open Watcom EULA.</cite> |
| NASM | <cite index="21-1">Partially compatible with TASM syntax via its `-t` option</cite> — but different enough to confuse a first-year student. Avoid. |

TASM in MASM mode and UASM accept substantially the same source, so **the code your students
write for lab will assemble under UASM.** That's the path: students use TASM locally as the
instructor requires, OCTA validates with UASM or the built-in interpreter, and no proprietary
binary is ever redistributed.

One caveat from the field: <cite index="24-1">for JWasm-family assemblers, avoid the `-model` flag and let the source file's own directives control the memory model, and use `-Zm` for MASM 5.1 compatibility mode on older syntax.</cite> Budget a day to get a known-good `.ASM` from your instructor assembling cleanly before you build anything on top.

---

## 5. What this unlocks that MARIE couldn't

Worth saying, because the correction is a net gain:

- **Stage 15 becomes a parameterized item source.** "After this program runs, what is in `AX`?"
  with seeded initial values and a seeded instruction sequence, graded by running the interpreter
  server-side. Previously Stage 15 was a blueprint dead zone.
- **`ASSEMBLY_CODE` is a ready-made item bank.** Every source file your instructor already has is
  a TRACE artifact, a debugging exercise (introduce one seeded fault), or a REMIX target. That's
  content you don't have to author.
- **Stage 05 stops being the weakest stage.** Its TSR/ISR content is now the on-ramp to Stage 15
  rather than a historical footnote.
- **The capstone gets sharper.** The Figure 1.3 payroll program traced BASIC → TASM x86 → machine
  code → FDE → gates is more compelling than tracing to an academic ISA, because the middle layer
  is code the student personally wrote and submitted.

---

## 6. What I still need from you

I can see the folder names in your screenshot but not their contents — Drive renders the file
list with JavaScript, so a fetch returns an empty shell. **Upload directly, in this priority
order:**

| # | From | Why it's the priority it is |
|---|---|---|
| 1 | **`ASSEMBLY_CODE`** — 3–5 representative `.ASM` files | Tells me the exact instruction subset, the I/O conventions, and the house style. Everything in §3 depends on it. |
| 2 | **`WORD`** — lab manuals, exercise sheets, exams | These *are* your item bank. Existing exercises convert to items directly, and past exams tell you the real difficulty target. |
| 3 | **`PPT`** — remaining decks | Fills Stages 09, 10, 14, 16, 17, which currently have no source material and are flagged "instructor authors this." |
| 4 | **`PDF`** — textbook chapters, handouts | Confirms whether Null & Lobur is the whole text or just Chapter 1. |
| 5 | The syllabus / course outline | Lets me align the 14-week plan to your actual grading periods (prelim / midterm / finals). |

The single most valuable upload is **one complete `.ASM` file your students submit.** From that I
can specify the interpreter's instruction set precisely instead of guessing at 35 opcodes.
