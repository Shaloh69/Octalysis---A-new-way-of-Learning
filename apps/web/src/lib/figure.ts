/**
 * Preparing a course figure for inline drawing (docs/FIGURES-AND-AUDIO.md).
 *
 * Every figure has already passed `scripts/lib/figure-svg.mjs` before sync
 * wrote it, so this is a second, cheap guard rather than the gate: if a
 * drawing somehow carries anything that could run, it is not drawn at all.
 * The drawing itself is hidden from assistive tech; its <title> and <desc>
 * are given to the element that wraps it instead, so a screen reader hears
 * the figure once, as one image with a name and a description.
 *
 * `apps/console/src/lib/figure.ts` is the same function for the console.
 */
export interface PreparedFigure {
  /** The SVG markup to draw, or null when it is refused. */
  html: string | null;
  /** The figure's <desc>, as plain text, for aria-describedby. */
  desc: string;
}

const UNSAFE = /<script|<foreignObject|<iframe|<image|<use\b|\son[a-z]+\s*=|javascript:|data:/i;

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

export function prepareFigure(svg: string): PreparedFigure {
  const text = svg.trim();
  const desc = decode(/<desc>([\s\S]*?)<\/desc>/.exec(text)?.[1]?.trim() ?? "");
  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(text) || UNSAFE.test(text)) {
    return { html: null, desc };
  }
  const html = text.replace(/<svg(?=[\s>])/, '<svg aria-hidden="true" focusable="false"');
  return { html, desc };
}
