import { parseBlocks, parseInline, type Block, type Inline } from "./reader-markdown";

/**
 * The Studio's editor, and the student reader's markdown, in both directions
 * (docs/STUDIO-EDITOR-PLAN.md, E1.2). Pure data: no DOM, no editor library, so
 * it is tested in plain Node over EVERY block of every chapter and draft
 * (`test/editor-doc.spec.ts`).
 *
 *   topics (the chapter's blocks)  <->  a document of editor nodes (ProseMirror JSON,
 *                                       what TipTap's `getJSON()` returns)
 *
 * It is our own, not a generic markdown converter, because the reader's
 * markdown is a small custom dialect and a generic one would drift from it:
 * no escapes, `**` content cannot contain `*`, a list item is one line of inline
 * markup, `_` emphasis only at word edges, numbers get their own mono style.
 * What the editor offers is exactly what the reader can draw.
 *
 * THE FIDELITY LAW, held by the test: a topic's markdown goes into the editor and
 * comes back as markdown the READER parses to the same blocks, with the same
 * words carrying the same bold, italic and code. A quote or a figure comes back
 * byte for byte. Text a student reader would read as formatting (a literal `*x*`,
 * a paragraph that starts `- `) cannot be written in this dialect at all, so the
 * editor says so (`collisions`) rather than silently saving something else.
 */

export type TopicKind = "prose" | "brief" | "callout" | "code" | "quote" | "figure";

export interface Topic {
  id: string | null;
  kind: TopicKind;
  body: string;
  meta: Record<string, string>;
}

/** A node in ProseMirror's JSON form: what the editor holds and `getJSON()` returns. */
export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: Array<{ type: "bold" | "italic" | "code" }>;
}

export const RICH: ReadonlySet<TopicKind> = new Set(["prose", "brief", "callout"]);
export const LOCKED: ReadonlySet<TopicKind> = new Set(["quote", "figure"]);

/* ------------------------------------------------------------------ inline */

/** A stretch of text and the marks it carries. The same shape from the reader's AST and from the editor. */
export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

const NO_MARKS = { bold: false, italic: false, code: false };

export function runsFromInline(inl: readonly Inline[], marks = NO_MARKS): Run[] {
  const out: Run[] = [];
  for (const n of inl) {
    if (n.t === "text" || n.t === "num") out.push({ text: n.v, ...marks });
    else if (n.t === "code") out.push({ text: n.v, ...marks, code: true });
    else if (n.t === "strong") out.push(...runsFromInline(n.c, { ...marks, bold: true }));
    else out.push(...runsFromInline(n.c, { ...marks, italic: true }));
  }
  return out;
}

export function runsFromPM(nodes: readonly PMNode[]): Run[] {
  return nodes
    .filter((n) => n.type === "text")
    .map((n) => {
      const m = new Set((n.marks ?? []).map((k) => k.type));
      return { text: n.text ?? "", bold: m.has("bold"), italic: m.has("italic"), code: m.has("code") };
    });
}

/**
 * The canonical form two runs lists are compared in. Per character: a stretch of
 * bold (or italic) is one GROUP, a space between two groups belongs to the group
 * (`**a** **b**` and `**a b**` read the same), and a group never starts or ends
 * on whitespace (an edge space is not visibly bold). Code is literal: its spaces
 * are never touched. Then neighbours with the same marks are merged. Two inline
 * texts with equal normalised runs read the same to a student.
 */
export function normalizeRuns(runs: readonly Run[]): Run[] {
  const cs: Array<{ ch: string; bold: boolean; italic: boolean; code: boolean }> = [];
  for (const r of runs) for (const ch of r.text) cs.push({ ch, bold: r.bold, italic: r.italic, code: r.code });
  const ws = (c: (typeof cs)[number]) => !c.code && /\s/.test(c.ch);
  for (const m of ["bold", "italic"] as const) {
    // Bridge: whitespace between two marked characters is marked.
    for (let i = 0; i < cs.length; ) {
      if (!cs[i]![m] && ws(cs[i]!)) {
        let j = i;
        while (j < cs.length && !cs[j]![m] && ws(cs[j]!)) j++;
        if (i > 0 && j < cs.length && cs[i - 1]![m] && cs[j]![m]) for (let k = i; k < j; k++) cs[k]![m] = true;
        i = j;
      } else i++;
    }
    // Trim: a group does not begin or end on whitespace.
    for (let i = 0; i < cs.length; ) {
      if (!cs[i]![m]) { i++; continue; }
      let j = i;
      while (j < cs.length && cs[j]![m]) j++;
      let lo = i, hi = j;
      while (lo < hi && ws(cs[lo]!)) cs[lo++]![m] = false;
      while (hi > lo && ws(cs[hi - 1]!)) cs[--hi]![m] = false;
      i = j;
    }
  }
  const out: Run[] = [];
  for (const c of cs) {
    const last = out[out.length - 1];
    if (last && last.bold === c.bold && last.italic === c.italic && last.code === c.code) last.text += c.ch;
    else out.push({ text: c.ch, bold: c.bold, italic: c.italic, code: c.code });
  }
  return out;
}

const markOf = (r: Run) => (r.bold ? 1 : 0) + (r.italic ? 2 : 0) + (r.code ? 4 : 0);

const codeSpan = (r: Run) => (r.code ? `\`${r.text}\`` : r.text);

/** Italic groups inside a stretch with the same bold: `*x*` outside bold, `_x_` inside it (bold cannot contain `*`). */
function italicGroups(runs: readonly Run[], mark: "*" | "_"): string {
  let out = "";
  for (let i = 0; i < runs.length; ) {
    let j = i;
    const it = runs[i]!.italic;
    while (j < runs.length && runs[j]!.italic === it) j++;
    const inner = runs.slice(i, j).map(codeSpan).join("");
    out += it ? `${mark}${inner}${mark}` : inner;
    i = j;
  }
  return out;
}

/**
 * Runs as the reader's inline markdown, grouped the way a person wrote it:
 * `*Does `MUL` exist?*` is one italic span around its code, not three.
 */
export function runsToMarkdown(runs: readonly Run[]): string {
  const norm = normalizeRuns(runs);
  let out = "";
  for (let i = 0; i < norm.length; ) {
    let j = i;
    const b = norm[i]!.bold;
    while (j < norm.length && norm[j]!.bold === b) j++;
    const seg = norm.slice(i, j);
    out += b ? `**${italicGroups(seg, "_")}**` : italicGroups(seg, "*");
    i = j;
  }
  return out;
}

/** The runs a piece of inline markdown reads as: what a student sees of it. */
export const runsOfMarkdown = (md: string): Run[] => normalizeRuns(runsFromInline(parseInline(md)));

/** Plain text of runs, for the "does it say the same words" half of a comparison. */
export const textOf = (runs: readonly Run[]): string => runs.map((r) => r.text).join("");

/**
 * Whether these runs survive the reader: serialised and read back they are the
 * same words with the same marks. False for text like a literal `*x*` or a
 * backtick inside code, which this dialect has no way to escape.
 */
export function inlineRoundTrips(runs: readonly Run[]): boolean {
  const want = normalizeRuns(runs);
  const got = runsOfMarkdown(runsToMarkdown(want));
  return JSON.stringify(got) === JSON.stringify(want);
}

/* ------------------------------------------------------------ AST -> editor */

const textNode = (r: Run): PMNode => ({
  type: "text",
  text: r.text,
  ...(markOf(r) === 0
    ? {}
    : { marks: [...(r.bold ? [{ type: "bold" as const }] : []), ...(r.italic ? [{ type: "italic" as const }] : []), ...(r.code ? [{ type: "code" as const }] : [])] }),
});

const inlineNodes = (inl: readonly Inline[]): PMNode[] => normalizeRuns(runsFromInline(inl)).map(textNode);

const paragraph = (inl: readonly Inline[]): PMNode => {
  const content = inlineNodes(inl);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
};

function tableMarkdown(head: Inline[][] | null, rows: Inline[][][]): string {
  const line = (cells: Inline[][]) => `| ${cells.map((c) => runsToMarkdown(runsFromInline(c))).join(" | ")} |`;
  const width = Math.max(head?.length ?? 0, ...rows.map((r) => r.length), 1);
  const lines: string[] = [];
  if (head) {
    lines.push(line(head));
    lines.push(`| ${Array.from({ length: width }, () => "---").join(" | ")} |`);
  }
  for (const r of rows) lines.push(line(r));
  return lines.join("\n");
}

function blockNode(b: Block): PMNode {
  switch (b.t) {
    case "h":
      return { type: "heading", attrs: { level: b.level }, ...contentOf(inlineNodes(b.c)) };
    case "p":
      return paragraph(b.c);
    case "list":
      return {
        type: b.ordered ? "orderedList" : "bulletList",
        ...(b.ordered ? { attrs: { start: b.start } } : {}),
        content: b.items.map((it) => ({ type: "listItem", content: [paragraph(it)] })),
      };
    case "quote":
      return { type: "blockquote", content: b.c.length > 0 ? b.c.map(blockNode) : [{ type: "paragraph" }] };
    case "table":
      return { type: "tableBlock", attrs: { md: tableMarkdown(b.head, b.rows) } };
  }
}

const contentOf = (content: PMNode[]) => (content.length > 0 ? { content } : {});

/** One topic as an editor node. */
export function topicNode(t: Topic): PMNode {
  if (LOCKED.has(t.kind)) return { type: "lockedTopic", attrs: { id: t.id, kind: t.kind, body: t.body, meta: t.meta } };
  if (t.kind === "code") {
    return { type: "codeTopic", attrs: { id: t.id, kind: "code", meta: t.meta }, ...contentOf(t.body === "" ? [] : [{ type: "text", text: t.body }]) };
  }
  const blocks = parseBlocks(t.body).map(blockNode);
  return { type: "topic", attrs: { id: t.id, kind: t.kind, meta: t.meta }, content: blocks.length > 0 ? blocks : [{ type: "paragraph" }] };
}

export const topicsToDoc = (topics: readonly Topic[]): PMNode => ({ type: "doc", content: topics.map(topicNode) });

/* ------------------------------------------------------------ editor -> text */

const inlineMd = (n: PMNode): string => runsToMarkdown(runsFromPM(n.content ?? []));

function nodeMarkdown(n: PMNode): string {
  switch (n.type) {
    case "paragraph":
      return inlineMd(n);
    case "heading":
      return `${"#".repeat(Number(n.attrs?.level ?? 2))} ${inlineMd(n)}`;
    case "bulletList":
      return (n.content ?? []).map((li) => `- ${listItemMd(li)}`).join("\n");
    case "orderedList": {
      const start = Number(n.attrs?.start ?? 1);
      return (n.content ?? []).map((li, i) => `${start + i}. ${listItemMd(li)}`).join("\n");
    }
    case "blockquote":
      return blocksMarkdown(n.content ?? [])
        .split("\n")
        .map((l) => (l === "" ? ">" : `> ${l}`))
        .join("\n");
    case "tableBlock":
      return String(n.attrs?.md ?? "");
    default:
      return "";
  }
}

const listItemMd = (li: PMNode): string => (li.content ?? []).map(inlineMd).join(" ");

/** Block nodes as one body of reader markdown: blocks apart by a blank line, empty paragraphs gone. */
export function blocksMarkdown(nodes: readonly PMNode[]): string {
  return nodes
    .filter((n) => !(n.type === "paragraph" && (n.content ?? []).every((c) => (c.text ?? "") === "")))
    .map(nodeMarkdown)
    .join("\n\n");
}

/**
 * The editor's document back to the chapter's topics.
 *
 * `originals` are the topics the editor was opened with. A topic whose reading did
 * not change keeps its original text BYTE FOR BYTE (the chapter files are hard
 * wrapped, the editor's output is not, and re-wording ~700 untouched topics would
 * re-version every one of them on Publish). Only what a teacher really changed is
 * written from the editor.
 */
export function docToTopics(doc: PMNode, originals: readonly Topic[] = []): Topic[] {
  const byId = new Map(originals.filter((o) => o.id).map((o) => [o.id!, o]));
  return (doc.content ?? []).map((n): Topic => {
    const id = (n.attrs?.id as string | null | undefined) ?? null;
    const meta = (n.attrs?.meta as Record<string, string> | undefined) ?? {};
    if (n.type === "lockedTopic") {
      return { id, kind: n.attrs?.kind as TopicKind, body: String(n.attrs?.body ?? ""), meta };
    }
    if (n.type === "codeTopic") return { id, kind: "code", body: (n.content ?? []).map((c) => c.text ?? "").join(""), meta };
    const kind = (n.attrs?.kind as TopicKind) ?? "prose";
    const body = blocksMarkdown(n.content ?? []);
    const was = id ? byId.get(id) : undefined;
    if (was && was.kind === kind && JSON.stringify(readingOf(was.body)) === JSON.stringify(readingOf(body))) {
      return { id, kind, body: was.body, meta };
    }
    return { id, kind, body, meta };
  });
}

/* ---------------------------------------------------------------- collisions */

/**
 * Text this dialect cannot hold as typed, found in the editor's document: bold,
 * italic and code that do not survive the reader, and a paragraph the reader
 * would take for a list, a quote, a heading or a table. A warning for the
 * teacher on every edit, never silent (the Preview shows what a student sees).
 */
export function docCollisions(doc: PMNode): string[] {
  const found: string[] = [];
  const walk = (n: PMNode, rich: boolean) => {
    if (n.type === "codeTopic" || n.type === "lockedTopic") return;
    if (n.type === "paragraph" || n.type === "heading") {
      const runs = runsFromPM(n.content ?? []);
      const said = textOf(runs).slice(0, 40);
      if (!inlineRoundTrips(runs)) found.push(`"${said}" has a * or _ or backtick the student reader would read as formatting`);
      // The MARKDOWN line the reader sees, not the plain text: `**1. Step**` begins with `**`, not a list.
      if (n.type === "paragraph" && rich && /^\s*(?:[-*]\s|\d+[.)]\s|>|\||#{2,4}\s)/.test(runsToMarkdown(runs))) {
        found.push(`"${said}" starts the way a list, quote, table or heading does, so the reader would draw it as one`);
      }
    }
    (n.content ?? []).forEach((c) => walk(c, rich && n.type !== "listItem"));
  };
  (doc.content ?? []).forEach((n) => walk(n, true));
  return found;
}

/** The same check on a stored topic (its markdown read as the editor would hold it). */
export const collisions = (t: Topic): string[] => (RICH.has(t.kind) ? docCollisions({ type: "doc", content: [topicNode(t)] }) : []);

/**
 * The equal-reading form of a topic's markdown, for tests and for "did this
 * edit change anything a student would see": the reader's blocks, with inline
 * text as normalised runs.
 */
export function readingOf(body: string): unknown {
  const inl = (c: readonly Inline[]) => normalizeRuns(runsFromInline(c));
  const blk = (b: Block): unknown => {
    switch (b.t) {
      case "h": return { t: "h", level: b.level, c: inl(b.c) };
      case "p": return { t: "p", c: inl(b.c) };
      case "list": return { t: "list", ordered: b.ordered, start: b.ordered ? b.start : 1, items: b.items.map(inl) };
      case "quote": return { t: "quote", c: b.c.map(blk) };
      case "table": return { t: "table", head: b.head?.map(inl) ?? null, rows: b.rows.map((r) => r.map(inl)) };
    }
  };
  return parseBlocks(body).map(blk);
}

/* ---------------------------------------------------------------- the diff */

export interface TopicDiff {
  /** Topics in the draft that the live chapter does not have. */
  added: Topic[];
  /** Live topics the draft no longer has. */
  removed: Topic[];
  /** Topics both have whose text or kind changed. */
  edited: Array<{ was: Topic; now: Topic }>;
  /** Topics both have, unchanged, in a different place. */
  moved: Topic[];
}

/**
 * What Publish would change, by topic id: the same reckoning the server makes
 * (`working-copy.ts`), shown to the teacher before they say why.
 */
export function diffTopics(live: readonly Topic[], draft: readonly Topic[]): TopicDiff {
  const liveById = new Map(live.filter((t) => t.id).map((t) => [t.id!, t]));
  const draftIds = new Set(draft.filter((t) => t.id).map((t) => t.id!));
  const liveIndex = new Map(live.map((t, i) => [t.id, i]));
  const added: Topic[] = [], edited: TopicDiff["edited"] = [], moved: Topic[] = [];
  draft.forEach((t, i) => {
    const was = t.id ? liveById.get(t.id) : undefined;
    if (!was) added.push(t);
    else if (was.body !== t.body || was.kind !== t.kind) edited.push({ was, now: t });
    else if (liveIndex.get(t.id) !== i) moved.push(t);
  });
  return { added, removed: live.filter((t) => !t.id || !draftIds.has(t.id)), edited, moved };
}

/** A topic in a few words, for a list: its first line, markers stripped. */
export function topicTitle(t: Topic, max = 60): string {
  const line = t.body.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
  const plain = line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/\*\*|`/g, "");
  const said = plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
  return said || (t.kind === "code" ? "A code listing" : "An empty topic");
}
