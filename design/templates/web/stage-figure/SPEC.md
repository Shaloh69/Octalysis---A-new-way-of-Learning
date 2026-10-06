# SPEC: a figure block in the stage reader (`/app/stage/:id`)

Instructor rulings 6 Oct 2026; `docs/FIGURES-AND-AUDIO.md`.

- A figure is `<figure class="rd-fig">`: the drawing in a hairline frame on `--surface-2`, then
  a `<figcaption>` (the caption, then "After Stallings, Figure N.N, redrawn for this course"
  when the block names the book figure). Book numbering is the 10th edition's, the book the
  student holds.
- The drawing is inline SVG in the realm's tokens (`figure.css`): right in every biome.
- One image to assistive tech: `role="img"`, named by the figure's `<title>`, described by
  its `<desc>`.
- Never sideways at 380: the drawing scales to the column (viewBox at most 440, text at least
  14 units), and stops at its own width on a wide screen.
- An unapproved figure is absent, caption included. There is no "pending" state for students.
- The six gate assertions of `design/specs/web-stage.spec.ts` stay green at 1440 and 380 with
  a figure on the page.
