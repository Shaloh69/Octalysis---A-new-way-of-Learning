# content/stages

Authoring source of truth for lesson content. One file per stage: `00.md` … `18.md`.
Orientation plus the eighteen chapters of the CPE 412 syllabus.

`scripts/sync-content.mjs` parses these into the `content_blocks` and `objectives` tables. The
database is the **runtime** source of truth (so a typo fix needs no redeploy); these files are the
**authoring** source of truth (so content is reviewable in git).

## Chapters 1-7 are authored. 8-18 are planned.

**Chapters 1 through 7 have full lesson text**, written from the textbook, with
every quoted definition verified against it by `sync-content.mjs --verify`.

**Chapters 8 through 18 carry their objectives and topic outline and say so.**
Their callout tells the student plainly that the teaching text is coming in a
later update. That is a deliberate state, not an unfinished one -- and it is
better than prose nobody has checked, which is how a wrong definition reaches a
student with the platform's authority behind it.

The console's Content page reports the three states -- `authored`, `planned`,
`empty` -- per chapter, so "is the course ready" has a per-chapter answer rather
than a percentage that hides which chapter is missing.

## These files are GENERATED, and only partly

`scripts/gen-stages.mjs` writes every file here from `docs/source/CPE 412.docx` — the authoritative
syllabus. What it generates is only what the syllabus actually contains:

- **front matter** — stage id, title, archetype, levels, and the chapter's unit outcomes as
  `objectives`, transcribed verbatim. 110 of them across the eighteen chapters.
- **the topic outline** — the syllabus's own sub-topic list for that chapter.

**It does not generate prose, and must not.** Hard rule 5: *never invent course content.* The
syllabus is a topic list, not teaching material — it names what a chapter covers and leaves the
text to the instructor. Every stage therefore carries a visible `kind="scaffold"` callout saying
so, rather than filling the gap with plausible-sounding paragraphs.

Regenerating (`node scripts/gen-stages.mjs`) **overwrites authored prose**. Once a stage has real
content, either author it in the database instead, or move the file out of the generator's path.
The generator refuses to run unless it sees exactly eighteen chapters — see `VERIFICATION.md` V-47
for why that guard exists.

## Where the prose comes from

Per-chapter references, with author credits, are in `docs/CPE412-CURRICULUM.md` §4. Primary is
Stallings, *Computer Organization and Architecture*, 9th ed., chapter-for-chapter — **except
chapter 18**, which Stallings does not cover at all; §4.1 lists its three open sources.

The two decks in `docs/source/` (`day1-deck.md`, `chapter1-deck.md`) belong to the **superseded**
course and are retained as evidence, not as source. See `.claude/rules/content.md`.
