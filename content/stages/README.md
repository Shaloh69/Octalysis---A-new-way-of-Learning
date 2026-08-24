# content/stages

Authoring source of truth for lesson content. One file per stage: `00.md` … `17.md`.

`scripts/sync-content.ts` parses these into the `content_blocks` table. The database is the
**runtime** source of truth (so a typo fix needs no redeploy); these files are the **authoring**
source of truth (so content is reviewable in git).

Content comes from `docs/source/day1-deck.md` and `docs/source/chapter1-deck.md`, verbatim for
definitions and figures. Stages 09, 10, 14, 15, 16 and parts of 17 have no source material —
the instructor authors those. See `.claude/rules/content.md`.
