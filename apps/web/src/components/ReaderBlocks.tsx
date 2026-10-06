import type { CSSProperties } from "react";
import type { ContentBlock } from "../lib/api";
import { encounterFor } from "../lib/encounters";
import { longestLine, numberBlocks, sourceLabel, type Inline, type Numbered } from "../lib/markdown";
import { FigureDrawing } from "./FigureDrawing";

/**
 * The reading's blocks, rendered, never edited (hard rule 5).
 *
 * `design/templates/web/stage/SPEC.md` "Rendering the blocks" is the table this
 * follows. In OCTA monospace means "this is what the machine sees": figures,
 * inline code and every number are mono; a sentence never is.
 */

/** Anchor ids for the rail: the brief, each `##` in order, the check. */
export const sectionId = (i: number): string => `rd-s-${i}`;

export function InlineText({ c }: { c: Inline[] }): JSX.Element {
  return (
    <>
      {c.map((n, i) => {
        switch (n.t) {
          case "text":
            return <span key={i}>{n.v}</span>;
          case "num":
            return (
              <span key={i} className="mono rd-num" data-num="">
                {n.v}
              </span>
            );
          case "code":
            return (
              <code key={i} className="mono rd-code">
                {n.v}
              </code>
            );
          case "strong":
            return (
              <strong key={i}>
                <InlineText c={n.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineText c={n.c} />
              </em>
            );
        }
      })}
    </>
  );
}

/** One parsed block. Its section number was assigned before render (`number`). */
function Md({ b }: { b: Numbered }): JSX.Element {
  switch (b.t) {
    case "h": {
      if (b.level === 2 && b.section !== undefined) {
        return (
          <h2 id={sectionId(b.section)} className="rd-h2" tabIndex={-1}>
            <InlineText c={b.c} />
          </h2>
        );
      }
      return b.level === 3 ? (
        <h3 className="rd-h3">
          <InlineText c={b.c} />
        </h3>
      ) : (
        <h4 className="rd-h4">
          <InlineText c={b.c} />
        </h4>
      );
    }
    case "p":
      return (
        <p>
          <InlineText c={b.c} />
        </p>
      );
    case "list": {
      const items = b.items.map((item, i) => (
        <li key={i}>
          <InlineText c={item} />
        </li>
      ));
      return b.ordered ? (
        <ol className="rd-list" start={b.start}>
          {items}
        </ol>
      ) : (
        <ul className="rd-list">{items}</ul>
      );
    }
    case "quote":
      return (
        <blockquote className="rd-inset-quote">
          {b.c.map((x, i) => (
            <Md key={i} b={x} />
          ))}
        </blockquote>
      );
    case "table":
      return (
        <div className="rd-table-wrap">
          <table className="rd-table">
            {b.head && (
              <thead>
                <tr>
                  {b.head.map((c, i) => (
                    <th key={i} scope="col">
                      <InlineText c={c} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) =>
                    // A row's first cell names the row when the table has a header.
                    j === 0 && b.head ? (
                      <th key={j} scope="row">
                        <InlineText c={c} />
                      </th>
                    ) : (
                      <td key={j}>
                        <InlineText c={c} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function Body({ parsed }: { parsed: Numbered[] }): JSX.Element {
  return (
    <>
      {parsed.map((b, i) => (
        <Md key={i} b={b} />
      ))}
    </>
  );
}

function OneBlock({
  block,
  parsed,
  stageId,
  index,
}: {
  block: ContentBlock;
  parsed: Numbered[];
  stageId: string;
  /** Its place in the reading, for the audiobook's highlight (lib/listen.ts). */
  index: number;
}): JSX.Element {
  const { kind, body, meta } = block;

  if (kind === "code") {
    /*
     * Verbatim, and never sideways. The longest line sets the figure's own
     * mono size at narrow widths (SPEC "Figures verbatim"): `--cols` is read by
     * a container-query calc in the CSS, so nothing is measured in script.
     */
    return (
      <figure className="rd-figure" data-block={index} style={{ ["--cols" as string]: String(longestLine(body)) } as CSSProperties}>
        <pre className="mono">
          <code>{body}</code>
        </pre>
        {meta.caption && <figcaption>{meta.caption}</figcaption>}
      </figure>
    );
  }

  if (kind === "figure") {
    // A figure drawn for the course from the book's (6 Oct 2026). The API
    // sends only an approved drawing, and leaves an unapproved one out whole.
    if (!block.figure) return <></>;
    return (
      <figure className="rd-fig" data-block={index} data-figure={block.figure.id ?? meta.id}>
        <div className="rd-fig-frame">
          <FigureDrawing svg={block.figure.svg} title={block.figure.title} />
        </div>
        <figcaption>
          <Body parsed={parsed} />
          {meta.after && (
            <p className="rd-fig-credit">
              After Stallings, Figure <span className="mono">{meta.after}</span>, redrawn for this course
            </p>
          )}
        </figcaption>
      </figure>
    );
  }

  if (kind === "quote") {
    return (
      <figure className="rd-quote" data-block={index}>
        <blockquote>
          <Body parsed={parsed} />
        </blockquote>
        {meta.source && <figcaption>{sourceLabel(meta.source)}</figcaption>}
      </figure>
    );
  }

  if (kind === "brief") {
    return (
      <div className="rd-brief" data-block={index}>
        <Body parsed={parsed} />
      </div>
    );
  }

  if (kind === "callout") {
    // A PLANNED chapter says so in its own voice, so an unfinished chapter
    // never reads as a finished one.
    if (meta.kind === "planned" || meta.kind === "scaffold") {
      return (
        <aside className="rd-callout rd-planned" role="note" data-block={index}>
          <p className="rd-tag">Coming in a later update</p>
          <Body parsed={parsed} />
        </aside>
      );
    }
    return (
      <aside className="rd-callout" data-block={index} data-kind={meta.kind ?? undefined}>
        <Body parsed={parsed} />
      </aside>
    );
  }

  if (kind === "lab") {
    // A LAB beat wears the stage's encounter theme: four tokens and a panel
    // skin, never a redesign. No lab block exists yet; the path is kept.
    return (
      <div data-encounter={encounterFor(stageId)} className="encounter" data-block={index}>
        <Body parsed={parsed} />
      </div>
    );
  }

  return (
    <div className="rd-prose" data-block={index}>
      <Body parsed={parsed} />
    </div>
  );
}

/** Every block, in order; the brief carries section 0's anchor. */
export function ReaderBlocks({ blocks, stageId }: { blocks: ContentBlock[]; stageId: string }): JSX.Element {
  const parsed = numberBlocks(blocks);
  let briefSeen = false;
  return (
    <>
      {blocks.map((b, bi) => {
        const el = <OneBlock key={b.ordinal} block={b} parsed={parsed[bi]!} stageId={stageId} index={bi} />;
        if (b.kind === "brief" && !briefSeen) {
          briefSeen = true;
          return (
            <div key={b.ordinal} id={sectionId(0)} className="rd-anchor" tabIndex={-1}>
              {el}
            </div>
          );
        }
        return el;
      })}
    </>
  );
}
