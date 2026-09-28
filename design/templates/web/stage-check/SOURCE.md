# Source of template.png

`TEMPLATE-LINKS.md`'s row for `/app/stage/:id/check` names **Game UI Database,
Dialogue/HUD category** (`GAME-DESIGN.md` §4.3): *"one-item-per-screen with a
persistent status strip (Register Bar) is closer to a game HUD than a form
wizard: pull from game UI references, not SaaS quiz-app patterns."* That is a
lead. Captured 29 Sep 2026; the lead itself could not be.

## What was tried

| Lead | Result |
|---|---|
| **Game UI Database**, Dialogue: https://www.gameuidatabase.com/index.php?scrn=162 | **Rejected: not capturable.** HTTP **403**, title "Just a moment...": a Cloudflare "Verify you are human" challenge, the whole library behind it. `rejected-gameuidatabase-403.png` is what rendered |
| **Interface In Game**, the same kind of library, https://interfaceingame.com/screenshots/ | **Rejected: nothing of the right shape.** 200, capturable, but its element filters (store, main-menu, overlay, settings, character, in-game, inventory, stats, lobby, loading, map, level-selection, progress, quest, game-over) hold no question-and-answer screen. "Choose a challenge" (Armello) was captured and looked at: a radial dial of one choice over the board, not a question under a status strip. A search for "quiz" matches only game titles |
| **Persona 5**'s classroom questions, via the Megami Tensei wiki, https://megamitensei.fandom.com/wiki/Persona_5/Classroom_answers | **Rejected: not capturable.** HTTP **403**, the same Cloudflare challenge |
| **Professor Layton and the Curious Village**, puzzle screen, on Wikipedia | **Taken.** Below |

## The screen: `template.png`, `template-screen.png`

| | |
|---|---|
| URL | https://en.wikipedia.org/wiki/File:Curious_Village_Puzzle.png (the file page, HTTP **200**); the image itself, https://upload.wikimedia.org/wikipedia/en/d/d3/Curious_Village_Puzzle.png (**200**, 98,486 bytes) |
| Captured | 2026-09-29. The file page by Playwright (Chromium) at 1440×1100, `domcontentloaded` + 6s: `template-source-page.png`, which shows the image and Wikipedia's own description of it, *"Screenshot from the game … demonstrating the puzzle game interface"*, first puzzle, property of Level-5, used under Wikipedia's non-free rationale |
| `template-screen.png` | The original, 202×309, both DS screens |
| `template.png` | The same image scaled 3× with nearest-neighbour sampling (606×927), so its type can be read. Nothing else changed |
| Rendered | A game's one-puzzle screen. Top screen: a **status strip** across the top reading `No.001 · 8 PICARATS · COINS: 60` (which puzzle, what it is worth, the tokens you hold); under it the puzzle's text and its instruction, *"…and then touch Submit."* Bottom screen: the working area headed *"Circle the village!"*, a column of controls on the right, **HINTS 1 2 3**, **QUIT**, **CLEAR**, and **SUBMIT** alone at the bottom right |
| Opened | All four PNGs were opened and looked at before `SPEC.md` was written |

## What we take

- **The status strip is the frame, not the page.** Number, worth and tokens
  sit in one fixed strip above the item, in the same place for every puzzle.
  Ours is the shell's **Register Bar** (`PC` = the question number, in mono,
  per `.claude/rules/design.md`), plus a count of recorded answers in the
  runner's own head.
- **One item per screen.** The puzzle's words first, the working area under
  them; nothing from another puzzle is on screen.
- **Working is not answering.** Circling and clearing change nothing until
  **Submit**. The answer is a deliberate, separate act, at the foot of the
  working area, away from the other controls. This is the instructor's ruling
  of 29 Sep 2026 in its reference form: choose, then **Record answer**.
- **The instruction says how to answer, in words**, before the student starts
  (*"…and then touch Submit"*). Ours says the first recorded answer is final.
- **Quit is a control on the item, not a browser back button.**

## What we do not take

- **Hint coins.** `PAGE-SPECS.md` names hint tokens; they are not built and
  are deferred with the re-roll (they belong to practice, `WEB-REVAMP.md` §3.2).
  The strip does not reserve room for them
- **The pixel frame, the illustrated map, the colours.** `GAME-DESIGN.md` §5.1:
  *a theme dresses the encounter, never the assessment.* The check is "the same
  calm, flat, consistent surface every single time". Colours and type are ours,
  from `packages/tokens`
- **Picarats as a score.** Layton's puzzle value falls with each wrong try.
  Nothing here is scored in the client, and a question's worth shows only when
  it is not one mark
- **A timer.** Layton has none either; nothing in this system is timed
