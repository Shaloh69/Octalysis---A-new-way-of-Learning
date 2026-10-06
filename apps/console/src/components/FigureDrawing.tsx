import { useId, useMemo } from "react";
import { prepareFigure } from "@/lib/figure";

/**
 * One course figure, drawn inline in the console's tokens
 * (`@octa/tokens/figure.css` maps its fig-* classes to the theme). One image
 * to assistive tech: named by the figure's title, described by its <desc>.
 */
export function FigureDrawing({ svg, title }: { svg: string; title: string }) {
  const { html, desc } = useMemo(() => prepareFigure(svg), [svg]);
  const descId = useId();
  if (!html) {
    return (
      <p className="fig-refused" role="note">
        This figure could not be drawn safely, so it is not shown. Check its SVG file.
      </p>
    );
  }
  return (
    <>
      <div
        className="fig-svg"
        role="img"
        aria-label={title}
        aria-describedby={desc ? descId : undefined}
        // why: the markup is a course figure that passed scripts/lib/figure-svg.mjs
        // (an allowlist: drawing elements only, no handlers, no outside links)
        // before sync wrote it, and prepareFigure() refuses anything that could run.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {desc ? <span id={descId} className="sr-only">{desc}</span> : null}
    </>
  );
}
