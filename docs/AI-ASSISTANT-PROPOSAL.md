# The "Octalysis AI" proposal — analysis

Proposed by the instructor, 6 Oct 2026: a free web AI (Ollama running Gemma 2B,
Streamlit, Plotly, PyPDF2, ChromaDB, hosted on Streamlit Community Cloud, embedded
by iframe) that reads the book and the syllabus and produces topics and subtopics,
summaries, citations, test items (MCQ, short answer, essay) and charts.

**Scheduled:** the session after the audiobook (work order in
`docs/FIGURES-AND-AUDIO.md`). This document is the analysis to decide from.

## Verdict

**Do not build it as written.** It cannot run where it says it runs, it would publish the
copyrighted textbook, and it bypasses the approval gates the course depends on. Most of
what it offers already exists here with stronger guarantees.

**What is worth building** is a smaller thing: a **local, staff-only drafting
assistant** that writes into the pipeline OCTA already has, so everything it produces is
checked and approved like any other draft. Details at the end.

## Problems, in order of severity

1. **It cannot run as described.** Ollama is a local server: it runs on the machine where
   it is installed. Streamlit Community Cloud runs your Python on a small shared container
   with about 1 GB of memory and no GPU. You cannot install or start the Ollama daemon
   there, and Gemma 2B needs roughly 1.5 to 3 GB of memory on its own. So "runs locally,
   no fees" and "free public website on Streamlit Cloud" are two different apps. The hosted
   one would have no model to call unless it paid for a hosted LLM API, at which point it
   is no longer free.

2. **It would publish the textbook.** The plan uploads the book PDF, extracts it with
   PyPDF2 and stores it in ChromaDB, inside a public website. The textbook is copyrighted.
   This project keeps even its own extracted text out of git for that reason
   (`.gitignore`, `.claude/rules/content.md`). A public app that answers questions from the
   book's text redistributes it.

3. **It breaks hard rule 5 (never invent course content).** A 2-billion-parameter model is
   small. On a technical subject it will paraphrase definitions loosely and state wrong
   facts fluently. OCTA already caught one fabricated definition that read perfectly well
   (`sync-content --verify`). Generated text is acceptable here only as a **draft** that is
   checked against the book and **approved by the instructor**, which is exactly what the
   chapter drafts, item review and figure review already do.

4. **It breaks hard rule 1 if students can reach it.** It generates test items, and with
   them their answers, in a public app. OCTA exists because the old course shipped every
   answer to the browser. Items belong in the bank (`/items`), at `review` until approved,
   and the key never leaves the server.

5. **It duplicates what is built, with weaker guarantees:**

   | The plan | Already in OCTA |
   |---|---|
   | Topics and subtopics | stages, syllabus objectives, moons per objective |
   | Summaries | planet summaries and lesson text, approved on `/content` |
   | Citations linked to page or section | `source="ch-NN.md §"` on every quote, verified verbatim; `book-map.json` for the edition's numbering |
   | MCQ, short answer, essay | the item bank: static, parameterised (solver-backed, a unique paper per student) and ordering items, reviewed on `/items` |
   | Graphs and diagrams | figures, drawn as SVG in the course's tokens, approved on `/content` and `/items` (6 Oct 2026) |

6. **An iframe does not fit the student app.** It would bring a second look (Streamlit's)
   into a page held to the tokens, AA contrast in seven biomes, keyboard operation and 380px
   with no sideways scroll. None of those can be enforced inside someone else's frame.

7. **Smaller points.** PyPDF2 is deprecated in favour of `pypdf`, and this project's
   extraction (`scripts/extract_book.py`) already exists. Plotly draws data charts well, but
   most of this course's diagrams are block diagrams and timing diagrams, which the SVG
   figures handle better. Essay items need human marking, which the bank does not grade.

## What to build instead: a local drafting assistant

- **Where it runs:** on the instructor's own computer. Ollama is free there. No public URL,
  no copy of the book anywhere but that machine.
- **What it writes:** the same files a session writes now. That is
  `content/stages/NN.draft.md` (lesson text), `content/items/NN.json` (questions, at
  review) and `content/figures/<id>.svg` (figures).
- **What keeps it honest:** nothing it writes reaches students. It goes through
  `sync-content --verify` (quotes checked against the book), the figure checker, then
  `/content` and `/items` approval, bound by hash.
- **The model:** Gemma 2B is too small to trust on this material. If the computer can run
  one, a 7-9B model drafts noticeably better. Either way the output is a draft.
- **The UI:** a Streamlit page on localhost is fine for this, because it is a tool, not a
  course page. It never ships to students.

**Decide at the start of that session:** build the local drafting assistant, or drop the
idea. If it is built, it needs its own plan (inputs, the prompts per file type, how it
calls `sync-content --verify`), and the instructor's approval of that plan before code.
