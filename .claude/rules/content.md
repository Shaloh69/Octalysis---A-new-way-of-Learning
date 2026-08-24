---
paths: ["content/**", "scripts/sync-content.ts", "docs/source/**"]
---
# Content rules

**NEVER invent course content.** This is the highest-risk failure mode of building this app with
an LLM: plausible-sounding lecture text that is subtly wrong, which the instructor finds in week 6.

Stage prose, definitions, and figures come from `docs/source/day1-deck.md` and
`docs/source/chapter1-deck.md`, verbatim. You may add heading structure, callouts, and
transitions. You may not paraphrase a definition.

Figures 1.1-1.4 from the Day 1 deck are `kind='code'` blocks with the original listings intact,
character for character.

Where a stage has no source material (09, 10, 14, 15, 16, and parts of 17), **stop and say so.**
The instructor authors it; you do not.

The content fidelity check in `docs/AUDITS.md` §3.6 diffs quoted spans against source. It runs in
CI. If it fails, you invented something.
