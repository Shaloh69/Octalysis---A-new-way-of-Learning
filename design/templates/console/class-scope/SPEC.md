# Class scope — the states T2 adds to the console (9 Oct 2026)

**Not a route.** T2 (`docs/TEACHERS-AND-SUBJECTS-PLAN.md` §5, ruled 9 Oct 2026) changes who sees what on
eleven existing pages. The pages keep their own folders and specs; this folder holds the **two new states** every
one of them can now be in, so each is captured, looked at and gated once:

| State | When | What the page shows |
|---|---|---|
| **No class** | a teacher who holds no class opens a page about students | `Empty`: "You don't hold a class yet" + the page's own way to get one (Students: *Import roster*; others: a link to Students). `data-no-class` |
| **Read-only** | a class that has ended (to its teacher), or another teacher's (to the admin) | a padlock beside the section code in a long list (`ReadOnly compact`), the word **Read-only** where there is room (a record's header, a lock row); the write controls are `aria-disabled` and *look* unavailable; the menu says why. `data-read-only` |

**Reference.** No third-party template: both states reuse the console's own `Empty`, `Badge` and `Lock` icon
(lucide), which the shell already carries. The pattern is shadcn-admin's own "Empty" card and a disabled
action menu; nothing was copied. The captures here (`*.png`, 1440 and `-380`) are of the built console on the
demo database, with `db/demo-seed.sql`'s two T2 accounts (a teacher with no class, an admin who holds none).

## Controls, against the four tests (DESIGN-MANDATE.md §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| *Import roster* in the no-class state | makes the teacher's own section **and its class** | the empty state says that is what it does | the import is a dry run first | yes: it is how a class begins |
| A disabled action (`aria-disabled`) | none: pressing does nothing | greyed, with the reason in the menu or `title` | n/a | says *why* the class is read-only, in words |
| The padlock (`compact`) | none | `sr-only` text + `title` carry the sentence | n/a | one mark per row instead of one word per row |

Disabled with `aria-disabled`, never `disabled`: a disabled control drops keyboard focus and never gives it back
(the Graded switch's lesson, 9 Oct 2026). The routes refuse the same actions regardless: the page decides what
to RENDER, the API decides what is ALLOWED.

## What was seen, and fixed, by looking

- The first read-only mark was a **"Read-only" badge on every row**: it wrapped under the section code and made
  24 rows taller, so the admin reading a class of 24 saw a wall of badges. It is a padlock now; the word stays
  for screen readers and on hover.
- `aria-disabled` buttons **looked enabled** (only `disabled:` was styled): the teacher's *Set window* on the
  course's papers read as pressable. `button.tsx` now dims `aria-disabled` the same way.

## Motion

None added. Both states appear with the page; the padlock and the panel do not animate, so reduced motion has
nothing to cut (the gate's assertion 6 records and proves it).

## Gate

`design/specs/console-class-scope.spec.ts`: the six assertions on seven states at 1440 and 380, and the page
claims above. The data half is `services/api/test/class-scope-*.spec.ts`.
