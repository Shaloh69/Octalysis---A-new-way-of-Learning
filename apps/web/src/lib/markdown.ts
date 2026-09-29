/**
 * The stage reader's markdown: exactly what `content_blocks.body_md` uses, and
 * nothing it does not.
 *
 * Deliberately not a library. The content is authored in this repo and reviewed
 * in git, and the surface should stay small enough to read in one sitting.
 * Measured over every block of stages 00-18 (29 Sep 2026): `##`/`###` headings,
 * `-` and `1.` lists whose items wrap onto indented lines, `>` quotes, `|`
 * tables, `**bold**`, `*italic*`, `_italic_` and `` `code` ``. No links, no
 * images, no fences (a figure is its own `code` block).
 *
 * The old renderer knew paragraphs, flat lists and bold, so 47 headings read
 * with their hashes and every wrapped list was one run-on paragraph
 * (NEXT-SESSION §0j.3). `design/templates/web/stage/SPEC.md` has the table.
 */

export type Inline =
  | { t: "text"; v: string }
  /** A number in running text. Mono by the type rule: "ALL numbers … render in mono". */
  | { t: "num"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] };

export type Block =
  | { t: "h"; level: 2 | 3 | 4; c: Inline[]; text: string }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { t: "quote"; c: Block[] }
  | { t: "table"; head: Inline[][] | null; rows: Inline[][][] };

const HEADING = /^(#{2,4})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE = /^\s*\|/;
const RULE_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** One block's body, top-level. */
export function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  const startsBlock = (l: string) =>
    HEADING.test(l) || BULLET.test(l) || ORDERED.test(l) || QUOTE.test(l) || TABLE.test(l);

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      const c = parseInline(h[2]!.trim());
      out.push({ t: "h", level: h[1]!.length as 2 | 3 | 4, c, text: plain(c) });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) inner.push(QUOTE.exec(lines[i]!)![1]!), i++;
      out.push({ t: "quote", c: parseBlocks(inner.join("\n")) });
      continue;
    }

    if (TABLE.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && TABLE.test(lines[i]!)) rows.push(lines[i]!), i++;
      out.push(table(rows));
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = !bullet;
      const items: string[] = [];
      const start = ordered ? Number(ordered[1]) : 1;
      // A list runs until a blank line followed by something that is not
      // another item of the same kind, or until a different block starts.
      while (i < lines.length) {
        const l = lines[i]!;
        const m = isOrdered ? ORDERED.exec(l) : BULLET.exec(l);
        if (m) {
          items.push((isOrdered ? m[2] : m[1])!.trim());
          i++;
          continue;
        }
        if (l.trim() === "") {
          const next = lines[i + 1];
          if (next !== undefined && (isOrdered ? ORDERED.test(next) : BULLET.test(next))) {
            i++;
            continue;
          }
          break;
        }
        if (startsBlock(l)) break;
        // A continuation: the item wrapped onto the next line.
        items[items.length - 1] += " " + l.trim();
        i++;
      }
      out.push({ t: "list", ordered: isOrdered, start, items: items.map(parseInline) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !startsBlock(lines[i]!)) {
      para.push(lines[i]!.trim());
      i++;
    }
    out.push({ t: "p", c: parseInline(para.join(" ")) });
  }
  return out;
}

function cells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

function table(rows: string[]): Block {
  const hasRule = rows.length > 1 && RULE_ROW.test(rows[1]!);
  const headCells = hasRule ? cells(rows[0]!) : null;
  const body = (hasRule ? rows.slice(2) : rows).map((r) => cells(r).map(parseInline));
  const head = headCells && headCells.some((c) => c !== "") ? headCells.map(parseInline) : null;
  return { t: "table", head, rows: body };
}

/*
 * Inline markup. Code first, so nothing inside backticks is read as emphasis
 * or a number; then bold; then italics. `_x_` only at word edges, so
 * `stage_progress` stays one word.
 */
const INLINE =
  /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*\s](?:[^*]*?[^*\s])?\*)|((?<![A-Za-z0-9])_[^_\s](?:[^_]*?[^_\s])?_(?![A-Za-z0-9]))/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...numbers(s.slice(last, at)));
    const tok = m[0];
    if (m[1]) out.push({ t: "code", v: tok.slice(1, -1) });
    else if (m[2]) out.push({ t: "strong", c: parseInline(tok.slice(2, -2)) });
    else out.push({ t: "em", c: parseInline(tok.slice(1, -1)) });
    last = at + tok.length;
  }
  if (last < s.length) out.push(...numbers(s.slice(last)));
  return out;
}

/*
 * A number: optional letters glued to it (x86, L3), a digit, more word
 * characters, points, commas or hyphens ending on a word character (8.33,
 * 1,000, x86-16), and an optional percent sign. A full stop that ends the
 * sentence is not part of it.
 */
const NUMBER = /[A-Za-z]*\d(?:[\w.,-]*\w)?%?/g;

function numbers(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(NUMBER)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: s.slice(last, at) });
    out.push({ t: "num", v: m[0] });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function plain(c: Inline[]): string {
  return c.map((n) => ("v" in n ? n.v : plain(n.c))).join("");
}

/** A parsed block; a `##` carries the rail section it opens. */
export type Numbered = Block & { section?: number };

/**
 * Parse every block once and number its `##` headings in reading order. The
 * brief (when there is one) is section 0, so each `##` takes 1, 2, 3 …; with
 * no brief the first `##` is 0. A figure's lines are never headings, and
 * `###` stays inside its section. Numbered before render, so a re-render (or
 * StrictMode rendering twice) can never shift an anchor.
 */
export function numberBlocks(blocks: ReadonlyArray<{ kind: string; body: string }>): Numbered[][] {
  let n = blocks.some((b) => b.kind === "brief") ? 0 : -1;
  const walk = (b: Block): Numbered =>
    b.t === "h" && b.level === 2 ? { ...b, section: ++n } : b.t === "quote" ? { ...b, c: b.c.map(walk) } : b;
  return blocks.map((b) => (b.kind === "code" ? [] : parseBlocks(b.body ?? "").map(walk)));
}

/** The rail's sections after the brief: every `##`, in order, with its number. */
export function sectionsOf(
  blocks: ReadonlyArray<{ kind: string; body: string }>,
): Array<{ section: number; label: string }> {
  const out: Array<{ section: number; label: string }> = [];
  const collect = (b: Numbered): void => {
    if (b.t === "h" && b.section !== undefined) out.push({ section: b.section, label: b.text });
    if (b.t === "quote") b.c.forEach(collect);
  };
  numberBlocks(blocks).flat().forEach(collect);
  return out;
}

/** `ch-04.md 4.2` → `Chapter 4, §4.2`. Anything else is shown as written. */
export function sourceLabel(source: string): string {
  const m = /^ch-0*(\d+)\.md\s+([\d.]+)$/.exec(source.trim());
  return m ? `Chapter ${m[1]}, §${m[2]}` : source;
}

/** A figure's longest line in characters, for its fit-to-width size at 380. */
export function longestLine(body: string): number {
  return Math.max(1, ...body.replace(/\r\n?/g, "\n").split("\n").map((l) => [...l].length));
}
