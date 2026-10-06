import { useId, useMemo } from "react";
import { prepareFigure } from "../lib/figure";

/**
 * One course figure, drawn inline (instructor rulings, 6 Oct 2026;
 * docs/FIGURES-AND-AUDIO.md). The drawing carries no colour: its fig-*
 * classes take the realm's tokens from `@octa/tokens/figure.css`, so the same
 * figure is right in every biome and on the neutral paper of a check. One
 * image to assistive tech, named by the figure's title and described by its
 * <desc>. Only an approved drawing ever reaches this component.
 */
export function FigureDrawing({ svg, title }: { svg: string; title: string }): JSX.Element | null {
  const { html, desc } = useMemo(() => prepareFigure(svg), [svg]);
  const descId = useId();
  if (!html) return null;
  return (
    <>
      <div
        className="fig-svg"
        role="img"
        aria-label={title}
        aria-describedby={desc ? descId : undefined}
        // why: a course figure that passed scripts/lib/figure-svg.mjs (drawing
        // elements only, no handlers, no outside links) and an instructor's
        // approval; prepareFigure() refuses anything that could run.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {desc ? <span id={descId} className="sr-only">{desc}</span> : null}
    </>
  );
}
