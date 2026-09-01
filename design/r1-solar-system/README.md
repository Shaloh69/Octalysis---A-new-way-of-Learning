# `design/r1-solar-system/` — the map after R1

Six captures, taken 1 September 2026 at the end of R1. The counterpart to
`design/before-r0/`, which holds the same routes before any solar-system code
existed. Diff them.

Regenerate with `pnpm qa design/specs/solar-system.spec.ts`. Fixture data only
— the two signed-in students are rows from `db/demo-seed.sql`, so no real name
reaches this folder.

## What each one is for

| File | Shows |
|---|---|
| `solar-fresh-desktop-1440` | A student with nothing unlocked past orientation. Almost every planet dim. |
| `solar-progressing-desktop-1440` | Seven stages of real history. **Capture both** — a map where everything is locked and a map where the path has been walked are different pictures, and only one of them was ever going to get looked at otherwise. |
| `solar-reduced-motion-desktop-1440` | The ladder's first rung. Flat, same route, no canvas. |
| `solar-reduced-motion-mobile-380` | Both constraints at once. |
| `solar-380-mobile-380` | Small viewport falls back to flat, in place. |
| `solar-no-webgl-desktop-1440` | `getContext('webgl')` returning null. No error state, no redirect — the DOM layer was always the one carrying the meaning. |

## What R1 actually changed here

**3D is now the default on a capable device.** It previously sat behind a
`localStorage` preference that defaulted to off, so a student saw a canvas only
if they found the toggle — which no document sanctioned and which would have
made this whole redesign invisible to most of the class (F-5).

**Nothing redirects.** Every capture above is at `/app`. The ladder degrades in
place, `VISUAL-SYSTEM-3D.md` §5 owns that rule, and `solar-system.spec.ts`
asserts the URL is unchanged in every fallback case — a redirect creeping back
in is the specific regression those tests exist to catch.

**Only one map draws at a time.** The first build of this put the solar system
behind the flat SVG as a full-viewport backdrop, the way the galaxy sat behind
it. Two maps of the same 19 stages stacked, with the act list scrolling over
both: text on orbit lines. That is `DESIGN-REVIEW-01`'s D-2 in a new place — a
bus trace through the word "Password" — and the same cause, something painting
where it was assumed to sit behind. The system now has its own box and the text
sits below it.

## Still open, visible in these captures

- **The act names are the stale narrative ones** (`Act I — Languages &
  Abstraction`). `DESIGN-REVIEW-01` D-3, unresolved, and this redesign makes it
  worse by promoting Act to a HUD chip and flight-path colour banding.
- **The Depth Gauge down the left edge runs L6→L0 top to bottom**, while the
  map now encodes the same axis as L0-innermost. Two encodings of one fact,
  both honest on their own. Worth a look in R3.
- **DOM controls are not yet positioned over their planets.** The act list
  carries every stage as a real labelled button, which is the accessibility
  contract, but `SKILL-TREE-3D.md` §4's overlay — buttons projected onto their
  3D counterparts — is not built. R1 shipped the layer, not the projection.
