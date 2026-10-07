import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  blocksMarkdown, collisions, docCollisions, docToTopics, inlineRoundTrips, normalizeRuns, readingOf, runsFromPM,
  runsOfMarkdown, runsToMarkdown, topicNode, topicsToDoc, type PMNode, type Run, type Topic, type TopicKind,
} from "../src/lib/editor-doc";

/**
 * THE FIDELITY LAW of the Studio's editor (docs/STUDIO-EDITOR-PLAN.md, E1.2):
 * what goes into the editor comes back as markdown the student READER reads the
 * same. Held over every block of every chapter and every drafted chapter, so
 * "type like Word" cannot quietly change what a student sees.
 */

const STAGES = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "stages");

interface Real { where: string; topic: Topic }

function real(): Real[] {
  const out: Real[] = [];
  for (const f of readdirSync(STAGES).filter((n) => /^\d\d(\.draft)?\.md$/.test(n))) {
    const text = readFileSync(resolve(STAGES, f), "utf8").replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, "");
    const heads = [...text.matchAll(/<!-- block: ([^>]*?)-->/g)];
    const parts = text.split(/<!-- block: [^>]*-->/).slice(1);
    parts.forEach((body, i) => {
      const head = heads[i]![1]!.trim();
      const kind = head.split(/\s+/)[0] as TopicKind;
      const meta: Record<string, string> = {};
      for (const m of head.matchAll(/(\w+)="([^"]*)"/g)) meta[m[1]!] = m[2]!;
      out.push({ where: `${f} block ${i + 1}`, topic: { id: null, kind, body: body.trim(), meta } });
    });
  }
  return out;
}

const through = (t: Topic): Topic => docToTopics(topicsToDoc([t]))[0]!;
const all = real();

describe("every real block goes through the editor and comes back", () => {
  it("reads the real chapters and drafts, every kind among them, so nothing passes on nothing", () => {
    expect(all.length).toBeGreaterThan(700);
    for (const k of ["prose", "brief", "callout", "code", "quote", "figure"]) {
      expect(all.some((b) => b.topic.kind === k), k).toBe(true);
    }
  });

  it("a quote and a figure come back byte for byte, id and meta included", () => {
    for (const { where, topic } of all.filter((b) => b.topic.kind === "quote" || b.topic.kind === "figure")) {
      expect(through({ ...topic, id: "00000000-0000-4000-8000-000000000001" }), where).toEqual({
        ...topic, id: "00000000-0000-4000-8000-000000000001",
      });
    }
  });

  it("a code listing comes back byte for byte", () => {
    for (const { where, topic } of all.filter((b) => b.topic.kind === "code")) {
      expect(through(topic).body, where).toBe(topic.body);
    }
  });

  it("prose, a brief and a callout come back READING the same: same blocks, same words, same bold, italic and code", () => {
    for (const { where, topic } of all.filter((b) => ["prose", "brief", "callout"].includes(b.topic.kind))) {
      const back = through(topic);
      expect(readingOf(back.body), where).toEqual(readingOf(topic.body));
      expect(back.kind, where).toBe(topic.kind);
      expect(back.meta, where).toEqual(topic.meta);
    }
  });

  it("and a second trip changes nothing: the editor's own output is stable", () => {
    for (const { where, topic } of all.filter((b) => ["prose", "brief", "callout"].includes(b.topic.kind))) {
      const once = through(topic);
      expect(through(once).body, where).toBe(once.body);
    }
  });

  it("a topic nobody changed keeps its exact text, byte for byte, when the editor hands it back with its originals", () => {
    // The files are hard-wrapped and the editor's own output is not: without this, saving a
    // chapter would re-word every untouched topic and re-version it on Publish.
    const topics = all.map((b, i) => ({ ...b.topic, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    const back = docToTopics(topicsToDoc(topics), topics);
    expect(back).toEqual(topics);
  });

  it("but a topic that WAS changed is written from the editor, and only that one", () => {
    const topics = all.slice(0, 40).map((b, i) => ({ ...b.topic, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    const rich = topics.findIndex((t) => t.kind === "prose");
    const doc = topicsToDoc(topics);
    doc.content![rich]!.content!.push({ type: "paragraph", content: [{ type: "text", text: "A sentence typed just now." }] });
    const back = docToTopics(doc, topics);
    expect(back[rich]!.body).toContain("A sentence typed just now.");
    back.forEach((t, i) => { if (i !== rich) expect(t).toEqual(topics[i]); });
  });

  it("no real block carries text the reader would take for formatting it was not meant to be", () => {
    for (const { where, topic } of all) expect(collisions(topic), where).toEqual([]);
  });
});

describe("the editor's document", () => {
  const topics: Topic[] = [
    { id: "a", kind: "prose", body: "## Alpha\n\nA **bold** word, an *italic* one and `code`.", meta: {} },
    { id: "b", kind: "quote", body: "Verbatim.", meta: { source: "ch-01.md 1.1" } },
    { id: "c", kind: "code", body: "mov ax, bx\nadd ax, 1", meta: {} },
    { id: "d", kind: "callout", body: "Worth knowing.", meta: { kind: "note" } },
    { id: "e", kind: "figure", body: "A caption.", meta: { id: "00-fig", after: "1.1" } },
  ];

  it("keeps each topic's id, kind, meta and order, as the publish needs them", () => {
    const back = docToTopics(topicsToDoc(topics));
    expect(back.map((t) => [t.id, t.kind, t.meta])).toEqual(topics.map((t) => [t.id, t.kind, t.meta]));
  });

  it("a locked topic is one atom (it cannot be typed into) and a listing is one text node", () => {
    expect(topicNode(topics[1]!).type).toBe("lockedTopic");
    expect(topicNode(topics[1]!).content).toBeUndefined();
    expect(topicNode(topics[2]!).type).toBe("codeTopic");
    expect(topicNode(topics[2]!).content).toEqual([{ type: "text", text: "mov ax, bx\nadd ax, 1" }]);
  });

  it("headings, lists, quotes and tables become the editor's nodes", () => {
    const n = topicNode({
      id: null, kind: "prose",
      body: "## H\n\ntext\n\n- a\n- b\n\n3. x\n4. y\n\n> quoted\n\n| a | b |\n| --- | --- |\n| 1 | 2 |",
      meta: {},
    });
    expect(n.content!.map((c) => c.type)).toEqual(["heading", "paragraph", "bulletList", "orderedList", "blockquote", "tableBlock"]);
    expect(n.content![0]!.attrs).toEqual({ level: 2 });
    expect(n.content![3]!.attrs).toEqual({ start: 3 });
  });

  it("an empty paragraph the editor leaves behind is not a blank topic body", () => {
    expect(blocksMarkdown([{ type: "paragraph" }, { type: "paragraph", content: [{ type: "text", text: "Hi" }] }, { type: "paragraph" }])).toBe("Hi");
  });
});

describe("marks: what a teacher can type survives the reader", () => {
  const run = (text: string, m: Partial<Run> = {}): Run => ({ text, bold: false, italic: false, code: false, ...m });
  const cases: Array<[string, Run[]]> = [
    ["plain", [run("just words")]],
    ["bold", [run("a "), run("bold", { bold: true }), run(" word")]],
    ["italic", [run("an "), run("italic", { italic: true }), run(" word")]],
    ["code", [run("the "), run("MOV", { code: true }), run(" opcode")]],
    ["bold and italic", [run("both", { bold: true, italic: true })]],
    ["code inside bold", [run("x ", { bold: true }), run("y", { bold: true, code: true }), run(" z", { bold: true })]],
    ["marked text with its edge spaces", [run("a"), run(" spaced ", { bold: true }), run("b")]],
    ["adjacent runs with different marks", [run("a", { bold: true }), run("b", { italic: true })]],
  ];
  for (const [name, runs] of cases) {
    it(`${name}: the same words with the same marks after the reader parses them`, () => {
      const md = runsToMarkdown(runs);
      expect(runsOfMarkdown(md), md).toEqual(normalizeRuns(runs));
      expect(inlineRoundTrips(runs)).toBe(true);
    });
  }

  it("marks survive being typed into a whole topic and read back", () => {
    const doc: PMNode = {
      type: "doc",
      content: [{
        type: "topic", attrs: { id: null, kind: "prose", meta: {} },
        content: [{
          type: "paragraph",
          content: [
            { type: "text", text: "Typed " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "both", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: "." },
          ],
        }],
      }],
    };
    const [t] = docToTopics(doc);
    expect(t!.body).toBe("Typed **bold** and **_both_**.");
    expect(runsFromPM(topicNode(t!).content![0]!.content!)).toEqual(runsOfMarkdown(t!.body).map((r) => ({ ...r })));
  });
});

describe("collisions: text this dialect cannot hold is said, not saved wrongly", () => {
  /** What a teacher has typed: plain text in a paragraph, as the editor holds it. */
  const doc = (text: string): PMNode => ({
    type: "doc",
    content: [{ type: "topic", attrs: { id: null, kind: "prose", meta: {} }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] }],
  });

  it("an asterisk pair typed as plain text would be read as italics, so it is flagged", () => {
    expect(docCollisions(doc("a*b*c"))).not.toEqual([]);
  });

  it("a backtick pair, and a paragraph that begins like a list, are flagged", () => {
    expect(docCollisions(doc("use `mov` here"))).not.toEqual([]);
    expect(docCollisions(doc("- not a list"))).not.toEqual([]);
    expect(docCollisions(doc("1. not a list either"))).not.toEqual([]);
    expect(docCollisions(doc("## not a heading"))).not.toEqual([]);
  });

  it("ordinary text, numbers, snake_case and a lone asterisk are not", () => {
    for (const s of ["A plain sentence.", "8.33 MHz and 1,000 bytes", "stage_progress stays one word", "2 * 3 = 6", "a - b"]) {
      expect(docCollisions(doc(s)), s).toEqual([]);
    }
  });

  it("a bold paragraph that begins with a number is fine: its line starts with **, not a list", () => {
    const d: PMNode = {
      type: "doc",
      content: [{ type: "topic", attrs: { id: null, kind: "prose", meta: {} }, content: [{ type: "paragraph", content: [{ type: "text", text: "1. The operation code.", marks: [{ type: "bold" }] }] }] }],
    };
    expect(docCollisions(d)).toEqual([]);
  });

  it("a locked topic and a listing are never flagged (their text is not markup)", () => {
    expect(collisions({ id: null, kind: "code", body: "a*b*c `x`", meta: {} })).toEqual([]);
    expect(collisions({ id: null, kind: "quote", body: "a*b*c", meta: { source: "x" } })).toEqual([]);
  });
});

describe("what Publish would change", async () => {
  const { diffTopics, topicTitle } = await import("../src/lib/editor-doc");
  const t = (id: string, body: string, kind: TopicKind = "prose"): Topic => ({ id, kind, body, meta: {} });
  const live = [t("a", "A"), t("b", "B"), t("c", "C"), t("d", "D")];

  it("nothing changed is nothing", () => {
    const d = diffTopics(live, live);
    expect([d.added, d.removed, d.edited, d.moved].map((x) => x.length)).toEqual([0, 0, 0, 0]);
  });

  it("counts a topic added, one removed, one edited and one only moved, by id", () => {
    const draft = [t("c", "C"), t("a", "A, tightened"), t("n", "New"), t("d", "D")]; // b removed
    const d = diffTopics(live, draft);
    expect(d.added.map((x) => x.id)).toEqual(["n"]);
    expect(d.removed.map((x) => x.id)).toEqual(["b"]);
    expect(d.edited.map((x) => x.now.id)).toEqual(["a"]);
    expect(d.moved.map((x) => x.id)).toEqual(["c"]);
  });

  it("a drafted chapter with no ids replaces everything: all added, all removed", () => {
    const d = diffTopics(live, [{ id: "x", kind: "prose", body: "Drafted", meta: {} }]);
    expect([d.added.length, d.removed.length]).toEqual([1, 4]);
  });

  it("titles a topic by its first line", () => {
    expect(topicTitle(t("a", "## A heading\n\nBody"))).toBe("A heading");
    expect(topicTitle(t("a", "- first item\n- second"))).toBe("first item");
    expect(topicTitle(t("a", "", "code"))).toBe("A code listing");
    expect(topicTitle(t("a", "x".repeat(100)), 10)).toBe("xxxxxxxxxx…");
  });
});
