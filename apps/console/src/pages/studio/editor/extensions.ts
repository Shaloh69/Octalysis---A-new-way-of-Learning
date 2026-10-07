import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Code } from "@tiptap/extension-code";
import { ListItem } from "@tiptap/extension-list";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ContentFigure } from "@/lib/api";
import { currentTopicPos, moveTopic } from "./commands";
import { CodeTopicView, LockedTopicView, refreshOnDecoration, TableBlockView, TopicView } from "./views";

/**
 * The Studio editor's schema (docs/STUDIO-EDITOR-PLAN.md, E1.3): exactly what the
 * student reader can draw, and nothing it cannot (`lib/editor-doc.ts` is the
 * other half). The document is a stack of TOPICS:
 *
 *   topic        prose, brief or callout: paragraphs, headings 2-4, bullet and
 *                numbered lists (one line an item), quotes, and tables (a table
 *                is edited as text)
 *   codeTopic    a code listing: plain text, no marks
 *   lockedTopic  a quote from the book or a figure: an atom. Moved or deleted,
 *                never typed into
 *
 * No links, images, line breaks, rules, strike-through or underline: the reader
 * draws none of them, so the editor offers none.
 */

/** What the node views need to know about the chapter, set once when the editor opens. */
export const Studio = Extension.create({
  name: "studio",
  addStorage() {
    return { figures: new Map<string, ContentFigure>() as ReadonlyMap<string, ContentFigure> };
  },
});

const idAttrs = {
  id: { default: null },
  meta: { default: {} },
};

export const Doc = Node.create({ name: "doc", topNode: true, content: "(topic | codeTopic | lockedTopic)+" });

export const Topic = Node.create({
  name: "topic",
  content: "(paragraph | heading | bulletList | orderedList | blockquote | tableBlock)+",
  defining: true,
  isolating: true,
  addAttributes() {
    return { ...idAttrs, kind: { default: "prose" } };
  },
  parseHTML: () => [{ tag: "div[data-topic]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-topic": "" }), 0],
  addNodeView: () => ReactNodeViewRenderer(TopicView, { update: refreshOnDecoration }),
});

export const CodeTopic = Node.create({
  name: "codeTopic",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  isolating: true,
  addAttributes() {
    return { ...idAttrs, kind: { default: "code" } };
  },
  parseHTML: () => [{ tag: "pre[data-code-topic]", preserveWhitespace: "full" }],
  renderHTML: ({ HTMLAttributes }) => ["pre", mergeAttributes(HTMLAttributes, { "data-code-topic": "" }), ["code", 0]],
  addNodeView: () => ReactNodeViewRenderer(CodeTopicView, { update: refreshOnDecoration }),
});

export const LockedTopic = Node.create({
  name: "lockedTopic",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,
  addAttributes() {
    return { ...idAttrs, kind: { default: "quote" }, body: { default: "" } };
  },
  parseHTML: () => [{ tag: "div[data-locked-topic]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-locked-topic": "" })],
  addNodeView: () => ReactNodeViewRenderer(LockedTopicView, { update: refreshOnDecoration }),
});

/** A markdown table the editor does not rewrite: it is shown as the reader draws it and edited as text. */
export const TableBlock = Node.create({
  name: "tableBlock",
  atom: true,
  selectable: true,
  addAttributes() {
    return { md: { default: "" } };
  },
  parseHTML: () => [{ tag: "div[data-table-block]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-table-block": "" })],
  addNodeView: () => ReactNodeViewRenderer(TableBlockView),
});

/**
 * Every topic has one id of its own, always. Splitting a topic (Enter twice) or
 * pasting one would otherwise leave two with the same id, which a save refuses.
 */
const UniqueTopicIds = Extension.create({
  name: "uniqueTopicIds",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("uniqueTopicIds"),
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((t) => t.docChanged)) return null;
          const seen = new Set<string>();
          const tr = state.tr;
          let changed = false;
          state.doc.forEach((node, offset) => {
            const id = node.attrs.id as string | null | undefined;
            if (id === undefined) return;
            if (!id || seen.has(id)) {
              const fresh = crypto.randomUUID();
              tr.setNodeMarkup(offset, undefined, { ...node.attrs, id: fresh });
              seen.add(fresh);
              changed = true;
            } else seen.add(id);
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});

/** Marks the topic the cursor is in, so its gutter controls show (and only its: one set of Tab stops, not forty). */
const ActiveTopic = Extension.create({
  name: "activeTopic",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("activeTopic"),
        props: {
          decorations(state) {
            const pos = currentTopicPos(state);
            const node = pos === null ? null : state.doc.nodeAt(pos);
            return pos === null || !node ? null : DecorationSet.create(state.doc, [Decoration.node(pos, pos + node.nodeSize, { class: "is-active" })]);
          },
        },
      }),
    ];
  },
});

/**
 * A quote from the book is selected by clicking it, and a selected node is REPLACED by whatever is
 * typed or pasted next. A locked topic may be moved or deleted (on purpose, with a control or a key),
 * never overwritten by accident: typing and pasting over it do nothing.
 */
const LockGuard = Extension.create({
  name: "lockGuard",
  addProseMirrorPlugins() {
    const onLocked = (state: { selection: unknown }) => state.selection instanceof NodeSelection && state.selection.node.type.name === "lockedTopic";
    return [
      new Plugin({
        key: new PluginKey("lockGuard"),
        props: {
          handleTextInput: (view) => onLocked(view.state),
          handlePaste: (view) => onLocked(view.state),
        },
      }),
    ];
  },
});

/** Alt+Up and Alt+Down move the topic you are in: the keyboard's way of reordering. */
const TopicKeys = Extension.create({
  name: "topicKeys",
  addKeyboardShortcuts() {
    const move = (dir: -1 | 1) => () => {
      const pos = currentTopicPos(this.editor.state);
      return pos === null ? false : moveTopic(this.editor, pos, dir);
    };
    return { "Alt-ArrowUp": move(-1), "Alt-ArrowDown": move(1) };
  },
});

export const extensions = [
  Doc,
  StarterKit.configure({
    document: false,
    codeBlock: false,
    hardBreak: false,
    horizontalRule: false,
    link: false,
    underline: false,
    strike: false,
    trailingNode: false,
    code: false,
    listItem: false,
    heading: { levels: [2, 3, 4] },
  }),
  // Code may sit inside bold, as the reader allows (`**x `y` z**`).
  Code.extend({ excludes: "" }),
  // A list item is ONE line of inline markup, as the reader reads it.
  ListItem.extend({ content: "paragraph" }),
  Topic,
  CodeTopic,
  LockedTopic,
  TableBlock,
  Studio,
  UniqueTopicIds,
  ActiveTopic,
  LockGuard,
  TopicKeys,
];
