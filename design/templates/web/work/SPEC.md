# `/app/work` — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §8 row 8). Template: `template.png`
(`SOURCE.md`). Gate: `design/specs/web-work.spec.ts` (and `student-states.spec.ts`).
40% of the grade (labs 10%, project 20%, participation 10%) is handed in here.

## Realm

The star system: `html[data-realm="star"]`, no biome; the star shell.

## What it shows

- **The head**: "Your work" and the weights, in mono
- **The list** (HUD panel, "Handed in and drafts" · "Score"): **+ Hand in
  something new** first, then every hand-in as a row: title, code in mono,
  status in words (Draft, Handed in, Returned to you, Marked, Voided), late;
  and a score cell (`69/100` in mono, or —). One radio group; the choice is
  `?item=<id>` (`?item=new` for the form)
- **The summary box**: Handed in, Drafts, Marked, as numbers
- **The card**: lit title bar (title, code), a stat row (Kind, Status, Handed
  in, Due, Score). A marked one is read-only: the frozen line, the feedback,
  what was written. Otherwise the form: kind / code / title for a new one, and
  **the write-up is the largest field**, labelled with what it is worth.
  At 900 and up beside the list; under 900 under its row

## Controls and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **A row** | Shows that hand-in | Title, code, status, score | Choose another | Its feedback |
| **+ Hand in something new** | Opens the empty form | Verb and object | Choose a row | The rubric note on reasoning |
| **Save draft** | Saves, not handed in; one toast naming the code | Verb and object | Saving again replaces it | — |
| **Hand in** | Hands in (the server refuses without reasoning, and says why); one toast | Verb; disabled until code and title | Your instructor can return it | The rubric line beside it |

## States

Loading: nothing under 400ms, a skeleton of the list after, words after 3s.
Error: the page's h1, the reason, Try again. Empty: an invitation that names
the next move (open Hand in something new; drafts save any time). A failed
save: inline and a toast that stays; nothing typed is lost.

## Captures (opened, 30 Sep 2026, build at 5185, student 232129006)

`current` (the marked lab), `current-new` (the form), each at 1440 and `-380`
(the form inline under its button).
