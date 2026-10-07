import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection, type EditorState } from "@tiptap/pm/state";
import type { TopicKind } from "@/lib/editor-doc";

/**
 * What a teacher does to whole TOPICS (docs/STUDIO-EDITOR-PLAN.md, E1.3): move
 * one up or down, delete it, add one. Each is one editor transaction, so Undo
 * takes it back. Every topic is a top-level node of the document, so a topic's
 * position is its index among the document's children.
 */

/** The position of the topic the cursor is in (or that is selected), or null. */
export function currentTopicPos(state: EditorState): number | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.$from.depth === 0) return sel.from;
  return sel.$from.depth >= 1 ? sel.$from.before(1) : null;
}

export function topicCount(editor: Editor): number {
  return editor.state.doc.childCount;
}

/** Swap a topic with its neighbour. Returns whether anything moved. */
export function moveTopic(editor: Editor, pos: number, dir: -1 | 1): boolean {
  const { doc } = editor.state;
  const i = doc.resolve(pos).index(0);
  const j = i + dir;
  if (j < 0 || j >= doc.childCount) return false;
  const node = doc.child(i);
  const other = doc.child(j);
  const tr = editor.state.tr;
  if (dir < 0) {
    let otherStart = 0;
    for (let k = 0; k < j; k++) otherStart += doc.child(k).nodeSize;
    tr.delete(pos, pos + node.nodeSize);
    tr.insert(otherStart, node);
    tr.setSelection(TextSelection.near(tr.doc.resolve(otherStart + 1)));
  } else {
    const at = pos + node.nodeSize + other.nodeSize;
    tr.insert(at, node);
    tr.delete(pos, pos + node.nodeSize);
    tr.setSelection(TextSelection.near(tr.doc.resolve(at - node.nodeSize + 1)));
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Delete a topic. A chapter keeps at least one: the last cannot be deleted. */
export function deleteTopic(editor: Editor, pos: number): boolean {
  const { doc } = editor.state;
  if (doc.childCount <= 1) return false;
  const node = doc.nodeAt(pos);
  if (!node) return false;
  const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
  const near = Math.min(pos, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(near), -1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/**
 * Add a new, empty topic after the one at `afterPos` (or at the end), with an id
 * the moment it exists, and put the cursor in it. A callout carries no meta (a
 * plain callout); a quote or a figure cannot be created here.
 */
export function insertTopic(editor: Editor, afterPos: number | null, kind: Exclude<TopicKind, "quote" | "figure">): void {
  const { schema, doc } = editor.state;
  const id = crypto.randomUUID();
  const node =
    kind === "code"
      ? schema.nodes.codeTopic!.create({ id, kind: "code", meta: {} })
      : schema.nodes.topic!.create({ id, kind, meta: {} }, schema.nodes.paragraph!.create());
  const at = afterPos === null ? doc.content.size : afterPos + (doc.nodeAt(afterPos)?.nodeSize ?? 0);
  const tr = editor.state.tr.insert(at, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(at + (kind === "code" ? 1 : 2))));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}
