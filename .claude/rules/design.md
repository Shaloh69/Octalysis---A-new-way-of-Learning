---
paths: ["apps/**/*.tsx", "apps/**/*.css", "packages/tokens/**"]
---
# Design rules

Every color, type size, space, and duration comes from `packages/tokens`. A literal hex outside
that package is blocked by a hook. `slate-` and `blue-` utility classes fail the build.

Type roles are jobs, not decoration:

- **Space Grotesk** — display, used with restraint
- **Inter** — body
- **JetBrains Mono** — ALL numbers, register values, hex, machine code, assembly listings, spec
  sheets, and every value in a parameterized question. In this app, monospace means *"this is what
  the machine sees."* That consistency is the design.

The signature element is the **Register Bar**: a persistent top strip showing PC, IR, MAR, MBR,
ACC as live mono hex. Idle pulse in stages 00-11, live in 12-15, question index as PC during an
assessment. Spend boldness here; keep everything else quiet.

Motion: one orchestrated moment per stage (the Bring-Up, ~2s, once). Correct answers get a 120ms
accent flash. No confetti per question — it is noise by week three. `prefers-reduced-motion`
disables all of it.

Accessibility floor: WCAG 2.2 AA on all three themes, verified by computation not by eye. Every
drag interaction has a tap-to-select fallback. `aria-live` on answer feedback. Visible focus
everywhere. 380px with no horizontal scroll.

## Feedback, loading and transitions — required on every revamped route

These three are not polish. A page that does work silently, snaps between
states, or blanks while it fetches is unfinished, and all three are currently
missing.

**Toasts.** There is **no toast system** — measured 25 Sep 2026: no toast
library is installed in either app, `useFormation.ts` only describes toasts in
comments, and `AppShell.tsx` reserves a `z-toast` layer that nothing renders
into. The design system booked the z-index and the component was never built.

Every action that changes server state confirms itself. Rules:

- One toast per action, never one per request. A save that fans out to three
  endpoints is one confirmation.
- Say **what happened to what**, not "Success" — *"Item 01-arch-definition
  approved"* beats a green tick.
- Failures state the next move and never vanish on a timer. Successes dismiss
  after ~4s; errors stay until dismissed.
- `role="status"` for success, `role="alert"` for failure, so a screen reader
  hears it without hunting.
- **Never red for a wrong answer.** That is the assessment rule and it outranks
  the toast palette: an incorrect answer gets a neutral response, never red,
  never a buzzer, never a shake.
- Anchored bottom-right at 1440, full-width bottom at 380, above the fold in
  both, and never covering the control that triggered it.

**Loading.** Nothing may blank. Measured: exactly one route in `apps/web` has
any loading state at all.

- Skeletons that match the shape of the content arriving — same row height, same
  column count. A spinner where a table will be tells the reader nothing about
  what is coming.
- Anything over ~400ms gets a skeleton. Under that, nothing — a flash of
  skeleton is worse than a still frame.
- Never move the content after it lands. Reserve the space.
- A failed fetch renders an error state with a retry, never an empty page.
- The Render free tier sleeps and costs ~50s to wake, so a first request can be
  genuinely slow: past ~3s, say so in words rather than spinning forever.

**Transitions.** One orchestrated moment per stage still stands. Beyond it:

- State changes are eased, not snapped — 120-200ms for local changes, ~700ms for
  the map's camera easing.
- Route changes carry a transition both ways. The reverse travel transition
  leaving a stage is missing and its absence is why leaving feels broken.
- Motion is never the only signal. Anything a transition communicates must also
  be readable from a still frame.
- **`prefers-reduced-motion` removes all of it** — cut, do not slow down. And
  `QA_MODE=1` freezes every ambient loop so screenshots are stable.

Each revamped route records its own in `motion.md`, including which reduced-motion
path each transition takes.
