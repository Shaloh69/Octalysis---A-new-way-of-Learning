# `/app/stage/:id/check` — the runner, remade — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §4). Templates: `template.png`
(Stardew Valley's quest card: one plain paper over the world) and
`template-journal.png` (Stardew's journal: framed rows), copied from
`_direction/biome/` (see `SOURCE.md`; both opened). The 29 Sep first pass is
kept in `first-pass/`: **its behaviour, its instructor rulings of 29 Sep and
its controls table all carry over unchanged** (`first-pass/SPEC.md` is still
the authority for them); only the look is new. Gate:
`design/specs/web-stage-check.spec.ts`, with `attempt-runner.spec.ts` for the
key-leak rule against the real API.

## Realm: biome chrome, neutral paper

Inside the planet: `html[data-realm="biome"][data-biome=<the planet's>]`, the
biome shell around the page (sprite nav bar, the scene, the readout and
key-hint sprite bars; PC is the question number).

- **The side bar is the planet's.** The question palette (`.check-palette`) is
  a sprite panel in the planet's frame: count, one 44px button per question
  (✓ recorded, ⚑ flagged, the current one in the student's accent, their own
  place), and the legend. At 1024 and up it sits left and sticks; under it, it
  stacks above the paper.
- **The paper is everyone's.** Everything a student reads or answers sits on
  `[data-paper]`, the neutral set in `looks.css`: the head (rule, resume
  notice), the question card, options, ordering rows, the answer box, Record,
  the verdict, Previous/Next, Submit and Leave the paper, the Submit
  confirmation, every state (loading, error, empty) and the result. No sprite,
  no biome colour and **no accent** on it: the paper's own `--lit-*` marks a
  choice and the primary action, so two students comparing screens see the
  same exercise. A verdict is words, never a colour.
- At 1280 and up the paper puts its actions (Submit, Leave) in a column beside
  the question; under that they follow it.

## What the spec holds it to

- The six gate assertions at 1440 and 380 (contrast in **all seven biomes**,
  the side bar and the paper together; the gate's token probe now reads the
  paper set too, through a `[data-paper]` probe)
- **Two biomes, one paper:** every computed colour, fill, edge and face on the
  paper is identical in jungle and cave, while the side bar's sprite differs
  (the control, so the comparison can fail)
- **Nothing on the paper is a sprite**
- Everything in `first-pass/SPEC.md`: choose then Record, resume, the neutral
  wrong answer, ordering, free entry, flag, the one confirmation, the result by
  objective, a final withholding verdicts, failures that say so and stay

## Captures (all opened, 30 Sep 2026, on the build at 5185)

`current` (jungle, resumed, ordering), `-recorded` (a wrong verdict),
`-chosen`, `-ordering`, `-entry`, `-confirm`, `-submitted`, `-cave`, `-arctic`,
`-desert` (same paper, three planets), `-error` (ocean), `-loading` (city),
`-final` (neutral); each at 1440 and `-380`.
