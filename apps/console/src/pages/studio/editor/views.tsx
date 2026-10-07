import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps, type ReactNodeViewRendererOptions } from "@tiptap/react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { parseBlocks } from "@/lib/reader-markdown";
import type { ContentFigure } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Md, Shape } from "../../content/Preview";
import { deleteTopic, insertTopic, moveTopic, topicCount } from "./commands";

/**
 * How each kind of topic looks in the editor, and its gutter (docs/STUDIO-EDITOR-PLAN.md,
 * E1.3). A topic is a block of the chapter, drawn the way the student reader draws
 * it, with a small label and four controls that show only on the topic being
 * edited or hovered: move up, move down, delete, add one below. Reordering by
 * keyboard is Alt+Up and Alt+Down, and the same actions are on the toolbar.
 */

const LABEL: Record<string, string> = {
  prose: "Text",
  brief: "Opening brief",
  callout: "Callout",
  code: "Code listing",
  quote: "Quote from the book",
  figure: "Figure",
};

function labelOf(kind: string, meta: Record<string, string>): string {
  if (kind === "callout" && (meta.kind === "planned" || meta.kind === "scaffold")) return "Coming-soon note";
  return LABEL[kind] ?? kind;
}

type Decos = ReadonlyArray<object>;
const classOf = (d: object) => String((d as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs?.class ?? "");

/** What a topic's decorations say, as one string: two renders with the same key look the same. */
export const decorationKey = (ds: Decos) => ds.map(classOf).join("|");

/**
 * Whether the cursor is in this topic. The ActiveTopic plugin marks it with a node decoration, but a
 * React node view answers its own `update`, so ProseMirror never paints that class on the wrapper:
 * the view reads the decoration and sets the class itself (and `refreshOnDecoration`, below, makes
 * TipTap re-render it when the decoration changes, which it does not when the node itself is unchanged).
 */
function activeClass(props: NodeViewProps): string {
  return props.decorations.some((d) => classOf(d).split(" ").includes("is-active")) ? " is-active" : "";
}

/** The `update` option for every topic view: re-render when the node or what is drawn over it changed. */
export const refreshOnDecoration: NonNullable<ReactNodeViewRendererOptions["update"]> = ({ oldNode, newNode, oldDecorations, newDecorations, updateProps }) => {
  if (oldNode !== newNode || decorationKey(oldDecorations) !== decorationKey(newDecorations)) updateProps();
  return true;
};

function Gutter({ props, locked, extra }: { props: NodeViewProps; locked?: boolean; extra?: string | undefined }) {
  const { editor, node, getPos } = props;
  const pos = () => (typeof getPos === "function" ? getPos() : undefined);
  const act = (f: (p: number) => void) => () => {
    const p = pos();
    if (p !== undefined) f(p);
  };
  const kind = String(node.attrs.kind ?? "prose");
  const meta = (node.attrs.meta ?? {}) as Record<string, string>;
  return (
    <div className="ed-gutter" contentEditable={false}>
      <span className="ed-label">
        {locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
        {labelOf(kind, meta)}
        {extra ? <span className="ed-label-extra">{extra}</span> : null}
      </span>
      <span className="ed-controls" role="group" aria-label="This topic">
        <Button type="button" size="sm" variant="ghost" className="ed-ctl" aria-label="Move this topic up" title="Move up (Alt+Up)" onClick={act((p) => moveTopic(editor, p, -1))}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ed-ctl" aria-label="Move this topic down" title="Move down (Alt+Down)" onClick={act((p) => moveTopic(editor, p, 1))}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ed-ctl" aria-label="Add a topic below this one" title="Add a topic below" onClick={act((p) => insertTopic(editor, p, "prose"))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ed-ctl" aria-label="Delete this topic" title="Delete this topic"
                disabled={topicCount(editor) <= 1} onClick={act((p) => deleteTopic(editor, p))}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </span>
    </div>
  );
}

/** Text, a brief or a callout: you type in it. */
export function TopicView(props: NodeViewProps) {
  const kind = String(props.node.attrs.kind ?? "prose");
  return (
    <NodeViewWrapper className={`ed-topic${activeClass(props)}`} data-topic-kind={kind} data-topic-id={String(props.node.attrs.id ?? "")}>
      <Gutter props={props} />
      <div className={`ed-body ed-kind-${kind}`}>
        <NodeViewContent className="ed-content" />
      </div>
    </NodeViewWrapper>
  );
}

/** A code listing: plain text in mono, nothing else. */
export function CodeTopicView(props: NodeViewProps) {
  return (
    <NodeViewWrapper className={`ed-topic${activeClass(props)}`} data-topic-kind="code" data-topic-id={String(props.node.attrs.id ?? "")}>
      <Gutter props={props} />
      <pre className="ed-body ed-kind-code mono">
        <NodeViewContent className="ed-content" />
      </pre>
    </NodeViewWrapper>
  );
}

/** A quote from the book or a figure: shown as a student sees it, and locked. */
export function LockedTopicView(props: NodeViewProps) {
  const { node, editor, selected } = props;
  const kind = String(node.attrs.kind);
  const meta = (node.attrs.meta ?? {}) as Record<string, string>;
  const figures = (editor.storage as { studio?: { figures: ReadonlyMap<string, ContentFigure> } }).studio?.figures ?? new Map();
  const why =
    kind === "quote"
      ? `from ${meta.source ?? "the book"}, checked word for word. Move it or delete it; edit it in content/stages.`
      : "drawn for the course and approved on its own. Move it or delete it.";
  return (
    <NodeViewWrapper className={`ed-topic ed-locked${selected ? " is-selected" : ""}${activeClass(props)}`} data-topic-kind={kind} data-topic-id={String(node.attrs.id ?? "")}>
      <Gutter props={props} locked extra={kind === "quote" && meta.source ? meta.source : undefined} />
      <div className="ed-body ed-kind-locked" contentEditable={false}>
        <Shape kind={kind} meta={meta} body={String(node.attrs.body ?? "")} figures={figures} />
        <p className="ed-locked-note">Locked: {why}</p>
      </div>
    </NodeViewWrapper>
  );
}

/** A table: drawn as the reader draws it; edited as text, so the editor never rewrites it. */
export function TableBlockView(props: NodeViewProps) {
  const { node, updateAttributes } = props;
  const md = String(node.attrs.md ?? "");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(md);
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const parsed = parseBlocks(text);
    if (parsed.length !== 1 || parsed[0]!.t !== "table") {
      setError("That is not one table. Each row starts with | and the second row is | --- | --- |.");
      return;
    }
    updateAttributes({ md: text.trim() });
    setError(null);
    setEditing(false);
  }

  return (
    <NodeViewWrapper className="ed-table" contentEditable={false}>
      {editing ? (
        <div className="ed-table-edit">
          <label className="ct-faint" htmlFor={`tbl-${String(props.node.attrs.md).length}`}>Table, as text</label>
          <textarea
            id={`tbl-${String(props.node.attrs.md).length}`}
            className="ed-table-text mono"
            rows={Math.max(4, text.split("\n").length + 1)}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error ? <p role="alert" className="ed-table-error">{error}</p> : null}
          <span className="ed-table-actions">
            <Button type="button" size="sm" onClick={apply}>Use this table</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setText(md); setError(null); setEditing(false); }}>Cancel</Button>
          </span>
        </div>
      ) : (
        <>
          <Md blocks={parseBlocks(md)} />
          <Button type="button" size="sm" variant="outline" className="ed-table-open" onClick={() => { setText(md); setEditing(true); }}>
            Edit table as text
          </Button>
        </>
      )}
    </NodeViewWrapper>
  );
}
