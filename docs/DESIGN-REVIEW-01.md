# DESIGN-REVIEW-01.md
### First pass with a browser, 1 September 2026

The first time anything in this project was looked at rather than reasoned
about. Both apps were run locally against a seeded class of 24
(`db/demo-seed.sql`), signed in as staff and as a student, and captured with
Playwright at 1440px.

Four defects, three fixed here. **Every one of them was invisible to the test
suite, the type checker, the palette scanner and the contrast gate — all of
which were green the whole time.** That is the finding behind the findings: 291
tests and 1122 computed contrast checks say nothing about whether a control is
the right size or a panel is opaque.

---

## D-1 · Every control in the console was drawn at the wrong size · **FIXED**

The first screenshot ever taken of the console showed **96-pixel text inputs**.

`tailwind.config.ts` mapped Tailwind's numeric utilities onto the `--space-*`
ladder. Tailwind derives width and height from `spacing` as well as padding and
margin, so `h-9` on every `Input` and `Button` resolved to `--space-9` = 6rem.
`h-8` drew 64px. Icons at `h-5` drew 24px instead of 20.

The two ladders are not the same shape and should never have been one map:

```
space  0.25  0.5  0.75  1  1.5  2  3  4  6rem       layout gaps, steps fast
size   1  1.25  1.5  1.75  2  2.25  2.5  2.75  3    controls, steps slowly
```

Space skips the entire range control sizes live in. **60 utilities across the
console were affected.**

Fixed at the config rather than the call sites: `height` and `width` resolve to
a new `--size-*` ladder matching Tailwind's own numerics, and form controls use
role-named tokens — `h-control-md`, not `h-9` — because a control height is a
decision about touch targets, not a step on a spacing scale.

**Why it survived:** the console had no sign-in page until the same day, so
nobody had ever loaded it.

## D-2 · A bus trace ran through the word "Password" · **FIXED**

`apps/web`'s sign-in rendered `<Backdrop />` **inside** `.boot`. Children paint
above their parent's background box, so the animated backdrop drew over the
panel it was supposed to sit behind — and `.boot`'s `clip-path` cropped the
fixed backdrop to the panel, which is why the traces stopped dead at its edges.

One cause, two symptoms, and the second one explains why the first was easy to
miss: the cropping made it look deliberate.

The backdrop is now a sibling. `apps/console` had it right already, which is
the argument for capturing both apps rather than assuming shared code behaves
the same way in two different stylesheets.

## D-3 · The star map still shows the narrative act names · **NEEDS A DECISION**

`CLAUDE.md` is explicit:

> **Act == grading period.** Four of them: Prelim (ch 1-4), Midterm (5-8),
> Semi-finals (9-12), Finals (13-17). This is a change: acts used to be a
> narrative arc.

`StageMap.tsx:297` still renders the arc that replaced:

```
Act I  — Languages & Abstraction     Act III — Execution
Act II — The Machine                 Act IV  — Performance & Beyond
```

**And the database agrees with neither.** `stages.act` groups them:

| act | chapters in `db/schema.sql` | chapters per `CLAUDE.md` |
|---|---|---|
| 1 | 00–05 | 1–4 (Prelim) |
| 2 | 06–09 | 5–8 (Midterm) |
| 3 | 10–13 | 9–12 (Semi-finals) |
| 4 | 14–18 | 13–17 (Finals) |

Three sources, three answers. **This one is not mine to fix.** Renaming the
labels alone would make them actively wrong — "Prelim" over a group containing
chapter 05 is a worse error than a stale narrative name, because a student
would believe it. And re-grouping `stages.act` changes what `by_act` blueprint
constraints sample, so it moves assessment scope.

Needs a decision, then one change across all three.

## D-4 · The submissions queue is too sparse to mark from · **FIXED (R3, 2 Sep 2026)**

Each card is ~145px tall for four short lines, so 21 items to mark is a lot of
scrolling. `is_late` is computed in the database and **not shown at all**,
which is the one fact that changes what a teacher does first.

Deliberately left. The fix is a density pass over the card, and it should be
made against a reference rather than by taste — the whole point of having a
browser now.

**Fixed in R3**, against the reference `CONSOLE-DATA-AND-TEMPLATES.md` §2
already named: shadcn-admin's own Tasks page, the densest table in the template
this console is built from.

Cards became rows in a divided list. **The page went from 3,436px to 1,219px**
— all 21 items now fit on one screen instead of three. What came out is the
two-line body preview: a teacher triaging 21 submissions needs who, which lab,
whether it was late, and the way in; the prose is what they read *after*
opening one, and it is already in the detail panel. What stayed is everything
that changes what a teacher does first.

The other half of this finding — `is_late` "not shown at all" — had been fixed
separately at some point between the review and R3. It is a `Badge` beside the
student's name, with the tooltip *"Recorded, not penalised. That is your call."*

---

## What the tooling could not have caught

Worth stating plainly, because it sets the price of the next pass.

| Gate | Was green | Would it have caught D-1 or D-2? |
|---|---|---|
| 291 tests | yes | No. UI is not tested, by convention |
| TypeScript strict | yes | No. Both defects are valid TypeScript |
| `scan:palette` | yes | No. Every colour was a legal token |
| `check:contrast` (1122 pairs) | yes | No. It tests token pairs, not composites — a trace over a label is two legal colours |
| `scan:bundle` | yes | No |

A contrast checker cannot see a panel that is transparent when it should be
opaque, and no unit test knows that 96px is the wrong height for a text field.
**Somebody has to look.**

## How to reproduce this setup

```bash
pnpm db:up
docker exec -i octa-db psql -U postgres -d octa < db/demo-seed.sql

# API on 8090 (8080 is often taken by another project's Adminer)
DATABASE_URL=postgres://postgres:postgres@localhost:54329/octa \
EXAM_SALT_SECRET=$(head -c 40 /dev/zero | tr '\0' 'x') \
SUPABASE_JWT_SECRET=test-secret-at-least-32-characters-long-000000 \
PORT=8090 pnpm --filter @octa/api start

VITE_API_URL=http://localhost:8090 pnpm --filter @octa/console dev --port 5174
VITE_API_URL=http://localhost:8090 pnpm --filter @octa/web dev --port 5173
```

With no `VITE_SUPABASE_URL` set, both apps fall back to a JWT in
`localStorage` under `octa:dev-token` — mint one with the same secret and set
it from the console to browse as staff or as a student.

**Run `pnpm db:demo` after `pnpm verify`.** The API suite calls `resetAll()`,
which truncates the tables and leaves its own two fixtures behind. A console
showing a class of two students is that, not a bug.

**It is TWO steps, which is why it is now one command.** `demo-seed.sql` alone
restores the profiles and progress but leaves the database with **4 objectives
instead of 115** — the other 111 come from `scripts/sync-content.mjs`, because
`content/stages/*.md` front matter is the authoring source of truth. Running
only the first does not look like an error: it looks like a map with almost no
moons. This paragraph used to name only the first step, and that omission cost
three separate diagnosis detours in one session. `pnpm db:demo` runs both and
fails loudly if the objective count comes back short.
