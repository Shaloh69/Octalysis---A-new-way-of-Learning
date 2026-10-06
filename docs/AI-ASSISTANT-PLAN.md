# The drafting assistant — plan v4, APPROVED (built LAST)

**History.** v1 (6 Oct 2026) planned a small local tool. v2 (7 Oct) answered
"do what you were doing with all of the books; summarise the figures,
charts and graphs; think about more features". v3 (7 Oct) took in the
instructor's first answers. **v4** (7 Oct, evening) takes in the second
round, and every decision is now made.

**Rulings, first round (7 Oct 2026):**

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | The engine | **Free.** "Will Ollama suffice?" (answered in §3) |
| 2 | Which machine | Hosted (Render Free or Railway), refined in round two |
| 3 | How far past chapter 12 | **"This AI is for future books"**; this book's remaining chapters are its **test** |
| 4 | The MP3s | **Scrapped**: the browser voice Listen uses today is enough |
| 5 | Features | "Tell me the features and explain them" (§6) |
| 6 | (the instructor's idea) | **"Each teacher will use their own laptop… an executable that the website checks and connects to, so the AI runs locally"** (§4) |

**Rulings, second round (7 Oct 2026, evening):**

| # | Decision | The instructor's answer |
|---|---|---|
| 1 | The design | **"We already have the websites": the API on Render, the student web and the console on Vercel.** So there's no new website: the assistant is a **console page** and **API routes** (§4) |
| 2 | Install Ollama on this laptop for B0 | **Yes** |
| 3 | Windows only, unsigned, at first | **"You decide."** Decided: **Windows only, unsigned**, with "More info → Run anyway" in the setup guide. It's free, and this laptop and the course run on Windows. macOS when there's a budget for Apple's $99/year |
| 4 | Will OCTA serve several courses and teachers? | **Yes, one day: "a future dev plan."** So the assistant's tables carry a course and an owning teacher from the start (§4). OCTA's own move to many courses is a **separate plan, not written yet**, and not part of this one |
| 5 | Which extras | **All of them**: 10, 11 and 12 with the core; 13-16 after it (§6) |
| 6 | Order | **"This will be last on the implementation plan."** It's built after everything else in the queue (ruling 4 verified live, R5, and whatever comes before it) |

**No code exists yet.** It is approved, and it waits its turn.

---

## 1. What it is now

It is a **staff-only page in the console** for turning a textbook into
course material: lesson text, questions, redrawn figures, and a catalogue
of every figure, chart, graph and table in the book. Its routes live in
the existing API, and the AI runs on **each teacher's own laptop**
through a small app they install. It is built for **future books**: a new
course, or a new edition, starts by giving it the book and its syllabus.
**The rest of this book (syllabus chapters 13-17) is its test.**

The rules OCTA already lives by still hold. Every quote is checked against
the book, every figure passes the figure checker, every answer key is held
by code, and **nothing reaches a student until the instructor approves it**.

## 2. Measured facts this plan rests on (7 Oct 2026)

| Fact | Measured |
|---|---|
| Render Free web service | **512 MB RAM, 0.1 CPU, no GPU**; sleeps after 15 min with no traffic; 750 instance-hours a month **shared across the workspace** (OCTA's API uses the same pool); no background-worker service type on free |
| OCTA's API on Render | **not kept awake**: the deployment has no keep-alive job (`cron.job`: item-stats, invariants, scheduled-locks only), so a second free service has room in the 750 hours |
| Railway Free | **0.5 GB RAM, 1 vCPU, $1 of credit a month**, no GPU (the $5 trial is one-time; Hobby is $5/month) |
| What Ollama needs | the smallest model worth trying here needs about 2-3 GB of memory on its own; a 7-8 B model about 5 GB |
| This laptop | RTX 3050 Laptop GPU with **4 GB VRAM**, 16 GB RAM, Python 3.13 and PyMuPDF; Ollama not installed |
| The book | 18 MB PDF, real text layer, an embedded outline. **Figures are vector drawings**, so their labels and chart points can be read exactly. About 355 figures and 150 tables |
| Gemini API free tier | free, but Google's terms say unpaid-tier content is used "to provide, improve, and develop Google products", and human reviewers may read it. Daily limits are small and keep changing (reported 20-500 requests a day per model in September 2026) |

## 3. Will Ollama suffice? Two answers

**On Render Free or Railway Free: no, it cannot run there at all.** A model
needs several GB of memory. Render Free has 512 MB and Railway Free 0.5 GB,
and neither has a GPU. Railway's paid plans have the memory, but they cost
money, run on CPU only, and would be very slow. "Free" and "the AI runs on
the host" cannot both be true.

**On a teacher's laptop: yes, it runs, with limits we will measure.** Ollama
is free and keeps the model on the teacher's machine. On this laptop, the 4 GB card holds a 3-4 B vision model
whole, and 16 GB of RAM lets a 7-14 B model run split between the card and
memory: slowly (an estimate: a few words a second), but free. That is fine
for a job you start in the evening and review in the morning.

**How good will the drafts be?** Better than a 2 B model, and below what the
Claude sessions produced for chapters 08-12. Much of the design exists so
that a small model can still be useful:

- The **figure reader, chart data, checks and renderers are code**. They need
  no model, so they come out the same quality on any engine.
- The model **never types a quote** (code pastes the book's words) and
  **never computes a key** (the solvers do).
- The **grounding check** refuses a figure summary that names anything not
  in the figure, and the **claim check** flags any unsupported sentence. A
  weak model produces more refusals, not wrong material that slips through.

So Ollama will produce **usable drafts that need more of your editing**.
How much more is exactly what the chapter 13-17 test measures (§7). If the
answer is "too much", the engine can be swapped later without rebuilding
anything. Every engine sits behind one interface.

**Which model (Ollama library, checked 7 Oct 2026).** No local model matches
Claude. The open models that come nearest (`qwen3.5:122b` at 81 GB,
`mistral-medium-3.5` at 128 B, `gpt-oss:120b`, `deepseek-v3` at 671 B) need a
workstation with 80+ GB of memory, not a laptop. The app picks by the
teacher's hardware:

| Teacher's machine | Figures (needs vision) | Lesson text, questions, checks | Expect |
|---|---|---|---|
| no GPU, 8 GB RAM | `qwen3.5:2b` (2.7-3.1 GB) | not recommended | figure summaries only, slowly |
| **4 GB GPU, 16 GB RAM (this laptop)** | **`qwen3.5:4b`** (3.3-4.0 GB, nearly all on the GPU) | **`qwen3.5:9b`** (6.6-7.6 GB, split GPU/RAM) | usable drafts, slow; overnight jobs |
| 8 GB GPU | `qwen3.5:9b` | `qwen3.5:9b` | reported 54-58 words/s at 32 K context on 8 GB cards |
| 16-24 GB GPU | `qwen3.5:27b` or `gemma4:26b` | the same | the closest a single PC gets |

All Qwen 3.5 sizes read images, call tools, and have a thinking mode. The
comparison model for B0 is `gemma4:12b` (7.7-8.0 GB). **B0 measures these on
book 15's figures before anything is built on them.**

**Matching the settings the Claude sessions used.** Claude read a whole
chapter (about 25 K tokens) at once. Locally, memory limits the context to
about 16-32 K, so the app works **one section at a time**, which the design
already does. Thinking is **on** for questions and the claim check, and off
for extraction. Temperature is low (about 0.2) for summaries and checks.
Every output is constrained to a **JSON schema** (Ollama supports this), so
a draft is the right shape before a check even runs. The **content rules**
the sessions followed (`.claude/rules/content.md`) become each job's fixed
prompt.

**Free alternatives, and why they are not recommended for the book:**
Gemini's free tier is stronger, but its terms let Google keep and review
what you send, which means the copyrighted book. Its limits also change
month to month. Groq and OpenRouter have free models with daily caps. Each
of these can be added behind the same interface if you decide to, but none
is the default.

## 4. The design: the existing console and API, plus an app on each teacher's laptop

> "Each teacher will use their own laptop, for each teacher to run its own AI.
> Make this into an executable that the website checks and connects to, so
> that the AI will run locally." And: "We already have the websites: the API
> on Render, the student web and the console on Vercel."

**No new website and no new host.** The pieces are the ones OCTA already
has, plus one app:

```
  ┌──── The console (Vercel) — new page /assistant ────────────────┐
  │  "Your assistant: ● online · qwen3.5:9b · 4 GB GPU · v1.2"      │
  │  pair a laptop · choose a book + syllabus · start a job          │
  │  progress · review side by side · Accept / Reject · export       │
  └───────────────┬─────────────────────────────────────────────────┘
                  │ (staff sign-in, as today)
  ┌──── The API (Render) — new /assistant routes ───────────────────┐
  │  pairing · jobs · receives results and RUNS THE CHECKS with the  │
  │  same JS OCTA uses (--verify, figure checker, item checker,      │
  │  grounding, solvers) · export                                    │
  └───────────────┬────────────────────────────────▲───────────────┘
                  │ Supabase: jobs, heartbeats      │ results (one API call each)
                  ▼ (owner-only RLS; Realtime)      │
  ┌──── Teacher A's laptop ─────┐   ┌──── Teacher B's laptop ─────┐
  │  OCTA Assistant (Windows)   │   │  OCTA Assistant (Windows)   │
  │  · paired to Teacher A      │   │  · paired to Teacher B      │
  │  · Ollama + the model that  │   │  · a smaller model: no GPU  │
  │    fits THIS machine (§3)   │   │                             │
  │  · PyMuPDF: chapters,       │   │                             │
  │    figures, chart data      │   │                             │
  └─────────────────────────────┘   └─────────────────────────────┘
```

### How the console "checks and connects"

The app **calls out**; nothing calls into the laptop. It writes a
**heartbeat** to Supabase about once a minute: who it is, its version, the
model it runs, and the machine's GPU and memory. It hears about new jobs
through **Supabase Realtime**, which the class chat already uses. From the
heartbeat the console's `/assistant` page shows one of five states:

| State | What the teacher sees |
|---|---|
| **Not installed** | a Download button and a 3-step setup guide |
| **Offline** | "Last seen 2 hours ago". Jobs can still be queued; they run when the laptop is back |
| **Online** | the model, the hardware, and an expected time per chapter |
| **Busy** | the job running and its progress |
| **Out of date** | "Update the app" (a version older than the API accepts) |

**Why heartbeats go to Supabase, not to the API:** the API runs on Render
Free, which sleeps after 15 minutes without traffic and has 750 hours a
month. A heartbeat every minute would keep it awake around the clock and
use up nearly the whole month (`db/addendum-cron.sql` §5 warns about the
same thing for a keep-alive). The API wakes only when the app hands in a
result, or when a teacher opens the console.

**Why not the browser talking to `localhost`:** a page on the internet
reaching into a laptop is something browsers increasingly block or put
behind a permission prompt (Safari blocks it outright). It only works while
the page is open, and any other site could probe the same port. Outbound
needs no open port, no tunnel and no firewall change, and a job started at
6 pm runs overnight with the console closed.

### Pairing: how the app knows whose laptop it is

On first run the app shows a short code. The teacher types it into
`/assistant` (already signed in), and the app receives **its own session
for that teacher only**, kept in Windows' credential store. It can read that
teacher's jobs and write that teacher's heartbeats and results, nothing
else (owner-only RLS, with a **denial test proving teacher B's app cannot
see teacher A's jobs**, written red first, per hard rule 8). The console can
revoke a paired laptop.

### What the app contains

- **The worker:** pulls jobs, extracts chapters, figures and chart data with
  PyMuPDF, calls the model, and hands results to the API.
- **Ollama management:** it detects Ollama (installing it from ollama.com
  on first run if missing), measures the GPU and memory, and **downloads
  the model that fits this machine** (§3's tiers). It says what to expect
  before the download (2-9 GB, once).
- **One Windows executable**, built with PyInstaller (Python, because PyMuPDF
  is), **unsigned**: the setup guide shows the "More info → Run anyway"
  step. macOS later.

**What stays in the API, on purpose:** the **checks**. They are the same
JavaScript OCTA already trusts, and a second copy in the app would drift.
A result that fails a check is kept, with its errors, for the teacher to
see. The **previews** at 380 and 1440 are drawn by the teacher's own
browser on the review page, so the app needs no browser inside it.

### Many courses and many teachers, from the start

OCTA will one day serve several courses and teachers (ruling, 7 Oct). So
every assistant table carries a **course** and an **owning teacher** from
day one: books, jobs, heartbeats, paired devices, catalogue entries, and
drafts. Nothing assumes there is one course or one instructor, and nothing
needs rebuilding when OCTA grows. **OCTA's own course tables are not
changed by this plan.** Moving them to many courses is the separate future
plan.

### The book

The teacher picks the PDF **in the app**, and it never leaves the laptop as
a PDF. The app uploads the extracted chapter text and figure data to a
**private** staff-only bucket, because the API's checks need the text to
verify quotes against. Crops of the book's own art go up only for the
side-by-side review, also private. Nothing is public, and nothing goes
into git.

### Honest costs and limits

- **Unsigned means a warning:** SmartScreen says "Windows protected your
  PC" the first time. The setup guide shows the two clicks.
- **Each laptop sets its own quality.** A teacher with no GPU gets a small
  model and slow runs. The console labels every draft with the model that
  wrote it.
- **The first run downloads 2-9 GB** (Ollama plus a model).
- **Render's 750 free hours:** the API is woken only by results and by
  people using the console, never by heartbeats.

**Getting results into OCTA:** an accepted draft is **exported** in OCTA's
own formats (`content/stages/NN.draft.md`, `content/items/NN.json`,
`content/figures/<id>.svg`), as a download or a GitHub pull request. From
there it goes through `sync-content --verify` / `sync-items --check` and
lands at draft or review on `/content` and `/items`, exactly as today. The
assistant never writes OCTA's course tables directly.

## 5. How each job works

### A. Book and syllabus intake (new, for future books)

Pick the PDF in the app and give the syllabus on the console's `/assistant`. The app splits the book into chapters
using its outline (generalising `scripts/extract_book.py`), extracts every
figure and table, and pulls the objectives from the syllabus. It then
**drafts the syllabus-to-book chapter map** (this course needed one because
the syllabus follows the 9th edition and the book is the 10th), for you to
confirm.

Every PDF is laid out differently. `extract_book.py`'s clean-up rules
(running heads, soft hyphens, bold bullets) were tuned to this book, so
intake shows a **sample page before and after cleaning** for you to check.
A scanned book with no text layer is out of scope until OCR is added.

### B. Figure reader (code)

For each figure and table it saves the crop (private), the exact labels with
positions, and for charts the axes, series and every data point, read from
the vector drawing. A trial on 7 Oct cut out Fig 14.10 and Fig 2.2 cleanly.
Two of four were missed because captions use non-breaking spaces; that gets
fixed first.

### C. Figure summaries (model + grounding check)

From the crop, the exact labels and the paragraphs that cite the figure,
the model writes: its kind, a 2-4 sentence summary in our own words, the
takeaways, the objectives it serves, a verdict (redraw, describe or skip),
and drafts of the caption and the accessible description. **Grounding
check:** any label or number it names must exist in the figure's extracted
labels or data, or the entry is refused and sent back with the mismatch
marked.

### D. Figure redraw (model writes a spec, code draws)

The model describes the figure as structured data: boxes, arrows, rows,
fields or series. A renderer per kind (pipeline grid, bit-field format,
block diagram, state diagram, chart) draws the SVG, so it passes OCTA's
figure checker by construction. Charts are re-plotted from the extracted
data or the book's formula, never estimated by eye. Each redraw is shown
beside the book's crop at 380 and 1440.

### E. Lesson text (quotes by reference + claim check)

The model cites passages by position, and code pastes the book's exact words.
Every sentence in our own words is then checked for a supporting passage;
any without one is flagged for you.

### F. Questions (keys held by code + blind critic)

Questions are drafted in OCTA's item format. Computed questions use only
registered solvers. A second pass answers each question without its key and
flags disagreements or ambiguity, and a duplicate check runs against the
bank.

## 6. The features, explained

**The core: what you asked for**

1. **Book and syllabus intake.** You upload a new textbook and its syllabus,
   and the tool splits the book into chapters, lists every section, and pulls
   out the learning objectives. It also proposes which book chapter serves
   which syllabus chapter; you confirm or correct it. *Why:* this is what
   makes it work for future books, not just this one. Today this mapping was
   worked out by hand.

2. **Figure, chart and table catalogue.** A list of every figure, chart,
   graph and table in a chapter. Each entry has a short summary in our own
   words, the facts a student should take from it, the objectives it supports,
   and a recommendation: redraw it, just describe it, or skip it. *Why:* you
   can see a chapter's visuals in five minutes and choose which matter,
   without paging through the book.

3. **Exact chart reading.** For charts and graphs, the tool reads the actual
   data points out of the PDF (the book's charts are drawn as vectors, so the
   numbers are there), along with the axes and scales. *Why:* summaries quote
   real numbers, and a redrawn chart plots the book's real data, not a guess.

4. **Grounding check.** Before a figure summary is accepted, every label and
   number it mentions is matched against the figure itself. *Why:* small
   models describe confidently and wrongly, and this stops that the same way
   `--verify` stops a misquote.

5. **Figure redraw.** The tool draws the chosen figures as OCTA SVGs in the
   course's own style (no copied artwork, credited "after Figure N.N") and
   shows each beside the original. *Why:* this is the slow manual step behind
   the 17 figures for chapters 01-13.

6. **Lesson text drafts.** A chapter's lesson organised around its objectives,
   original explanation plus exact quotes for definitions and facts. *Why:*
   it's the main work behind every chapter; with quotes pasted by code, the
   quote check passes every time.

7. **Claim check.** Every sentence in our own words is matched to a passage
   in the book that supports it; any sentence without support is highlighted
   for you. *Why:* a session found three of its own errors this way on 6 Oct.
   Here it runs on every draft automatically.

8. **Question drafts.** At least three questions per objective, with wrong
   options based on real misconceptions, a rationale and a source. Computed
   questions use OCTA's solvers, so every student still gets a unique paper.
   *Why:* this fills the bank that the exams draw from.

9. **Blind-answer critic.** A second pass tries to answer each question
   without seeing the answer key. If it picks a different answer, finds two
   defensible answers, or can answer without knowing the course, the question
   is flagged. *Why:* it catches broken questions before a student does.

**Extras: all approved (7 Oct). 10-12 are built with the core, 13-16 after it**

10. **Coverage map.** A grid of objectives against lesson sections,
    questions and figures, showing the gaps: an objective with fewer than
    three questions, or a figure that serves no objective. *Why:* you can
    see at a glance whether a chapter is complete.

11. **Review of what already exists.** Run the claim check and the critic
    over what is already written: the lesson text of 01-13 and the 314
    questions, including the 83 act-1 questions waiting for your approval.
    It only flags; you decide. *Why:* those 83 approvals are what stands
    between the course and a runnable Prelim, and this makes them faster.

12. **Planet and moon summaries.** Drafts of the one- or two-sentence planet
    summaries, which your 25 Sep ruling already allows to be drafted. *Why:*
    it is R3's last open box.

13. **Glossary.** Every definition in a chapter, quoted exactly with its
    source. *Why:* a ready revision aid. A student-facing glossary page
    (`/app/notebook`) is planned but not built, and **building it needs its
    own approval**.

14. **Lecture aids, for you only.** A slide outline, board notes, or a
    one-page review sheet, made only from text you have approved. *Why:* it
    saves preparation time. A review sheet becomes a student handout only
    if you choose.

15. **Question revision hints (later).** Once a question has been answered
    30+ times, questions that strong and weak students get equally right or
    wrong are flagged, with a suggested new version. Existing questions are
    never edited, only versioned. *Why:* it improves the bank from real
    results. It waits until real exposures exist.

16. **Feedback digest (later).** Student feedback summarised for you.
    *Why:* it is quicker to read. It stays on the laptop's model, because it
    is student data.

**Removed since v2:** audiobook preparation (the MP3s are scrapped).
**Not in this plan:** a student-facing AI tutor. It would answer students
live from unapproved text, and could hint at answers during papers (hard
rules 1, 5 and 9). It would need its own proposal.

## 7. The test: syllabus chapters 13-17 of this book

| Chapter | Book chapter | Why it is in the test |
|---|---|---|
| 13 RISC | 15 | **the benchmark**: a Claude session already drafted it (with two figures), so the two drafts can be compared side by side |
| 14 Instruction-level parallelism | 16 | the real test: no draft exists |
| 15 Control unit operation | 20 | the real test; also tests the chapter map, since the numbers differ most here |
| 16 Microprogrammed control | 21 | the real test |
| 17 Multicore | 18, also 17 | the real test, and the only one drawing on **two** book chapters |
| 18 Distributed systems | none | no edition covers it, so the tool must **stop and say so**. That is part of the test too |

**What gets measured, per chapter:** how many figures the reader found
against the captions in the text; how many summaries passed the grounding
check first time; whether every quote verified (it should be all of them);
claim-check flags; questions that passed the blind critic; the time the
laptop took; and in the end **how much you accepted, edited or rejected**.
That last number answers "is Ollama enough?" with evidence.

Test drafts stay inside the tool until you accept one. **Accepted ones go to
OCTA at draft/review**, as usual, so the 6 Oct ruling that authoring stops at
chapter 12 is not overridden by the test itself. Whether accepted 13-17
material goes live is your call on `/content` and `/items`.

## 8. What it will not do

- Write OCTA's course tables, approve anything, or export a draft you have
  not accepted.
- Serve the book or its crops publicly, or commit them to git.
- Let a student in.
- Decide what is correct: the checks and you do.
- Draft from a book chapter that does not exist, as with chapter 18.

## 9. Build order and effort — LAST in the implementation plan

The instructor ruled the assistant **last**. It starts only once the queue
before it is done: ruling 4 verified on the deployment, R5, and anything
added ahead of it. Then:

| Step | What | Sessions |
|---|---|---|
| B0 | Install Ollama on this laptop (approved) and try `qwen3.5:4b`, `qwen3.5:9b` and `gemma4:12b` on book 15's figures. **This answers "is it enough?" before anything else is built**, and fixes the model tiers | 1 |
| B1 | Figure reader + chart data for this book (fix the caption locator; check all ~355 figures are found) | 1 |
| B2 | Schema: books, jobs, heartbeats, paired devices, catalogue, drafts, **each with a course and an owner**. Staff-only, owner-only RLS with denial tests; an idempotent addendum pushed to Supabase first (hard rule 10) | 1 |
| B3 | **The app**: the worker, pairing, heartbeat, Realtime jobs, Ollama detection and model download by hardware; one unsigned Windows executable; the setup guide | 2 |
| B4 | **The API routes** (pairing, jobs, results with the checks, export) and **the console page `/assistant`**. A new console page, so it is born with a template, a `SPEC.md`, a spec, and captures at 1440 and 380 | 2 |
| B5 | Figure summaries + grounding check, then the redraw renderers | 2 |
| B6 | Lesson text + claim check; questions + critic; export | 2 |
| B7 | Extras 10, 11 and 12: the coverage map, the review of existing work, planet and moon summaries | 1-2 |
| B8 | **The test on 13-17**, written up with the numbers | 1 |
| B9 | Book and syllabus intake for a new book | 1 |
| B10 | Extras 13-16: glossary, lecture aids, then question revision hints and the feedback digest when real data exists | 1 each |

About 15 sessions in all.

## 10. Decisions

**All made, 7 Oct 2026** (the second-round table at the top). One thing is
left for later, not for now: the separate plan for OCTA serving several
courses and teachers.
