# `design/before-r0/` — the map as it stood before the solar system

Eight captures, taken in R0.3 on 1 September 2026, before any solar-system code
existed. Committed on purpose: R1 replaces this surface, and a redesign with
nothing to diff against is a redesign nobody can check.

`design/screenshots/` is gitignored (large, disposable, regenerated every run),
so anything meant to outlive a session has to live somewhere else. This is that
somewhere.

## What is in here

`app-{hub,map}-{desktop-1440,mobile-380}-{default,reduced}.png` — the two map
routes × two widths × two motion states. Regenerate with `pnpm qa`
(`design/specs/before-baseline.spec.ts`).

**Fixture data only.** The signed-in student is the first row of
`db/demo-seed.sql`, minted as a local dev JWT. No real student or teacher name
appears in any of these, which is the rule for everything committed under
`design/` — see `docs/redesign/FOLDER-STRUCTURE.md`.

## What they record

| viewport | motion | `/app` lands on | `<canvas>` | 3D toggle |
|---|---|---|---|---|
| 1440 | default | `/app` | 0 | shown |
| 1440 | reduced | `/app` | 0 | hidden |
| 380 | default | `/app` | 0 | hidden |
| 380 | reduced | `/app` | 0 | hidden |

Two things worth having in a picture rather than a sentence, both open for R1
and neither a bug to fix quietly:

1. **Nothing redirects, and no canvas ever renders.** `/app` and `/app/map` are
   the same component with a `flat` prop, and 3D is opt-in through a
   `localStorage` preference that defaults to off. Four documents say `/app` is
   a 3D galaxy by default that redirects away on reduced motion, small
   viewports, or absent WebGL. The code does none of that, deliberately and
   with a comment explaining why. See `docs/PROGRESS.md` finding **F-5**.
2. **The map graphic is close to unreadable at both widths**, and at 380px it
   is a scatter of near-black specks with no labels and no visible edges. The
   act list underneath it is doing all the real work — and doing it well, with
   every lock reason spelled out in a full sentence. Recorded as **F-6**.

Neither was visible to the type checker, the test suite, the palette scanner or
the contrast gate, all of which were green. Same finding-behind-the-findings as
`docs/DESIGN-REVIEW-01.md`: somebody has to look.
