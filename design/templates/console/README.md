# design/templates/console/

One folder per console route. R3.0 step 2 requires a reference screenshot per
route; R3's sign-off requires this tree populated. It was empty until now, which
is why no route could be compared against anything.

## What goes in each folder

| File | What it is |
|---|---|
| `template.png` | The reference. Screenshot of the linked template from `docs/redesign/TEMPLATE-LINKS.md` for this route |
| `SPEC.md` | The structural decisions taken from that template — layout, density, hierarchy, what is deliberately NOT copied |
| `current.png` | Our implementation, captured by the spec at 1440 |
| `current-380.png` | Same at 380 |
| `motion.md` | The animations and transitions this page owns, and which `prefers-reduced-motion` path each takes |

`template.png` and `SPEC.md` come first. Rebuilding a page before its reference
exists is how a route gets "redesigned" into whatever the last screenshot
happened to look like.

## The gate

A route is done when `design/specs/console-<route>.spec.ts` passes, and that
spec asserts structure rather than pixels — a pixel diff against a third-party
template can never pass, because the colours are ours by design
(`TEMPLATE-LINKS.md`: colours and fonts are always replaced).

Every route's spec must assert, at 1440 and 380:

1. **Nothing is clipped.** No element extends past its scroll container. The
   `/items` action column was cut off mid-word in production and no test saw it.
2. **No horizontal page scroll** — `scrollWidth <= clientWidth` on `<body>`.
3. **Keyboard-only reachability** of every control the page claims to offer.
4. **Contrast at AA**, computed on all three themes, not eyeballed on one.
5. **The token system is actually in use** — no bare Tailwind colour utility, no
   literal hex. `pnpm lint` enforces this repo-wide; the spec proves the
   rendered result, which is a different claim.
6. **Motion respects `prefers-reduced-motion`**, asserted by running the page
   with the media feature emulated.

Only when a route's spec is green does the next route start. One page at a time.
