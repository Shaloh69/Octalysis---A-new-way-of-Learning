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
