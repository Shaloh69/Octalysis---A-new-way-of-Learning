/**
 * Following the voice on the page (instructor, 6 Oct 2026: "change the way it
 * follows or highlights the sentences while it reads, with animation like a
 * line or progress bar along the bottom"; template
 * design/templates/web/stage/template-listen.png).
 *
 * The DOM half of Listen: find each spoken sentence in its block's rendered
 * text, paint it (and the word being said) with the CSS Custom Highlight API,
 * and draw a line under the sentence that fills as it is read. Where a
 * sentence cannot be found (a table read row by row, say) only the block is
 * marked; where the browser has no `CSS.highlights` the line still draws.
 */

interface TextMap {
  readonly flat: string;
  /** For each character of `flat`, the text node and offset it came from. */
  readonly at: ReadonlyArray<readonly [Text, number]>;
}

const BOXES = "p, li, h1, h2, h3, h4, h5, h6, td, th, figcaption, blockquote, dt, dd";

/** The block's visible text with whitespace collapsed, and where each character lives. */
function textMap(root: HTMLElement): TextMap {
  let flat = "";
  const at: Array<[Text, number]> = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      (n.parentElement?.closest("[aria-hidden='true'], .rd-follow, pre, code") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let lastSpace = true;
  let prev: Text | null = null;
  let prevBox: Element | null = null;
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    // Two boxes' texts (a list item and the next) never run together; "**ALU**." does.
    const box = n.parentElement?.closest(BOXES) ?? null;
    if (prev && box !== prevBox && !lastSpace) {
      flat += " ";
      at.push([prev, prev.length - 1]);
      lastSpace = true;
    }
    const t = n.data;
    for (let i = 0; i < t.length; i++) {
      const space = /\s/.test(t[i]!);
      if (space && lastSpace) continue;
      flat += space ? " " : t[i];
      at.push([n, i]);
      lastSpace = space;
    }
    prev = n;
    prevBox = box;
  }
  return { flat, at };
}

function rangeOf(map: TextMap, from: number, to: number): Range | null {
  const a = map.at[from];
  const b = map.at[to - 1];
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a[0], a[1]);
  r.setEnd(b[0], Math.min(b[1] + 1, b[0].length));
  return r;
}

export interface Located {
  readonly sentence: Range;
  /** The sentence's words, as ranges, in order. */
  readonly words: readonly Range[];
}

/**
 * Locate, in order, every sentence a block's chunks will say. `chunks` is the
 * sentences of each chunk in this block, as the page shows them. A sentence
 * not found is null; the search carries on after the last one found.
 */
export function locate(block: HTMLElement, chunks: ReadonlyArray<readonly string[]>): Array<Array<Located | null>> {
  const map = textMap(block);
  let cursor = 0;
  return chunks.map((sentences) =>
    sentences.map((s) => {
      const i = map.flat.indexOf(s, cursor);
      if (i < 0) return null;
      cursor = i + s.length;
      const sentence = rangeOf(map, i, i + s.length);
      if (!sentence) return null;
      const words: Range[] = [];
      for (const m of s.matchAll(/\S+/g)) {
        const w = rangeOf(map, i + m.index!, i + m.index! + m[0].length);
        if (w) words.push(w);
      }
      return { sentence, words };
    }),
  );
}

/* ---------------------------------------------------------------- painting */

type HighlightRegistry = Map<string, unknown>;
const registry = (): HighlightRegistry | null =>
  typeof CSS !== "undefined" && "highlights" in CSS ? (CSS as unknown as { highlights: HighlightRegistry }).highlights : null;
const Highlight = (): (new (...r: Range[]) => unknown) | null =>
  typeof window !== "undefined" && "Highlight" in window
    ? (window as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight
    : null;

/** Paint the sentence and the word (`listen-sentence`, `listen-word` in reader.css). */
export function paint(sentence: Range | null, word: Range | null): void {
  const reg = registry();
  const H = Highlight();
  if (!reg || !H) return;
  if (sentence) reg.set("listen-sentence", new H(sentence));
  else reg.delete("listen-sentence");
  if (word) reg.set("listen-word", new H(word));
  else reg.delete("listen-word");
}

export function unpaint(): void {
  const reg = registry();
  reg?.delete("listen-sentence");
  reg?.delete("listen-word");
}

/* ------------------------------------------------------- the line under it */

/** One segment of line per line of text the sentence covers, relative to the block. */
export function lineSegments(range: Range, block: HTMLElement): Array<{ left: number; top: number; width: number }> {
  const box = block.getBoundingClientRect();
  const lines: Array<{ left: number; right: number; bottom: number }> = [];
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 1) continue;
    const same = lines.find((l) => Math.abs(l.bottom - r.bottom) < r.height / 2);
    if (same) {
      same.left = Math.min(same.left, r.left);
      same.right = Math.max(same.right, r.right);
      same.bottom = Math.max(same.bottom, r.bottom);
    } else lines.push({ left: r.left, right: r.right, bottom: r.bottom });
  }
  return lines.map((l) => ({
    left: l.left - box.left - block.clientLeft,
    top: l.bottom - box.top - block.clientTop,
    width: l.right - l.left,
  }));
}

/**
 * Draw the line under a sentence into the block, and fill it: gliding over
 * `glideMs` when no word events come, or up to `upTo` (0..1 of the sentence)
 * when they do. Under reduced motion there is no glide: the line is drawn
 * full, or to the word, at once. Returns the overlay, for pausing and removal.
 */
export function drawLine(
  block: HTMLElement,
  range: Range,
  fill: { glideMs: number } | { upTo: number },
  calm: boolean,
): HTMLElement {
  block.querySelector(":scope > .rd-follow")?.remove();
  const layer = document.createElement("div");
  layer.className = "rd-follow";
  layer.setAttribute("aria-hidden", "true");
  const segs = lineSegments(range, block);
  const total = segs.reduce((n, s) => n + s.width, 0) || 1;
  let cum = 0;
  for (const s of segs) {
    const line = document.createElement("span");
    line.className = "rd-follow-line";
    line.style.left = `${s.left}px`;
    line.style.top = `${s.top}px`;
    line.style.width = `${s.width}px`;
    const bar = document.createElement("span");
    bar.className = "rd-follow-fill";
    line.appendChild(bar);
    layer.appendChild(line);
    const start = cum / total;
    const end = (cum + s.width) / total;
    cum += s.width;
    if ("glideMs" in fill) {
      if (calm) bar.style.transform = "scaleX(1)";
      else
        bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          delay: fill.glideMs * start,
          duration: Math.max(1, fill.glideMs * (end - start)),
          easing: "linear",
          fill: "both",
        });
    } else {
      const k = Math.min(1, Math.max(0, (fill.upTo - start) / (end - start)));
      bar.style.transform = `scaleX(${k})`;
    }
  }
  block.appendChild(layer);
  return layer;
}

/** Move an existing line's fill to a new point (word events), without redrawing it. */
export function fillTo(layer: HTMLElement, upTo: number): void {
  const lines = Array.from(layer.querySelectorAll<HTMLElement>(".rd-follow-line"));
  const widths = lines.map((l) => l.getBoundingClientRect().width);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  let cum = 0;
  lines.forEach((l, i) => {
    const start = cum / total;
    const end = (cum + widths[i]!) / total;
    cum += widths[i]!;
    const bar = l.firstElementChild as HTMLElement;
    for (const a of bar.getAnimations()) a.cancel();
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, (upTo - start) / (end - start)))})`;
  });
}

/** Pause or play the glide (the voice paused or resumed). */
export function holdLine(layer: HTMLElement | null, hold: boolean): void {
  if (!layer) return;
  for (const a of layer.getAnimations({ subtree: true })) {
    if (hold) a.pause();
    else a.play();
  }
}
