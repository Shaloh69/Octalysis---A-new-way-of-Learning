// The rules a course figure must pass before it is written to the database
// (docs/FIGURES-AND-AUDIO.md, instructor rulings of 6 Oct 2026).
//
// A figure is drawn for this course as SVG and is rendered INLINE, in the
// reader, the stage check, the exams and the console. Inline SVG is HTML: a
// <script>, an on* handler or a javascript: link would run with the page's
// privileges. So this is an allowlist, not a blocklist: every element and
// every attribute must be one a diagram needs, or the figure is refused.
//
// Colour is not the figure's to choose. A figure says `currentColor` or `none`
// and names a `fig-*` class; each app's CSS maps the classes to its own tokens,
// so a figure is drawn in the realm's colours and held to its AA contrast, and
// no literal colour ever enters the content (root CLAUDE.md: no hex outside
// packages/tokens).
//
// Pure, no dependencies: it is a few regular expressions over a small,
// well-formed dialect, which is all the course's figures are written in.

const ELEMENTS = new Set([
  "svg", "g", "title", "desc", "defs", "marker", "clipPath",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan",
]);

const ATTRIBUTES = new Set([
  "xmlns", "viewBox", "role", "aria-labelledby", "aria-hidden", "id", "class",
  "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "points", "transform", "fill", "stroke", "stroke-width",
  "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
  "fill-opacity", "stroke-opacity", "marker-start", "marker-end", "markerWidth",
  "markerHeight", "refX", "refY", "orient", "markerUnits", "clip-path",
  "font-size", "font-weight", "text-anchor", "dominant-baseline", "dx", "dy",
  "letter-spacing", "preserveAspectRatio", "vector-effect", "xml:space",
]);

const COLOUR_ATTRS = new Set(["fill", "stroke"]);
// The closed set packages/tokens/figure.css styles. Any other name would be a
// class nobody gave a colour to.
export const FIGURE_CLASSES = new Set([
  "fig-ink", "fig-muted", "fig-line", "fig-box", "fig-fill", "fig-accent", "fig-accent-line", "fig-mono",
]);
const REF_ATTRS = new Set(["marker-start", "marker-end", "clip-path"]);
export const MAX_VIEWBOX_WIDTH = 440;
export const MIN_FONT_SIZE = 14;

/**
 * Check one figure. Returns `{ problems, title }`: an empty `problems` array
 * means the figure may be synced, and `title` is its accessible name.
 *
 * @param {string} svg   the file's text
 * @param {string} id    the figure id (`10-instruction-format`); every `id`
 *                       inside must start with it, so two figures on one page
 *                       can never collide on a marker's id
 */
export function checkFigureSvg(svg, id) {
  const problems = [];
  const fail = (m) => problems.push(m);
  const text = String(svg).trim();

  if (!/^[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`the id "${id}" is not NN-slug`);
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text)) fail("no DOCTYPE, ENTITY or CDATA");
  if (/<\?(?!xml\s)/.test(text)) fail("no processing instructions");
  // A double hyphen inside an XML comment makes the file malformed and it
  // renders as a broken image (root CLAUDE.md, the first icon.svg).
  for (const c of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (c[1].includes("--")) fail("a comment contains a double hyphen, which XML forbids");
  }
  const body = text.replace(/<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
  if (!/^\s*<svg[\s>]/.test(body)) fail("the file must start with <svg>");

  // Walk the tags: allowlisted names and attributes, balanced nesting.
  const stack = [];
  let title = null;
  let sawDesc = false;
  let rootAttrs = null;
  const tagRe = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s=>/]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let consumed = "";
  let last = 0;
  let m;
  while ((m = tagRe.exec(body)) !== null) {
    consumed += body.slice(last, m.index);
    last = tagRe.lastIndex;
    const [, closing, name, attrText, selfClose] = m;
    if (!ELEMENTS.has(name)) {
      fail(`<${name}> is not a drawing element`);
      continue;
    }
    if (closing) {
      const open = stack.pop();
      if (open !== name) fail(`</${name}> closes <${open ?? "nothing"}>`);
      continue;
    }
    const attrs = {};
    for (const a of attrText.matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) {
      const [, key, value] = a;
      attrs[key] = value;
      if (/^on/i.test(key)) { fail(`${key} handlers are not allowed`); continue; }
      if (!ATTRIBUTES.has(key)) { fail(`the attribute ${key} is not allowed (on <${name}>)`); continue; }
      if (/javascript:|data:|https?:|\/\//i.test(value) && key !== "xmlns") fail(`${key}="${value}" points outside the figure`);
      if (COLOUR_ATTRS.has(key) && !/^(none|currentColor)$/.test(value)) {
        fail(`${key}="${value}": colour comes from a fig-* class, so ${key} may only be none or currentColor`);
      }
      if (REF_ATTRS.has(key) && !new RegExp(`^url\\(#${id}-[\\w-]+\\)$`).test(value)) {
        fail(`${key}="${value}" must be url(#${id}-...)`);
      }
      if (key === "class" && !value.split(/\s+/).every((c) => FIGURE_CLASSES.has(c))) {
        fail(`class="${value}": only the fig-* classes figure.css styles (${[...FIGURE_CLASSES].join(", ")})`);
      }
      if (key === "id" && !value.startsWith(`${id}-`)) fail(`id="${value}" must start with "${id}-"`);
      if (key === "font-size") {
        const n = Number(value);
        if (!Number.isFinite(n) || n < MIN_FONT_SIZE) fail(`font-size="${value}" is under ${MIN_FONT_SIZE}, unreadable at 380px`);
      }
    }
    if (name === "svg") {
      if (stack.length === 0 && rootAttrs === null) rootAttrs = attrs;
      else fail("a nested <svg> is not allowed");
    }
    if (name === "title" && stack.length === 1 && title === null) {
      const close = body.indexOf("</title>", tagRe.lastIndex);
      title = close > 0 ? body.slice(tagRe.lastIndex, close).trim() : "";
    }
    if (name === "desc" && stack.length === 1) sawDesc = true;
    if (!selfClose) stack.push(name);
  }
  consumed += body.slice(last);
  if (stack.length > 0) fail(`<${stack[stack.length - 1]}> is never closed`);

  // Text between tags: no markup slipped past the tag pattern, and only the
  // five escapes XML knows.
  if (/[<>]/.test(consumed)) fail("there is a < or > that is not part of a tag");
  for (const e of consumed.matchAll(/&([^;\s]*);?/g)) {
    if (!/^(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+)$/.test(e[1])) fail(`&${e[1]} is not an XML escape`);
  }

  if (rootAttrs) {
    if (rootAttrs.xmlns !== "http://www.w3.org/2000/svg") fail('the root needs xmlns="http://www.w3.org/2000/svg"');
    if ("width" in rootAttrs || "height" in rootAttrs) fail("the root takes no width or height: the page sizes it");
    const vb = (rootAttrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
      fail("the root needs a viewBox of four numbers");
    } else if (vb[2] > MAX_VIEWBOX_WIDTH) {
      fail(`the viewBox is ${vb[2]} wide; at most ${MAX_VIEWBOX_WIDTH}, or its text is unreadable at 380px`);
    }
  }
  if (!title) fail("the figure needs a <title> as a direct child of <svg>: it is the accessible name");
  if (!sawDesc) fail("the figure needs a <desc> as a direct child of <svg>: it is the long description");

  return { problems, title: title ?? "" };
}
