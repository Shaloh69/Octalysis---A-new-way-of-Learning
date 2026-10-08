# `/app/profile` — SPEC

PROFILES, `docs/PROFILES-PLAN.md`. Gate: `design/specs/web-profile.spec.ts`
(the six assertions at 1440 and 380, resting and with a picture on the stage and
after a teacher's removal, and 13 claims). The server's half:
`services/api/test/profile.spec.ts` and `profiles-rls.spec.ts` (71 tests).

## Realm

The star system: `html[data-realm="star"]`, no biome. Linked from the top
strip's own avatar (a round chip, "Your profile") and from `/app/settings`.
**Never drawn on a stage check or an exam paper**: `[data-paper]` is identical for
everyone.

## Panels and controls against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Choose a picture** (a label wrapping the real file input) | Opens the picker; nothing is sent | The words; Enter or Space on the focused input | Cancel | — |
| **Position** (drag, or the arrow keys on the stage) and **Zoom** (a slider) | What the circle shows changes | The circle is exactly what is encoded (one crop rectangle, one canvas) | Move it back | — |
| **Use this picture** | Encodes a 512 x 512 WebP under 300 KB in the browser, uploads it to a path the API chose, records it; classmates and teachers see it at once | A toast: "Your picture is set" | Choose another, or Remove | Says who sees it |
| **Choose another / Cancel** | Back to the picker / drops it; nothing was sent | Words | — | — |
| **Remove picture** | The generated planet comes back; the file is deleted | A toast: "Your picture is removed" | Choose a new one | — |

Read-only: name, student number (mono), section, classes. The roster owns them.

## Honest about who sees it

The note under the picture says it, in plain words, before the student chooses:
"A picture is seen by your classmates and your teachers, and your teacher can
remove it." It is not a hidden consequence.

## States

- **loading:** nothing for 400 ms, then a skeleton in the shape of the panels;
  past 3 s the words ("The server is waking up").
- **error:** what happened and "Try again"; nothing changed.
- **no picture:** the planet generated from the student ID (a hue and one of four
  patterns, `packages/tokens/avatar.css`), never an empty box.
- **a teacher removed it:** one note, with the day, until they choose a new one
  ("Your picture was removed by your teacher on Oct 8").
- **no file storage** (the local stack): no upload control, and the page says so.
- **saving:** the button reads "Saving…" and is disabled; **a failed save keeps
  the picture on the stage with its crop** and raises an error toast that stays.
- **a file that is not a picture, or over 20 MB:** a toast, and nothing opens.

## What the browser proves, and what it cannot

The spec drives a real Chromium: a non-square photo is cropped, re-encoded and
sent, and the sent bytes are a RIFF/WEBP of 512 x 512 and at most 300 KB with no
EXIF or XMP chunk (a phone photo's GPS never leaves the page). The local API has no
Storage, so the upload half runs against `_profile-fixture.ts`; the real bucket
was checked on the deployment. The server never trusts the browser: it checks the
stored file's size, type and **first bytes** before it records the path.

## Colour

The accent marks only the ring (the student's own place). The generated planet
is its own hue by design and is decorative (`aria-hidden`; the name is beside it).

## Captures (opened, 8 Oct 2026, build at 5185, student 232129006)

`current.png` / `current-380.png` (a picture set, with the toast),
`current-removed.png` (after a teacher's removal).
**Found by looking and by the gate:** the right column stretched apart because the
picture panel spanned two rows (one stacked column now); "SIGN OUT" wrapped onto two
lines at 380 once the avatar chip joined the strip; the term "2026-2027 First
Semester" was set in mono (it is prose); the hidden file input was a Tab stop that
never took focus (it is now the visible label's own control, as chat's Attach is);
and the range slider painted a browser-default grey (token colours).
