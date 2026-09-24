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

---

## 6. Starting prompt — paste after a `/clear`

> Read `docs/redesign/CONSOLE-REVAMP.md` in full, then `docs/NEXT-SESSION.md`.
> Do not re-derive what those carry; check a number only when you are about to
> depend on it.
>
> Run `pnpm phase` and show it, including the percentage. Name the live phase
> out loud. Then state plainly whether Prelim-worth of data is okay to run on
> students to use and grade against — checking the five conditions in root
> `CLAUDE.md`, not remembering them. If any part is untrue, say which part.
>
> **This session is the teacher console only.** `apps/console`. The student app
> is not in scope.
>
> Work `/items` first and only `/items`. In order:
>
> 1. Bring up the local stack. `pnpm db:up` (check `docker ps` — Docker Desktop
>    stops silently), `pnpm db:reset && node scripts/db-demo.mjs`, `pnpm dev:api`
>    on 8090, console on **5184**, `pnpm dev:token` for a session. 5173/5174
>    belong to other projects and both answer 200.
> 2. Capture the reference for `/items` from `docs/redesign/TEMPLATE-LINKS.md`
>    into `design/templates/console/items/template.png`, and write `SPEC.md`
>    beside it — the structural decisions you are taking from it, and what you
>    are deliberately not copying. Colours and fonts are always ours.
> 3. Write `design/specs/console-items.spec.ts` with the six assertions from §2,
>    at 1440 and 380. **Watch it fail first** — the action column is clipped in
>    production, so assertion 1 must go red before you fix anything.
> 4. Fix `/items` until the spec is green. Capture `current.png` and
>    `current-380.png`. Write `motion.md` for any transition you add.
> 5. Show me the screenshots and the spec output. **Stop there.** Do not start
>    the next route.
>
> Rules that bind: root `CLAUDE.md`'s eight hard rules, `.claude/rules/*`,
> `REDESIGN-CLAUDE.md` §2b/§2c/§2d, and `apps/console/CLAUDE.md` — no
> `slate-`/`blue-` utilities, no literal hex, no `dark:` variant, no second
> component library. Screenshot before believing a page works. Tick the phase
> box in the same commit as the work.

## 7. Continuation prompt — paste for each route after the first

> Continue `docs/redesign/CONSOLE-REVAMP.md`. Console only.
>
> Start with `pnpm phase`, the percentage, and the Prelim-readiness sentence.
>
> Confirm the previous route's spec is still green before touching anything —
> `pnpm qa` or the single spec. If it is red, that is this session's work and
> the next route waits.
>
> Then take the next route from §3's table, in order, and do the same five
> steps: reference and `SPEC.md` first, spec written and **watched failing**,
> then the rebuild, then `current.png` / `current-380.png` / `motion.md`.
>
> One route. Show me the screenshots and the spec output, and say which of the
> six assertions you actually ran versus assumed. Stop before the next one.
>
> If a route turns out to need a decision that is the instructor's — a lock
> policy, what a control should do, anything that changes what a student sees —
> stop and ask rather than choosing.


---

## 8. After the console — the student app

`apps/web` needs the same pass and gets it **second**. It is barely finished:
intended features missing, layouts wrong, theming wrong. Same tree
(`design/templates/web/<route>/`), same five files per route, same six-assertion
gate, same one-at-a-time rule.

It is second because the console is what the instructor uses to run the course,
it is the smaller surface, and it is the one blocking the Prelim — 183 items
cannot be approved through a page whose action column is clipped.

Order, worst-first:

| # | Route | Why here |
|---|---|---|
| 1 | `/app/stage/:id/check` | The attempt runner. It grades. A layout defect here costs marks — an ordering item shipped unanswerable and was found by screenshot, not by any test |
| 2 | `/app/stage/:id` | The reader. 9,857 characters of content per stage and the longest page in the app |
| 3 | `/app/map` | The flat map. Already keyboard-correct — 0 canvases, real DOM buttons — so this is layout and density only, and that property must not regress |
| 4 | `/app` | The 3D map. Highest risk: a `<canvas>` has no accessibility semantics, and `VISUAL-SYSTEM-3D.md` §5's degradation ladder owns the fallback. It degrades **in place**, never by redirect |
| 5 | `/login`, `/claim` | First contact |
| 6 | `/app/progress`, `/app/work`, `/app/settings` | Lower traffic |

**The first thing a student meets on `/app` is a card reading "PLACEHOLDER TEXT
— NOT REAL COURSE CONTENT YET".** Fix that in pass 1, or delete the card.

Two properties the student pass must not break, both already verified working:

- `/app/map` is real DOM, not a canvas — every stage a focusable `<button>`
  carrying its state and lock reason, behind a skip link.
- No horizontal scroll at 380 on `/app`, `/app/map` or a stage page.

---

## 9. What the student app actually looks like — 25 Sep 2026

Three screenshots from the instructor, and these are the standard the rebuild
has to clear. Recorded because a screenshot in a chat transcript does not
survive a `/clear`.

**`/app` — the 3D map**

- **Links render browser-default purple and underlined.** *"All 19 stages, with
  progress and lock reasons"* and *"Show the flat map"* are unstyled anchors.
  Confirmed in source: `apps/web/src/styles.css` styles `a` only inside
  `.app-nav` and `.encounter`, and there is **no base `a { }` rule anywhere**.
  Every `<Link>` outside those two contexts is unstyled. This is the clearest
  possible argument for §REDO rather than improve.
- **"0 of 19 subsystems online"** with an empty starfield and a lone `?` button.
  Nothing communicates what the student should do next.
- Header is a flat grey slab; *"Report a problem"* is a full-width white bar
  dominating the footer.

**`/app/stage/01` and `/app/stage/00` — the reader**

- **The two pages disagree about the theme.** Stage 01 renders dark panels;
  stage 00 renders near-white panels — same backdrop, same session. One of them
  is wrong and possibly both.
- The biome backdrop is **heavily pixelated** at 1440 and fights the text it
  sits behind rather than receding.
- A **clipped artifact strip on the right edge** on both stage pages.
- No visible control to leave the stage or mark it finished. The reverse travel
  transition was already a known gap; this is what it looks like to a student.

**Transitions do not show.** The one orchestrated moment per stage that
`CLAUDE.md` allows is not visible.

None of this is styling drift. It is a surface that was never built against a
reference, which is what §0 and §REDO exist to fix.
