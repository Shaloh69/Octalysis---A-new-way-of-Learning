# `/attempts/:attemptId` — motion

**One entrance, and nothing after it.** A paper is a document read top to
bottom, often on a projector during a dispute: when it lands it rises into
place once, and then nothing on the page moves except what a pointer touches.
Every state reads from a still frame, and `prefers-reduced-motion` cuts
everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| The paper arriving (after the read, or after the skeleton) | `octa-rise-in` on `.pp[data-paper]` (shared keyframe) | `--dur-base` | the paper is there; the skeleton is gone | cut |
| A question link under the pointer | `background-color` / `border-color` transition on `.pp-index a` | `--dur-fast` | the link's number and shape; focus shows the global focus ring | cut |
| The audit-log link under the pointer | `text-decoration-color` transition on `.pp-link` | `--dur-fast` | it is underlined at rest | cut |
| The skeleton, after 400ms of a first read | `octa-shimmer` (shared) | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence **at its top** | cut to one frame |

**Jumping to a question does not animate.** A question link is a fragment
link: the browser brings `#q-n` into view (`scroll-margin-top` keeps its
heading clear of the edge) and `:target` gives that question the accent
border. The border is the signal, in a still frame; there is no smooth scroll
to cut.

**Withholding the key does not animate either.** An in-progress paper renders
without its key in one step; nothing fades out, because nothing was there.

Gate assertion 6 in `design/specs/console-attempts-detail.spec.ts` checks both
halves: with motion allowed, the paper MUST ease in (the positive control,
read through `motionStarted(page, "main")`), and with `reducedMotion:
"reduce"` emulated nothing on the route may animate, through a reload and a
hover on a question link.
