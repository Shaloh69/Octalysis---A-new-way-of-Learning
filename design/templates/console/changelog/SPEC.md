# `/changelog` (console) — SPEC

**What changed in OCTA, day by day, and how far the whole system is.** Every
teacher and the admin (instructor, 7 Oct 2026, night: "Add Changelogs to both
the admin/teachers and student web to show the Updates We made. Also add all
the progress of the entire System there"). Answers the same night: the entries
are **both** written highlights and the full commit list; the progress is
**the build phases, course readiness and the planned work**.

Reference: `SOURCE.md` (shadcn/ui's changelog: one reading column of dated
updates, an index beside it). Colours and type are ours.

## Where the data comes from (nothing on this page is typed into it)

| Part | Source | When |
|---|---|---|
| Updates: highlights | `content/changelog/highlights.json`, written per day from that day's commits | build time |
| Updates: every change | `git log`: every `feat`, `fix`, `perf`, `content` commit | build time |
| The redesign R0-R5 and the build plan P0-P10 | `docs/redesign/phases/*.md`, `docs/PHASES.md`, through `scripts/lib/phases.mjs`, the reader `pnpm phase` uses | build time |
| What comes next, what waits on you | `content/changelog/roadmap.json`, from the approved plans | build time |
| Course readiness (the Prelim) | `GET /api/v1/console/progress`, staff only | live, on every visit |
| Chapters, summaries, figures, live questions | `GET /api/v1/console/content` (the existing route) | live |

`pnpm changelog` (`scripts/changelog.mjs`) writes
`apps/console/src/generated/changelog.json`; it is committed, because Vercel
builds from a shallow clone with no history. The page names the commit it was
made at.

## Structure, top to bottom

1. **Header**: h1 *Changelog*; a line: "What changed in OCTA, day by day, and
   how far the whole system is."; "Made at commit `b64a83d`, 7 October 2026."
2. **At 1440** (the page's own width at 64rem and up): the reading column
   (max 48rem) and, beside it, **On this page**: links to Progress, Course
   readiness, What comes next, and each month of Updates. Below 64rem the
   index is not drawn (the template's 380 drops it too).
3. **Progress** (h2)
   - *The redesign*: `238 of 245` steps (97%), then one row per phase R0-R5:
     id (mono), what it is, a bar (a meter with its value in text beside it),
     `done/total` (mono), and its state in a word (done / live / not started).
   - *The build plan*: P0-P10, each id (mono), what it is, and its status
     **verbatim** from `PHASES.md` (prose, so no bar is invented for it).
4. **Course readiness** (h2), live
   - The Prelim sentence, as the session rule states it, and never rounded
     up: "Prelim-worth of data is **not yet** okay to run on students." while
     any measured condition fails; when all measured ones hold: "Every
     condition that can be measured holds. One is checked by a person: …"
   - The five conditions, a list: a state in a word (*Holds* / *Not yet* /
     *A person checks*), the condition, its detail in mono numbers, and how it
     is known (*measured*, *proved by a test*, *checked by a person*).
   - The content KPIs: chapters authored, summaries approved, chapter drafts
     approved, figures approved, live questions (each `n/m`, mono), with links
     to Content and Items.
5. **What comes next** (h2): the approved order, an ordered list: id (mono),
   title, what it does, its state in a word (*in progress* / *planned*). Then
   **Waiting on you**: what only the instructor can do.
6. **Updates** (h2), newest first, grouped by month (h3 *October 2026*):
   each day an h4 `7 Oct 2026 · Teacher accounts, and the changelog`, its
   highlights as a list, and **All n changes** (a disclosure) listing every
   commit: its kind in a word (*New*, *Fix*, *Faster*, *Content*), its area
   (mono), the subject, its short hash (mono).

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **On this page** links (1440) | moves to that section | link text names it | Back / scroll | — |
| **All n changes** (disclosure, per day) | shows that day's commits | `aria-expanded`, the count in the label | press again | the commit list is the evidence behind the highlights |
| **Content**, **Items** links (readiness) | opens the page that fixes it | link text | Back | the condition says what is missing |
| **Try again** (readiness failed) | asks the API again | in the alert | — | — |

Nothing else. The page changes nothing in the system; it reports.

## States

| State | What renders |
|---|---|
| Readiness loading, under 400ms | nothing (space reserved); everything from the build renders at once |
| Readiness loading, over 400ms / 3s | a skeleton the shape of the list; past 3s, "the API may be waking" |
| Readiness failed | an alert in that section only, naming the failure, with **Try again**; the rest of the page stands |
| A day with no written highlights | its commits, open, with "No written highlights for this day." |

## Type and colour

Every number, id, hash, area and date in a table is mono. A state is a word,
never a colour alone: Holds/done success, Not yet warning, A person checks
info, planned/not started neutral. No `danger`: nothing here is an error.

## The gate

`design/specs/console-changelog.spec.ts`, at 1440 and 380: the six assertions,
plus: the counts equal the generated file's; the Prelim sentence follows the
measured conditions (a fixture with one failing says "not yet"); a failed
readiness keeps the rest of the page; the nav offers Changelog. Captures
`current.png` and `current-380.png`, opened.
