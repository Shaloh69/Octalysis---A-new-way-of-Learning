# The local drafting assistant — plan, FOR APPROVAL

Decided 6 Oct 2026 (instructor, asked once): of the "Octalysis AI" proposal
(`docs/AI-ASSISTANT-PROPOSAL.md`), build only a **local, staff-only drafting
assistant**, and only after this plan is approved. **No code exists yet.**

## What it is

A small tool that runs on the instructor's own computer and drafts the same
three kinds of file a session drafts today. It writes **files**, never the
database, and every file then goes through the gates that already exist. A
student never sees anything it produces until the instructor approves it on
`/content` or `/items`.

| It drafts | Into | Then, unchanged, the existing gate |
|---|---|---|
| Lesson text for a chapter | `content/stages/NN.draft.md` | `sync-content --verify` (every quote checked verbatim against the book), then approval per chapter on `/content`, bound to its hash |
| Questions | `content/items/NN.json` | `sync-items --check` (shape, solver ids, no figure named that is not shown), then each item approved on `/items` |
| A figure | `content/figures/<id>.svg` | the figure checker (`scripts/lib/figure-svg.mjs`: an allowlist, the eight `fig-*` classes, no colour), then approval on `/content` or `/items` |

## Where it runs, and what it reads

- **On the instructor's machine only.** Ollama serves a local model; there is
  no public URL, and nothing is uploaded anywhere.
- **The model:** a 7-9B instruction model if the machine can run one
  (Gemma 2B is too small to trust on this material). Which one is chosen by
  trying two on one chapter and comparing their drafts against the book.
- **Its sources, and only these:** `docs/source/book/ch-NN.md` (already
  extracted locally by `pnpm book:extract`, gitignored), the chapter's
  syllabus objectives (from the database, `objectives`), `content/book-map.json`
  (so it cites the 10th edition's numbers), and, for questions, the solver list
  (`services/api/src/engine/solvers-act*.ts`).

## How it works

1. The instructor picks a chapter and a job (lesson text, questions, or one
   figure) in a local page (Streamlit on `localhost`, or a plain CLI).
2. The tool sends the model the chapter's text, the objectives and a fixed
   prompt for that job (below), and asks for the target file's exact format.
3. It writes the draft to a **scratch** copy, runs the matching check
   (`sync-content --verify` or `sync-items --check` or the figure checker),
   and shows the result. A draft that fails a check is shown with its errors
   and is **not** moved into `content/`.
4. A draft that passes is moved into `content/` on request. From there,
   `sync-content` / `sync-items` put it into the database **at review**, as
   today, and the instructor approves it in the console.

## The prompts, one per job (to be refined on a trial chapter)

- **Lesson text:** organise the chapter around the objectives; write original
  explanation; any definition or claim of fact must be a verbatim quote block
  with `source="ch-NN.md <section>"`; no markdown emphasis inside a quote; cite
  the 10th edition's numbers through `book-map.json`.
- **Questions:** for each objective, at least three items; every distractor a
  named misconception; a rationale per item; a `source` per item; use a solver
  (P item) only from the registered list; never name a figure.
- **Figure:** one SVG of one book figure's idea, in the allowed classes only,
  with a caption and an `after="N.N"` credit; never a copy of the book's art.

## What it will not do

- Write to the database, or approve anything.
- Run anywhere but the instructor's machine, or copy the book anywhere else.
- Be reachable by students, or produce answers outside the item bank (hard
  rule 1).
- Decide what is correct: the checks and the instructor do.

## Effort and order

About one session to build the CLI version and try it on one chapter; the
Streamlit page is optional. It goes after R5, unless the instructor wants it
sooner.

## Approval wanted

1. Build it as above? (CLI first, Streamlit optional.)
2. Which machine runs it, and may the session install Ollama there?
