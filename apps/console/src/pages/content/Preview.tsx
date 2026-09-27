import { forwardRef } from "react";
import type { ContentBlock } from "@/lib/api";
import { paragraphs, shapeOf, type Segment } from "@/lib/content-view";

/**
 * The chapter as a student reads it: the student reader's own rules
 * (`apps/web/src/components/StageReader.tsx`, `Block` and `Paragraphs`),
 * mirrored in `lib/content-view.ts` and drawn here in the console's tokens.
 * The structure is the reader's (paragraphs, lists, bold, code in mono, the
 * planned-chapter note); the colours are the console's, so this is "what it
 * says and how it is shaped", not a pixel copy of the student theme.
 *
 * The block being edited shows what is typed, as it is typed.
 */

function Segs({ segs }: { segs: Segment[] }) {
  return <>{segs.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}</>;
}

function Paragraphs({ body }: { body: string }) {
  return (
    <>
      {paragraphs(body).map((c, i) =>
        c.type === "list" ? (
          <ul key={i}>{c.items.map((it, j) => <li key={j}><Segs segs={it} /></li>)}</ul>
        ) : (
          <p key={i}><Segs segs={c.segs} /></p>
        ),
      )}
    </>
  );
}

function Shape({ kind, meta, body }: { kind: string; meta: Record<string, string>; body: string }) {
  const shape = shapeOf(kind, meta);
  if (shape === "code") {
    return (
      <figure className="pv-code">
        <pre className="mono"><code>{body}</code></pre>
        {meta.caption ? <figcaption>{meta.caption}</figcaption> : null}
      </figure>
    );
  }
  if (shape === "planned") {
    return (
      <aside className="pv-planned" role="note">
        <p className="pv-planned-tag mono">Coming in a later update</p>
        <Paragraphs body={body} />
      </aside>
    );
  }
  if (shape === "callout") return <aside className="pv-callout"><Paragraphs body={body} /></aside>;
  if (shape === "brief") return <div className="pv-brief"><Paragraphs body={body} /></div>;
  return <div className="pv-prose"><Paragraphs body={body} /></div>;
}

export const Preview = forwardRef<HTMLDivElement, {
  blocks: readonly ContentBlock[];
  editing: { blockId: string; text: string } | null;
  title: string;
}>(function Preview({ blocks, editing, title }, ref) {
  return (
    <section ref={ref} className="ct-card ct-preview" data-preview tabIndex={0} aria-labelledby="pv-title">
      <div className="ct-pane-head">
        <h2 id="pv-title" className="ct-h2">Preview · as a student reads it</h2>
        <p className="ct-faint">{title}</p>
      </div>
      <div className="pv-body">
        {blocks.map((b) => {
          const live = editing?.blockId === b.id;
          return (
            <div
              key={b.id}
              className="pv-block"
              data-preview-block={b.ordinal}
              data-editing={live ? "true" : undefined}
            >
              {live ? <p className="pv-editing-tag">Editing block <span className="num">{b.ordinal}</span>, not saved</p> : null}
              <Shape kind={b.kind} meta={b.meta} body={live ? editing!.text : b.body} />
            </div>
          );
        })}
      </div>
    </section>
  );
});
