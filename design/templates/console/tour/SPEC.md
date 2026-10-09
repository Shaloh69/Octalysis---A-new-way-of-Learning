# The console's first-run tour and its ? — SPEC

Instructor, 9 Oct 2026. Gate: `design/specs/console-tour.spec.ts` (the six
assertions at 1440 and 380 on all three themes, and the claims below).
Component: `apps/console/src/components/Tour.tsx`; the ? and the auto-start:
`components/AppShell.tsx`; styles: `index.css` ("The first-run tour"). The student
app's is `design/templates/web/tutorial/SPEC.md`; this one is its sibling.

## Where it is

The console shell only (`AppShell`). Not on `/live/present` (the projector view
is a bare route: no shell, no ?, no tour), not on the sign-in or gate screens.

## Controls, against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **?** (a round button: the sidebar's foot beside the account, and the 380 bar's right end; named "Take the tour of the console") | Starts the tour from step 1 (at 380 it opens the nav sheet, where the targets are) | A question mark; named in words for a screen reader | Escape, or Skip | Where everything is |
| **Next / Done** (Enter, Right arrow) | The spotlight moves to the next place and the popover says what it is | "n of N" in mono, the title in the display face | Previous | One thing at a time |
| **Previous** (Left arrow) | Back one step | same | Next | |
| **Skip the tour** (and Escape) | Ends it; focus returns to where it was, or to the ? | The words, as a link-styled button | The ? starts it again | |

## The steps (every line describes the console; none is course content)

Welcome (no target: the page dims, the words sit in the middle) · In class ·
Students · Course · Records · **Teachers (the admin only: the step exists only
when the Teachers page does)** · Your account · The ? is always here.
Seven steps for a teacher, eight for the admin. Each target is an element with
`data-tour="…"`. A target not drawn at the current width is shown as a centred
step rather than pointing at nothing.

## When it runs by itself

**Once per account, in the database** (`profiles.tour_seen_at`,
`db/addendum-tour.sql`; instructor ruling 9 Oct 2026), 0.9 s after the profile
loads, on whatever console page the teacher opens first. It is recorded when the
tour **starts**, so a reload mid-tour does not loop it; a profile that fails to
load starts nothing. A second device does not see it again.

**An automated browser is not a teacher**: with `navigator.webdriver` set the shell
does not start it unless `octa:tour:force` is `"1"`, because the shield would block
every other spec. The tour's own spec forces it, and one test proves nothing starts
without it.

## Accessibility

A `role="dialog" aria-modal="true"` popover named by its title and described by its
text. While it runs the rest of the page is `inert`; Tab cannot leave the popover,
Left and Right step, Escape closes, the primary button takes focus on every step,
and focus returns to where it was (or to the ?). The tour sits above dialogs and
below toasts.

## Colour

Tokens only: the dimness is `--surface-0` mixed with transparent, the spotlight's
ring is `--accent`, the popover is `--surface-1` on `--line-strong`. AA is computed
on every step on all three themes (gate 4).
