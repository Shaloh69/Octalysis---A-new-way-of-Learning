# `/app/map` — SPEC

**The whole course as one still picture of the solar system, with every stage a
real button a student can reach from the keyboard in curriculum order. Selecting
one opens a panel, in place, saying what it covers, whether it is open, and why
not. The page opens by saying what to do next.**

`PAGE-SPECS.md` §/app/map is the plan: *a first-class route, not a fallback*;
the same 19 nodes and 18 edges as SVG plus real focusable buttons;
bookmarkable; focus order in curriculum order; the accessibility floor is
measured here. §/app's original rows add: a locked node shows **why and how
far**; a read-only preview of a locked stage's objectives; *"Pick up where you
left off"*. `WEB-REVAMP.md` §2 adds "what do I do next" and the lock reason
legible on the map; §3.1 and §3.9 say `/app/map` opens **the same planet
sidebar** as `/app`, in place, never by redirect. Reference: `SOURCE.md`
(roadmap.sh). No biome on this route (`BIOME-AND-LOADING-SPEC.md` §1b).

**Hard rule 4 governs every state and every lock on this page.** `state`,
`mastery`, `lockReason` and `edges` are the API's, from `is_stage_unlocked()`
and `routes/stages.ts`; the client decides none of them and prints the reason
verbatim. **Hard rule 5 governs the words about the course:** titles,
objectives and summaries come from the API; a summary shows only once the
instructor has approved it (0 of 19 today).

## What was missing — 29 Sep 2026, before the rebuild

Measured on the build as `232129006` (`before/`, and the audit in the session):

- **0 edges drawn**, under a subtitle saying *"Every connection below is a real
  prerequisite"*
- **A lock's reason only in screen-reader text.** A sighted student saw a dim
  dot; clicking it warped into the stage page to find out why
- **No panel on this route**: a click on any stage went straight into it
- **Nothing said what to do next**: *1 of 19 subsystems online*, then the map
- **Stage ids at ~8px at 380**, and targets there 15.3px apart
- Both links in **browser-default purple** (no base `a` rule, `WEB-REVAMP.md` §1)
- A *"Turn your phone sideways to explore the solar system"* prompt, on the
  route a student chose **to be** flat; the first-run card and its `?`
- The accent painting **states** (available, in progress and mastered planets,
  and the sun), which `apps/web/CLAUDE.md` forbids; a seeded accent can be red
- The page standing on `var(--bg)`, which is defined nowhere (§0p.1)

## Instructor decisions, 29 Sep 2026

1. **The planet sidebar lands here**, built so `/app` reuses it next session:
   title, summary only once approved, the objectives in words, levels and
   minutes, state and `lockReason` verbatim, **Enter journey** (disabled when
   locked, with the reason beside it). **No biome yet** (one per planet does
   not exist, §3.5) and **no moon mastery** (no data, §3.7): both absent, with
   nothing standing in for them
2. **The resume card: the server chooses the stage, the device adds the spot.**
   The first stage `in_progress` in curriculum order, else the first
   `available`. If this device's reader kept a position for it
   (`octa:reader:<id>`, never gradeable), the card adds *You were reading: …*
3. **One flat presentation.** `/app`'s in-place fallback (reduced motion, a
   small screen, no WebGL) mounts the same component (`FlatMap.tsx`), so
   degrading looks exactly like this route. `/app`'s 3D path, header and
   controls are untouched
4. **The 18 edges are always drawn, quietly**; the selected stage's own are
   emphasised

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **A stage** (19 buttons; on its planet at a wide map, a list row below 560px) | Opens the panel for that stage in place, focus to its heading; `?stage=NN` so it is bookmarkable and Back closes it | Its name is *Stage 06 External Memory In progress 40%*, and a locked one adds the API's reason | Yes: Escape, Close, Back, or another stage | The picture IS the Computer Level Hierarchy (radius is level) and the lines ARE the prerequisites |
| **Enter journey** (panel) | Travels (the warp, §4.1) into `/app/stage/NN` | Verb, with the stage named above it and in its accessible name | Yes: Back returns to the map with the panel still open (§3.3) | — (navigation) |
| **Show Stage NN** (panel, a locked stage) | Selects the stage the lock names | Verb and object, the id from `lockReason.blockingStages` | Yes | The lock IS the prerequisite graph: following it walks the graph |
| **Close** (panel) | Closes the panel; focus returns to the stage | *Close*, named *Close Stage 06 details* | Yes | — |
| **Go to Stage NN** (the card) | Travels into the stage the card names | Verb and object | Yes: Back | — |
| **Show on the map** (the card) | Selects that stage, opening its panel | Verb and object (the card names it) | Yes | Where you are, on the whole picture |
| **Skip the stage list** (on focus only) | Moves focus past the 19 stages to the key | Says what it skips | Yes | — |
| **Show the galaxy**, **All 19 stages as a list** (links) | `/app`, `/app/stages` | Destination named | Yes | — |
| **Try again** (a failed read) | Repeats the read | Beside the sentence saying what failed | Yes | — |

Nothing on this page writes to the server, so it raises no toast. A locked
stage is still a button: selecting it is how a student learns why it is shut.

## Layout

- **1440:** the route's own ground (`--surface-0`). The head (eyebrow, the
  `h1` *The machine, one subsystem at a time*, *N of 19 subsystems online*,
  the two links) over a grid: **left**, the resume card, then the map (a square
  picture up to 760px, the 19 buttons as 32px discs on their planets), then the
  key; **right**, a 22rem **panel**, sticky, holding *No stage selected* and an
  invitation until a stage is chosen. The column is always there, so selecting
  moves nothing
- **Below a map width of 560px** (container query, not viewport): the picture
  stays, still, with the selected stage ringed on it; the same 19 buttons
  become rows under it (disc with the id, title, state), each at least 44px.
  One DOM, one Tab stop per stage, the same order
- **Below 1024px viewport:** the panel is a **bottom sheet** (70vh, scrolls,
  Close top-right), opened by a selection, over the shell's nav (root at z 2,
  NEXT-SESSION §0q)
- Panel order: `Stage 06` eyebrow, title (`h2`, focused on open), summary if
  approved, **state** (mark and words; locked: *Not open yet*, the reason
  verbatim, *Show Stage NN*), **Enter journey** and Close, then minutes and
  levels, then **What it covers** (*What it will cover* when locked: the
  read-only preview) with each objective's id in mono. The action sits under
  the state so the reason is beside a disabled Enter journey; the objectives
  follow because stage 03 has 11 of them
- The surface checks are scoped to `[data-flatmap]`: the shell's nav is inside
  `<main>` (NEXT-SESSION §0p.2)

## Marks

State is **shape and words, never colour alone, and never the accent**:

| State | Disc | Word |
|---|---|---|
| `locked` | dashed rim, dim ground | *Locked* |
| `available` | open ring | *Not started* |
| `in_progress` | half ring | *In progress* and the best check in mono |
| `mastered` | filled | *Mastered* |

The **accent marks the student's own place and nothing else**: a ring on the
stage the card names (*your next stage*). The selected stage wears an ink ring.
The sun is neutral. Edges: `--line`, dashed into a locked stage, stronger for
the selected stage's own.

## States

loading (the head at once; **nothing else under 400ms**, a skeleton of the
card, the picture and the panel after, and a sentence at its top after 3s) ·
ready · **a failed read** (what failed, from the API's sentence, Try again) ·
empty (no stages published: says so) · offline (the shell's banner). Saving:
nothing here saves.

## Words

- Card: *Pick up where you left off* (a stage in progress) or *Next up* (the
  first open one); *Stage 06 · External Memory*; the reader's state line
  (*In progress: your best check is 40%*, *Not started*); *You were reading:
  RAID: what to do when a disk dies* when this device has one. Nothing open:
  *Nothing is open to you yet* and the first lock's reason. Everything
  mastered: *Every stage is mastered.*
- Panel, nothing selected: *No stage selected. Choose a planet, or Tab to one,
  to see what it covers and whether it is open to you.*
- Loading after 3s: *Still arriving. The server may be waking up, which can
  take up to a minute.*
- A failed read: *The map did not load.* and the API's sentence.
