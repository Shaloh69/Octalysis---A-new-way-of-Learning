# The drafting assistant — plan v2, FOR APPROVAL

**v1** (6 Oct 2026) planned a small local tool for lesson text, questions and
figures. **v2** (7 Oct 2026) answers the instructor's reply to it:

> "I want this AI to properly do what you were doing with all of the books.
> Summarising the figures, charts and graphs. And think about more features
> also. Planning first, before implementation: come back to me first."

**No code exists.** Nothing here is built until the decisions in §9 are made.
The analysis that led here is `docs/AI-ASSISTANT-PROPOSAL.md`.

---

## 1. What it is, in one paragraph

It's a staff-only tool that takes a chapter of the textbook and drafts the
same files a session drafts today: lesson text, questions and redrawn figures.
It adds one new kind of output, a **catalogue of every figure, chart, graph
and table in the chapter**: what each one shows, in our own words, its exact
labels and numbers, the objectives it serves, and whether it is worth
redrawing. Every draft goes through the checks and approvals that already
exist (`sync-content --verify`, `sync-items --check`, the figure checker,
then `/content` and `/items`). A student sees nothing it produces until the
instructor approves it.

## 2. The job it reproduces: what a session did with the book

Chapters 08-12 and their 17 figures were drafted by Claude Code sessions,
and this is the work the assistant has to repeat:

1. Find the right book chapter through `content/book-map.json`. The
   syllabus follows the 9th edition and the book in hand is the 10th, so
   syllabus 12 is book 14.
2. Read the chapter against the syllabus objectives and organise the lesson
   around what a student must be able to *do*.
3. Write original explanation, and **quote every definition and fact
   verbatim** with `source="ch-NN.md §"`. `--verify` checks each quote
   character by character.
4. **Check every sentence that is not a quote against the book.** On 6 Oct
   this caught three of the session's own errors in questions 09-12.
5. Read the chapter's figures, pick the ones that teach an objective, and
   **redraw** them as our own SVG. That means the eight `fig-*` classes, no
   colour, a viewBox no wider than 440, text at least 14 units, a `<desc>`
   long description, a caption, and an `after="N.N"` credit.
6. Write at least three questions per objective, each with distractors that
   name real misconceptions, a rationale, a source, and registered solvers
   for computed items. A question never names a figure it does not show, and
   its figure never draws the answer.
7. Preview each figure at 380 and 1440, **look at it**, and only then sync it
   at draft for the instructor to approve.

## 3. Measured today (7 Oct 2026)

| Fact | Measured |
|---|---|
| Book text | 21 chapters, **1.8 M characters** (about 450 k tokens), already extracted to `docs/source/book/` (gitignored) |
| Figures | **~355** figure captions in the text, plus **~150 tables** |
| How the figures are stored | as **vector drawings**: the trial pages had 30-65 drawing paths and **0 embedded images**. Their labels are real text with positions, and the points on a chart are real shapes with coordinates |
| Can a figure be cut out of the PDF? | **Yes, with a fix needed.** A 20-line trial crop found 2 of 4 figures, and both came out clean: Fig 14.10 (the pipeline timing grid) and Fig 2.2 (processor trends, a log-scale chart with four series). The other two were missed because the captions are set with non-breaking spaces, which the caption locator has to handle |
| This laptop | RTX 3050 Laptop GPU with **4 GB VRAM**, 16 GB RAM, Python 3.13 and PyMuPDF. **No Ollama** |

What the vector finding means: today's extractor keeps only the text layer,
so a figure reaches us as a caption plus scattered labels. Because the
drawings are vectors, a chart's data can be **read exactly from the PDF**.
Nobody, human or model, has to estimate values by eye.

## 4. The design: code does everything that can be checked, the model only drafts

```
 book PDF ──► [A] figure reader (code)  ──► crops + exact labels + chart data
                          │
                          ▼
 chapter text ─► [B] figure summaries (model, sees the crop) ──► grounding check ──► catalogue
                          │
                          ├─► [C] figure redraw: model writes a spec, code draws the SVG ──► figure checker ──► preview 380/1440
                          ├─► [D] lesson text: model cites spans, code pastes the exact words ──► --verify + claim check
                          └─► [E] questions: model drafts, code computes the keys ──► --check + blind-answer critic
                                                   │
                                     [F] local review page: book crop beside our draft, every check result
                                                   │
                                  "Accept" moves the file into content/ ─► sync at draft/review ─► /content, /items
```

### A. Figure reader (no model, deterministic)

`pnpm assist:figures <chapter>` runs once per chapter with PyMuPDF, in the
same script family as `extract_book.py`. For each figure and table it saves:

- a **crop** (PNG, 150 dpi) in `docs/source/book/figures/`, which is
  gitignored because it is the book's own artwork
- the **exact text labels** inside the figure, with their positions
- for charts: the **axes** (ticks, scale, linear or log), the **series** (by
  legend marker) and every **data point**, converted from page coordinates
  to axis values
- its page, its book number, and the syllabus chapter it belongs to (through
  `book-map.json`)

### B. Figure summaries: the core of the request

For each figure, the model gets the crop, the extracted labels and data, the
paragraphs that cite it ("Figure 14.10 shows…") and the chapter's
objectives. It writes one catalogue entry:

| Field | What it holds |
|---|---|
| `kind` | block diagram · state diagram · timing/pipeline grid · bit-field format · flowchart · circuit · chart · table · listing |
| `summary` | 2-4 sentences in **our own words**: what it shows and why it matters |
| `takeaways` | the 1-3 facts a student should leave with |
| `objectives` | which syllabus objectives it serves |
| `chart` | for charts: axes, series, and the trend stated **with numbers taken from the extracted data** |
| `verdict` | **redraw** (it teaches an objective) · **describe** (the words are enough) · **skip** (with a reason) |
| `desc`, `caption` | drafts of the accessible long description and the caption, used if it is redrawn |

**The grounding check** is the figure version of `--verify`. Every label
the summary names and every number it states must exist in that figure's
extracted labels or data. If one does not, the entry is refused and
returned with the unmatched words marked. This is what stops a fluent,
wrong description.

The catalogue (`content/figures/catalog/ch-NN.json`) is in our own words,
so it can be committed. It is staff material: nothing in it reaches a
student. Its summaries **feed** the lesson text, the questions and the
redraws.

### C. Figure redraw: the model writes a spec, code draws it

Asking a model to write SVG directly produces broken, off-grid art. Here
the model writes a small **spec** (boxes, arrows, rows, fields, series), and
one **renderer per kind** draws it. The first renderers are pipeline/timing
grid, bit-field format, block diagram, state diagram and chart (line,
scatter, bar; linear or log axes). Only the eight `fig-*` classes are used,
so the result passes `figure-svg.mjs` by construction.

- **Charts and graphs are re-plotted from the extracted data or the book's
  formula** (Amdahl's law, for example), never estimated by eye. The
  caption says which source was used.
- Every redraw is rendered to PNG at 380 and 1440 and shown **beside the
  book's crop**, so the reviewer compares the two directly.
- A question's figure is drawn for that question and must never show its
  answer (the existing rule, 6 Oct).

### D. Lesson text: quotes pasted by reference, unquoted claims checked

- The model never types a quote. It cites a span
  (`ch-14.md §14.4 ¶3 s2-s3`), and the tool pastes the book's exact words.
  `--verify` then passes by construction, and a misquote cannot happen.
- **Claim check:** a second pass pairs every factual sentence in our own
  prose with a supporting span in the book. A sentence with no support is
  **flagged for the instructor**, not silently dropped. This is step 4 of §2,
  automated.
- Figures are placed with the existing `figure` block, chosen from the
  catalogue's **redraw** entries.
- Output: `content/stages/NN.draft.md`, which goes through the same
  `chapter_drafts` approval as today.

### E. Questions: the model drafts, code holds the keys

- Same shape as `content/items/NN.json`: slug, objective, type, bloom,
  difficulty, stem, correct, distractors, rationale and source.
- **Computed items use only registered solvers.** The solver computes the
  key, never the model.
- **Static items carry a supporting span** for the correct answer.
- **The blind-answer critic:** a second pass answers each item from the stem
  and options alone, without seeing the key. A disagreement, two defensible
  answers, or an item it can answer without the course is flagged.
- **A duplicate check** against the existing bank, so a new item does not
  repeat a live one.
- Output lands at `review` on `/items`, as today.

### F. The review page (local)

This is a page served on `localhost` by the tool itself (plain HTML, not
Streamlit, and not part of either app). You pick a chapter and a job,
watch it run, then review: the book's crop beside our redraw, the summary
with every grounded word marked, each check's result, and the run's cost.
**Accept** moves a passing file into `content/`. **Reject** keeps it in the
run folder with your note. A CLI does the same for scripted runs.

Every run keeps its prompts, raw outputs, check reports and cost in
`.assistant/runs/<date>-<chapter>-<job>/` (gitignored), so a draft can
always be traced back to what produced it.

## 5. The engine: the main decision

The tool is the same in every case: the reader, the checks, the renderers
and the review page. The only thing that changes is which model drafts.

| | **A. Local (Ollama)** | **B. Claude API** (recommended) | **C. Claude Code, as now** |
|---|---|---|---|
| Quality on this material | weakest. A 7-8 B model writes plausible prose and reads dense diagrams poorly, so expect many refused drafts | the same model family that wrote 08-12 and the 17 figures, with strong vision for figures | the same as B |
| Fits this laptop? | partly. A 3-4 B vision model fits 4 GB (`qwen2.5vl:3b`, `gemma3:4b`); a 7-8 B text model spills into RAM and is slow (a chapter's lesson draft in tens of minutes, an estimate) | yes, nothing runs locally | yes |
| Cost | free | **about $3 per chapter** on Opus 5.5 ($4/$20 per M tokens), **about $50 for chapters 01-17**; roughly half that through the Batch API, and half again on Sonnet 5.5. Estimates, re-measured on the trial chapter | inside the existing Claude subscription |
| Where the book goes | nowhere: it never leaves the machine | excerpts and crops are sent to Anthropic for processing, the same exposure these Claude Code sessions have had all along. Nothing is published | the same as B |
| Who can run it | you, from the review page | you, from the review page | only from a Claude Code session; no button to press |
| Needs | installing Ollama | an Anthropic API key in the **root `.env` only**, never a `VITE_` variable (hard rule 2) | nothing |

**Recommendation: B, with A kept as an offline fallback.** The point of the
request is to do what the sessions did, and a 4 GB local model cannot. The
checks catch bad drafts either way, but with A most drafts would fail them,
and the tool would save you no time.

The cost per chapter is what the trial chapter (§8, A1) measures first. A
spending cap is set in the Anthropic console before any run. C costs
nothing to keep: the tools are plain commands, so a Claude Code session can
drive them too.

## 6. More features: what else it can do

All of these sit behind the same approvals. Nothing reaches a student
unapproved.

| # | Feature | What it gives you | Reaches students? | Priority |
|---|---|---|---|---|
| 1 | **Figure catalogue + summaries** (§4 B) | every figure, chart, graph and table, summarised and grounded | no (staff) | **core** |
| 2 | **Figure redraw** (§4 C) | SVG drafts with the book's crop beside them | after /content approval | **core** |
| 3 | **Chart data recovery** (§4 A) | exact series for every chart, so a graph is re-plotted, not estimated | through #2 | **core** |
| 4 | **Coverage map** per chapter | objectives × lesson sections × questions × figures, with gaps marked (an objective with fewer than 3 items, a figure on no objective) | no | high |
| 5 | **Claim audit of what is already written** | runs the claim check over the lesson text of 01-13 as it stands and lists unsupported sentences. So far the claim check has been done by hand only once, on questions 09-12 | no (a report) | high |
| 6 | **Bank critic** | the blind-answer critic and duplicate check over the existing 314 items, including the 83 act-1 items waiting at review on the deployment. It flags; you decide | no | high (it speeds up the approvals the Prelim waits on) |
| 7 | **Planet and moon summaries** | drafts for the summaries R3's last box waits on (ruling exception 1 already allows these) | after /content approval | medium |
| 8 | **Audiobook preparation** | a pronunciation list for the MP3s ("x86", "MIPS", hex, register names) and the text to read for each figure. The lesson text itself is unchanged | through Listen | medium, with the TTS key |
| 9 | **Glossary** | verbatim definitions with sources, per stage. It could feed the unbuilt `/app/notebook`, but **building that page needs its own approval** | only if that page is approved | medium |
| 10 | **Instructor's lecture aids** | slide outline, board notes, a one-page chapter review sheet (a handout like the claim-account PDF), drawn from **approved** text only | a handout only, if you choose | low |
| 11 | **Item revision hints** | once an item has 30+ exposures, poor discrimination is flagged with a suggested new version (rule 6: a new version, never an edit) | no | later (needs real exposures) |
| 12 | **Feedback digest** | student feedback (P8) summarised for you | no | later, and **only on engine A**: it is student data |

**Not in this plan, and why:** a **student-facing AI tutor**. It would
answer students live, from text nobody approved, and could leak or reason
toward answers during papers (hard rules 1, 5 and 9). If you want one, it
needs its own proposal and rulings, and it would come after this tool has
earned trust.

## 7. What it will not do

- Write to the database, approve anything, or move a draft into `content/`
  without your Accept.
- Run where students can reach it, ship in either app's bundle, or put the
  book, crops or extracted text into git or any public place.
- Decide what is correct. The checks and you do.
- Draft chapter 18 from the book. No edition covers it, so the tool stops
  and says so (`.claude/rules/content.md`).
- Draft lesson text past chapter 12 while the 6 Oct ruling "stop all
  authoring only until chapter 12" stands (decision 3 below).

## 8. Build order and effort

| Step | What | Model? | Sessions |
|---|---|---|---|
| A0 | **Figure reader**: crops, labels and chart data for every figure in 01-17. Fix the caption locator (non-breaking spaces) and check that all ~355 are found | none | 1 |
| A1 | **Engine + figure summaries + grounding check**, trialled on **syllabus 12 (book 14)**, where the session already did the work. Compare the two, and measure the real cost per chapter | yes | 1 |
| A2 | **Redraw renderers** (grid, bit-field, block, state, chart) + previews beside the crop | spec only | 1-2 |
| A3 | **Review page** | none | 1 |
| A4 | **Lesson text** by reference + claim check, trialled on a chapter already drafted | yes | 1 |
| A5 | **Questions** + blind critic + duplicate check | yes | 1 |
| A6 | Features 4-8 from §6, in the order you choose | mixed | 1 each |

A0 is useful even if nothing else is approved: it is pure code and needs no
model. Where it fits in the work order is decision 4.

**Where it lives:** `tools/assistant/` (Node + TypeScript, like the rest of
the repo, reusing `figure-svg.mjs` and the sync scripts) and
`scripts/book_figures.py` (PyMuPDF). It touches no table, so no schema
change and nothing to push to Supabase (hard rule 10 is not triggered).

## 9. Decisions wanted

1. **The engine:** B (Claude API, recommended), A (local Ollama), or both?
   If B: who holds the API key, and what monthly cap?
2. **Which machine:** this laptop (RTX 3050, 4 GB)? Engine A needs Ollama
   installed there.
3. **"All of the books":** the 6 Oct ruling stops lesson text at chapter 12.
   Should the assistant (a) catalogue and summarise figures for **all of
   01-17** but draft text only to 12, (b) lift the stop for 13-17 as drafts
   at review, or (c) stay at 01-12 entirely?
4. **Order:** start A0-A1 next, or after the current queue (the TTS MP3s,
   ruling 4 verified live, R5)?
5. **Which features from §6**, beyond the core three?
