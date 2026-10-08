# The first-run tour and its ? button — SPEC

Instructor, 8 Oct 2026. Gate: `design/specs/web-tour.spec.ts` (the six
assertions at 1440 and 380, and 12 claims). Component:
`apps/web/src/shell/Tour.tsx`; the ? and the auto-start: `shell/StarShell.tsx`;
styles: `styles/tour.css`.

## Realm

The star system only: `StarShell`. **Never inside a planet or a moon**
(`BiomeShell`: a stage check, an exam and a moon's journey have no tour, no ?
and no shortcut off them, hard rule 9). The spec proves `/app/stage/01` has
neither.

## Controls against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **?** (top strip, a round button, named "Take the tour of the app") | Starts the tour from step 1 | A question mark is the universal "help"; named in words for a screen reader | Escape, or Skip | Where everything is |
| **Next / Done** (Enter, or the Right arrow) | The spotlight moves to the next control and the popover says what it is | "n of 9" in mono, the title in the HUD face | Previous | One thing at a time |
| **Previous** (Left arrow) | Back one step | same | Next | — |
| **Skip the tour** (and Escape) | Ends it; focus returns to where it was, or to the ? | The words, as a link-styled button | The ? starts it again | — |

## The nine steps (every line describes the app; none is course content)

Welcome (no target: the page dims, the words sit in the middle) · Map · Stages ·
Progress · Your work · Chat · Settings · Your profile · The ? is always here.
Each target is an element with `data-tour="…"`. A target that is not drawn at the
current width is shown as a centred step rather than pointing at nothing.

## When it runs by itself

**Once per student**, on their first visit to the map (`/app`), 0.9 s after the
profile loads. "Once" is `localStorage["octa:tour:v1:<user id>"]`, written when
the tour **starts** (so a reload mid-tour does not loop it). It is a per-viewer
convenience, never a grade; a second device sees it again, which does no harm. If
storage is unavailable it is not forced on anyone.

**An automated browser is not a student**: with `navigator.webdriver` set, the
shell does not start it unless `octa:tour:force` is `"1"`, because the tour's
shield blocks the page behind it and would break every other spec. The tour's own
spec forces it, and one test proves nothing starts without it.

## Accessibility

A `role="dialog" aria-modal="true"` popover named by its title and described by
its text. While it runs **the rest of the page is `inert`** (not focusable, not
clickable, out of the accessibility tree), so Tab and a screen reader stay with
the popover; the spec proves Tab cannot leave it and a click through the dimness
goes nowhere. The primary button takes focus on every step. Left and Right step,
Escape closes, and focus returns to where it was.

## Colour

Everything is a token. The dimness is `--surface-0` mixed with transparent; the
spotlight's ring is the accent (the student's own place); text is `--ink` on the
panel's `--surface-1`. AA is computed on every step (gate 4).

## Captures (opened, 8 Oct 2026, build at 5185, student 232129006)

`current.png` (1440, "The map" step), `current-380.png` (380, welcome),
`current-380-profile-step.png` (380, the target at the strip's far right).

**Found by looking and by testing, and fixed:** the buttons wrapped onto a
second row in the popover (Skip moved up beside the count); at 380 the readout's
box covered the ? so it could not be clicked (`z-index`, found because the
capture script's click timed out); the strip then cut the PC register (the shell's
own clipping check caught it: tighter gaps at 640 and under); focus did not
return to the ? when the tour had started by itself (it falls back to the ?).
