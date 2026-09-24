# CONSOLE-REVAMP.md
### One page at a time, each against its own template, nothing advances unverified

**Scope: `apps/console` only.** The student app is not in this pass. The console
is what the instructor uses to run the course, it is the surface a teacher sees
first, and it currently looks like a wireframe of itself.

This sits under R3 (`page templates and redesign`), which is the live phase at
41/49. It does not open a new phase.

---

## 0. Why this exists

`design/templates/` was **empty** — one `.gitkeep`, nothing else — while R3.0
step 2 has always required a reference screenshot per route and R3's sign-off
requires the tree populated. So every console route was "redesigned" against
nothing, and the result is visible: `/items` ships a data table whose action
column is **clipped mid-word** in production, and no test saw it because no test
knew what the page was supposed to look like.

The fix is not a restyle. It is giving each route something to be measured
against, then measuring.

---

## 1. The tree

```
design/templates/console/<route>/
    template.png      the reference, from TEMPLATE-LINKS.md
    SPEC.md           structural decisions taken from it
    current.png       our implementation at 1440
    current-380.png   our implementation at 380
    motion.md         this page's animations and transitions
design/specs/console-<route>.spec.ts
```

`template.png` and `SPEC.md` come **first**. Rebuilding before the reference
exists is how a route drifts into whatever the last screenshot happened to look
like.

`motion.md` is per page on purpose. Motion is the thing most likely to be
invented ad hoc, and `CLAUDE.md` allows exactly one orchestrated moment per
stage — the console's budget is smaller still. A page that wants a transition
writes down what it is and which `prefers-reduced-motion` path it takes, before
it gets one.

---

## 2. The gate — a route is not done until its spec is green

`design/specs/console-<route>.spec.ts` asserts **structure, not pixels.** A pixel
diff against a third-party template can never pass: `TEMPLATE-LINKS.md` says
colours and fonts are always replaced, so ours differ by design.

Every route's spec asserts, **at 1440 and 380**:

1. **Nothing is clipped.** No element extends beyond its scroll container. This
   is first because it is the defect already in production.
2. **No horizontal page scroll** — `body.scrollWidth <= clientWidth`.
3. **Keyboard-only reachability** of every control the page offers.
4. **AA contrast, computed, on all three themes** — `bare-metal`, `blueprint`,
   `phosphor`. Not eyeballed on one.
5. **The token system is actually in use** in the rendered output — no bare
   Tailwind colour utility, no literal hex. `pnpm lint` enforces the source;
   this proves the result, which is a different claim.
6. **`prefers-reduced-motion` respected**, asserted with the media feature
   emulated rather than assumed from the CSS.

**Only when a route's spec is green does the next route begin.** One page at a
time. A batch of half-finished routes is how R3 reached 41/49 with an empty
template folder.

---

## 3. Order

Worst-first, then by how often an instructor touches it.

| # | Route | Template reference | Why here |
|---|---|---|---|
| 1 | `/items` | shadcn-admin data table | **Has a known defect** — the action column is clipped in production. 183 items must be reviewed through this page before anyone can sit anything |
| 2 | `/signin` | shadcn-admin auth block | First thing anyone sees, and the forced-credential-change screen lives behind it |
| 3 | `/locks` | permissions-matrix grid | Students × 19 stages. The densest grid in the app and the one with no stock template |
| 4 | `/students`, `/students/:id` | shadcn-admin table + TanStack expanding rows | Roster and per-student detail |
| 5 | `/assessments` | shadcn Blocks — form + preview | The route that made the engine reachable; the feasibility panel is bespoke |
| 6 | `/submissions` | marking-queue list | 40% of the grade goes through it |
| 7 | `/gradebook` | KPI cards + chart | Lazy-loaded Recharts; do not let this pull weight into the initial bundle |
| 8 | `/content`, `/audit`, `/system`, `/feedback`, `/live` | per `TEMPLATE-LINKS.md` | Lower traffic |

`/attempts/:attemptId` is last and is handled with care: it is the **only** place
an answer key is shown, and hard rule 1 governs it.

---

## 4. What must not change

- **`packages/tokens` is the only source of colour, type, spacing and motion.** A
  literal hex outside that package is blocked by a hook, and
  `scripts/scan-console-palette.mjs` fails the build on a `slate-`/`blue-`
  utility or a `dark:` variant — themes are `[data-theme]`, never a Tailwind
  variant.
- **No second component library.** The console's primitives live in
  `apps/console/src/components/ui/` and are ours.
- **No route may compute a lock.** `/locks` renders what `is_stage_unlocked()`
  decides.
- **The projector view shows no names, ever** — enforced in the payload, not the
  render.
- Every write that changes student-visible state still writes to `audit_log`
  with an actor and a reason.

Measured 24 Sep 2026: the deployed console **does** ship all three themes, 172
`oklch()` declarations, and `data-theme="bare-metal"` on `<html>`. The token
mechanism is not broken. What is missing is the console's own surface design
using it — hierarchy, density, spacing, and a table that fits.

---

## 5. Running the console locally

Playwright must drive the **local** console, not the deployment — the deployed
one needs real credentials and the local one takes a dev token.

```bash
pnpm db:up                      # Docker Desktop stops silently; check docker ps
pnpm db:reset && node scripts/db-demo.mjs
pnpm dev:api                    # :8090 — NOT the raw dev script
pnpm --filter @octa/console dev --port 5184 --strictPort
pnpm dev:token                  # paste the localStorage line into the console
```

**5173 and 5174 belong to other projects on this machine** and both answer 200,
so "the port is up" proves nothing. Use 5183/5184 and pass
`OCTA_WEB_URL` / `OCTA_CONSOLE_URL`. `design/global-setup.ts` checks the page
title and refuses a run pointed at a stranger's app.

**`pnpm verify` empties the seeded database.** Reseed before any capture.
