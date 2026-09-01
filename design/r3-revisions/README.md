# `design/r3-revisions/` — R3, after the second round of changes

Captured 2 September 2026. The counterparts are `design/before-r0/` (the galaxy
before any of this) and `design/r3-inventory/` (every built route, one round
earlier). Fixture data only — the signed-in student is a row from
`db/demo-seed.sql`.

Regenerate the per-route set with `pnpm qa design/specs/r3-inventory.spec.ts`.

| File | What it shows |
|---|---|
| `r3rev-map-firstrun` | First visit: the 30-second first-run panel. `role="note"`, dismissible from the first frame — **not** a tour and not a modal carousel, per `DESIGN-MANDATE.md` §2. |
| `r3rev-map-seen` | The same map once the tour is dismissed. It does not come back. |
| `r3rev-stages` | `/app/stages` — the list that used to sit under the map, now progress bars and planet marks with every lock reason still printed. |
| `r3rev-phone-portrait` | A phone held upright: no canvas, and the invitation to turn it. |
| `r3rev-phone-landscape` | The same phone turned: **the 3D map renders.** Ladder rung 2 is portrait-only now. |
| `r3rev-sidebar-desktop` | Planet selected: camera flown in, six moons orbiting it, sidebar docked right with one moon selected. |
| `r3rev-sidebar-landscape` | The same interaction at 844×380 — the panel becomes a bottom sheet so the map keeps the upper half. |

## What these captures caught

**The moons were inside the planet.** `MOON_ORBIT` was 0.55 while a mastered
planet's radius is 0.62, so they rendered as bumps on its edge rather than as
bodies orbiting it. It had been that way since the layout was written and only
became visible when the focused tier started drawing them individually.

**The focus camera was too far out.** At the previous standoff a 0.19-unit moon
was a couple of pixels — present, and useless as a selection target.

Neither is the kind of thing a test finds. Both are the kind a screenshot finds
immediately, which is the whole argument in `REDESIGN-CLAUDE.md` §2.
