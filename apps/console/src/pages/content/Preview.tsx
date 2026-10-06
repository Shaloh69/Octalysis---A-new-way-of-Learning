import { forwardRef } from "react";
import type { ContentBlock, ContentFigure } from "@/lib/api";
import { FigureDrawing } from "@/components/FigureDrawing";
import { shapeOf } from "@/lib/content-view";
import { parseBlocks, type Block as MdBlock, type Inline } from "@/lib/reader-markdown";

/**
 * The chapter as a student reads it: the student reader's own markdown
 * (`lib/reader-markdown.ts`, a copy of `apps/web/src/lib/markdown.ts` held
 * to it by `test/reader-markdown.spec.ts`), drawn here in the console's tokens.
 * The structure is the reader's (paragraphs, lists, bold, code in mono, the
 * planned-chapter note); the colours are the console's, so this is "what it
 * says and how it is shaped", not a pixel copy of the student theme.
 *
 * The block being edited shows what is typed, as it is typed.
 */

/** Inline runs, as the reader draws them: numbers and code in mono, bold, italics. */
function Inl({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((n, i) =>
        n.t === "text" ? <span key={i}>{n.v}</span>
          : n.t === "num" ? <span key={i} className="num">{n.v}</span>
            : n.t === "code" ? <code key={i} className="mono">{n.v}</code>
              : n.t === "strong" ? <strong key={i}><Inl c={n.c} /></strong>
                : <em key={i}><Inl c={n.c} /></em>,
      )}
    </>
  );
}

/** One parsed block of markdown. A `##` is an h3 here: the preview pane is under an h2. */
function Md({ blocks }: { blocks: MdBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === "h") {
          const H = b.level === 2 ? "h3" : b.level === 3 ? "h4" : "h5";
          return <H key={i} className={`pv-h pv-h${b.level}`}><Inl c={b.c} /></H>;
        }
        if (b.t === "p") return <p key={i}><Inl c={b.c} /></p>;
        if (b.t === "list") {
          const items = b.items.map((it, j) => <li key={j}><Inl c={it} /></li>);
          return b.ordered ? <ol key={i} start={b.start}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        if (b.t === "quote") return <blockquote key={i} className="pv-quote"><Md blocks={b.c} /></blockquote>;
        return (
          <div key={i} className="pv-table">
            <table>
              {b.head ? (
                <thead><tr>{b.head.map((h, j) => <th key={j} scope="col"><Inl c={h} /></th>)}</tr></thead>
              ) : null}
              <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Inl c={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function Paragraphs({ body }: { body: string }) {
  return <Md blocks={parseBlocks(body)} />;
}

function Shape({ kind, meta, body, figures }: {
  kind: string;
  meta: Record<string, string>;
  body: string;
  figures: ReadonlyMap<string, ContentFigure>;
}) {
  if (kind === "figure") {
    // The drawing under review, so the preview shows what approving would
    // serve. A student sees it only once it is approved (the Figures card).
    const f = meta.id ? figures.get(meta.id) : undefined;
    return (
      <figure className="pv-figure" data-preview-figure={meta.id}>
        {f ? <FigureDrawing svg={f.svg} title={f.title} /> : (
          <p className="pv-figure-missing" role="note">Figure <span className="mono">{meta.id ?? "?"}</span> is not drawn yet.</p>
        )}
        <figcaption>
          <Paragraphs body={body} />
          {meta.after ? <p className="pv-figure-credit">After Stallings, Figure <span className="num">{meta.after}</span>. Redrawn for this course.</p> : null}
        </figcaption>
        {f && f.status !== "approved" ? <p className="pv-figure-state">Not approved yet: students do not see this figure.</p> : null}
      </figure>
    );
  }
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

const NO_FIGURES: ReadonlyMap<string, ContentFigure> = new Map();

export const Preview = forwardRef<HTMLDivElement, {
  blocks: readonly ContentBlock[];
  editing: { blockId: string; text: string } | null;
  title: string;
  /** A second preview on the page (a drafted chapter's) needs its own heading. */
  headingId?: string;
  heading?: string;
  /** The chapter's figures by id, drawn where a figure block names one. */
  figures?: ReadonlyMap<string, ContentFigure> | undefined;
}>(function Preview({ blocks, editing, title, headingId = "pv-title", heading = "Preview · as a student reads it", figures = NO_FIGURES }, ref) {
  return (
    <section ref={ref} className="ct-card ct-preview" data-preview tabIndex={0} aria-labelledby={headingId}>
      <div className="ct-pane-head">
        <h2 id={headingId} className="ct-h2">{heading}</h2>
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
              <Shape kind={b.kind} meta={b.meta} body={live ? editing!.text : b.body} figures={figures} />
            </div>
          );
        })}
      </div>
    </section>
  );
});
