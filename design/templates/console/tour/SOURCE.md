# The console's first-run tour and its ? — template source

Instructor, 9 Oct 2026 (asked mid-session; "Both": the ? tour and the
Messenger-shaped chat for the console too).

`template.png` (1440) and `template-380.png` (380) are **the same capture the
student app's tour was built from**: **Driver.js**'s home page,
https://driverjs.com/, captured 8 Oct 2026 with Playwright, HTTP 200, title
"Driver.js - Product Tours & Highlights in Vanilla JS", **with its tour
running**; copied here from `design/templates/web/tutorial/` (`SOURCE.md` there
has the capture's full record). Opened again before this build: the page
dimmed, the target cut out of the dimness, a popover with a small arrow to it,
a title, one short paragraph, Previous and the primary button.

Taken: the structure (dim, spotlight, popover with an arrow, "n of N", Previous /
Next, a way out). Not taken: Driver.js's yellow, its type, and the library (the
repo adds no UI library; the component is `apps/console/src/components/Tour.tsx`,
built by hand like the web's). The dress is the console's tokens: `--surface-1`,
the accent ring on the spotlight, the display face on the title.

One difference from the web's, and why: the console's targets run down a
**left-hand column**, so the popover sits to the RIGHT of a target there
(arrow on its left edge), and below or above for the rest.
