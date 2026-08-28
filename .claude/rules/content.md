---
paths: ["content/**", "scripts/sync-content.mjs", "scripts/extract_book.py", "docs/source/**"]
---
# Content rules

**NEVER invent course content.** This is the highest-risk failure mode of building this app with
an LLM: plausible-sounding lecture text that is subtly wrong, which the instructor finds in week 6.

## The sources, in order of authority

| Source | What it settles | Where |
|---|---|---|
| **The syllabus** | which chapters exist, and the unit outcomes each must serve | `docs/source/CPE 412.docx` |
| **The textbook** | the teaching material for chapters 1–17 | `docs/source/book/ch-NN.md` |
| The two lecture decks | the **superseded** course. Evidence, not source | `docs/source/*-deck.md` |
| Named open references | chapter 18 only, which no edition of the book covers | `docs/CPE412-CURRICULUM.md` §4.1 |

The textbook is Stallings, *Computer Organization and Architecture*, **10th ed.** It is
**gitignored** — it is copyrighted, and extracted text is the same copyrighted work. Rebuild it
with your own copy: `pnpm book:extract`.

## THE BOOK IS NUMBERED DIFFERENTLY FROM THE SYLLABUS

The syllabus is written against the **9th edition**; the available copy is the **10th**. Ten of
eighteen chapters carry a different number. Syllabus chapter 15 (Control Unit Operation) is book
chapter **20**; book chapter 15 is RISC.

`content/book-map.json` is the translation and `pnpm book:map` proves it still holds against the
extracted manifest. **Never cite a chapter number without going through it.** Citing "Stallings
ch.15" for the control unit sends a student to the wrong chapter of the book in their hands.

## What you may and may not write

You **may** write original prose: explanation, structure, transitions, worked-example framing,
callbacks between stages. That is what teaching is, and a chapter reorganised around what a
student must be able to *do* teaches better than a chapter retyped.

You **may not** paraphrase a definition. Definitions, the book's own worked examples, and any
claim of fact are **quoted verbatim** in a block carrying `source="ch-NN.md <section>"`.

`scripts/sync-content.mjs --verify` diffs every sourced block against that chapter, unit by unit,
and CI fails if a span is not in it. **It has caught a fabricated definition that read perfectly
plausibly** — that is what it is for.

Keep quoted spans free of markdown emphasis. `**bold**` inside a quote changes the string being
matched and makes an honest quote fail.

## Reproduction, and the line this project draws

Writing teaching notes from a prescribed textbook is ordinary academic practice. Reproducing whole
chapters into a hosted platform is not. So:

- original prose, organised around the syllabus objectives — as much as you like
- short quoted definitions and worked examples, cited by section — yes
- figures **referenced by number and described**, never reproduced
- whole sections transcribed — **no**

## Where the book does not reach

- **Chapter 18 (Distributed Systems Architecture)** is in no edition of Stallings. Its topics cell
  in the syllabus is empty too, so its four unit outcomes are the entire specification. Use the
  three open sources in `CPE412-CURRICULUM.md` §4.1.
- The 10th edition **dropped** the functional-view figures the 9th had at Figures 1.2–1.5. Where
  the syllabus alludes to a 9th-edition figure that is gone, teach the content and **say so in a
  callout** rather than quietly omitting it.

If a chapter genuinely has no source for an outcome, **stop and say so.** The instructor authors
it; you do not.

## Authoring status, and how to leave a chapter unfinished

**Chapters 1-7 are authored. 8-18 are planned**, by decision -- the course ships with the first
grading period fully written and the rest following in later updates.

A planned chapter carries `<!-- block: callout kind="planned" -->` and tells the student, in plain
words, that the teaching text is coming. **Never leave a chapter looking finished when it is not**,
and never fill the gap with plausible-sounding paragraphs to make a page look complete.

## The objectives are not yours to reword

They are the syllabus's contract, transcribed verbatim from the DOCX. `pnpm check:objectives`
diffs every chapter against it and fails on any difference; `--fix` restores them.

This gate exists because chapter 3 was authored with **seven paraphrased objectives where the
syllabus has eleven** -- four outcomes the course is accountable for had quietly stopped
existing, and the only signal was an objective count dropping in a sync summary.
