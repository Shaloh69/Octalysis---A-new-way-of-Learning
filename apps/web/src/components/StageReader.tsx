import { useEffect, useState } from "react";
import { api, ApiError, type StageDetail } from "../lib/api";

/**
 * The stage reader.
 *
 * Content comes from the database, never from a bundle. That is the single
 * biggest architectural change from the app OCTA replaces, and it is what lets
 * the instructor fix a typo without a redeploy.
 */
export function StageReader({
  stageId,
  onBack,
}: {
  stageId: string;
  onBack: () => void;
  onProgressChanged?: () => void;
}): JSX.Element {
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStage(null);
    setError(null);
    api
      .stage(stageId)
      .then((s) => {
        if (!cancelled) setStage(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "That stage did not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [stageId]);

  if (error) {
    return (
      <div className="state state-error" role="alert">
        <h2>That did not load</h2>
        <p>{error}</p>
        <button type="button" onClick={onBack}>
          Back to the map
        </button>
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="state state-loading" aria-busy="true">
        <span className="sr-only">Loading stage {stageId}</span>
        <div className="skel skel-title" />
        <div className="skel skel-para" />
        <div className="skel skel-para" />
      </div>
    );
  }

  return (
    <article className="reader">
      <button type="button" className="reader-back" onClick={onBack}>
        &larr; Map
      </button>

      <header className="reader-head">
        <p className="reader-eyebrow mono">Stage {stage.id}</p>
        <h1>{stage.title}</h1>
        <p className="reader-meta">
          {stage.estMinutes} minutes
          {stage.levels.length > 0 && (
            <>
              {" · "}
              <span className="mono">
                {stage.levels.map((l) => `L${l}`).join(" ")}
              </span>
            </>
          )}
        </p>
      </header>

      {stage.objectives.length > 0 && (
        <section className="reader-objectives">
          <h2>What you should be able to do</h2>
          <ul>
            {stage.objectives.map((o) => (
              <li key={o.id}>
                <span className="mono obj-id">{o.id}</span> {o.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stage.locked ? (
        <LockedNotice stageId={stage.id} />
      ) : (
        <div className="reader-body">
          {stage.blocks.map((b) => (
            <Block key={b.ordinal} kind={b.kind} body={b.body} meta={b.meta} />
          ))}
        </div>
      )}
    </article>
  );
}

function LockedNotice({ stageId }: { stageId: string }): JSX.Element {
  return (
    <section className="state state-locked">
      <h2>Not open yet</h2>
      <p>
        You can see what this stage covers -- the objectives above are the whole list -- but the
        material opens once the stages it depends on reach 70%.
      </p>
      <p className="dim">
        Your instructor can open Stage {stageId} for you at any time.
      </p>
    </section>
  );
}

/**
 * Content blocks.
 *
 * Every listing, register value and number renders in mono. In OCTA monospace
 * means "this is what the machine sees", and that consistency IS the design.
 */
function Block({
  kind,
  body,
  meta,
}: {
  kind: string;
  body: string;
  meta: Record<string, string>;
}): JSX.Element {
  if (kind === "code") {
    return (
      <figure className="block-code">
        <pre className="mono">
          <code>{body}</code>
        </pre>
        {meta.caption && <figcaption>{meta.caption}</figcaption>}
      </figure>
    );
  }

  if (kind === "callout") {
    return (
      <aside className="block-callout">
        <Paragraphs body={body} />
      </aside>
    );
  }

  if (kind === "brief") {
    return (
      <p className="block-brief">
        <Paragraphs body={body} />
      </p>
    );
  }

  return (
    <div className="block-prose">
      <Paragraphs body={body} />
    </div>
  );
}

/**
 * Minimal inline rendering: paragraphs, list items, and bold. Deliberately not
 * a markdown library -- the content is authored in this repo and reviewed in
 * git, so the input is trusted and the surface should stay small.
 */
function Paragraphs({ body }: { body: string }): JSX.Element {
  const chunks = body.split(/\n\s*\n/);
  return (
    <>
      {chunks.map((chunk, i) => {
        const lines = chunk.split(/\n/).map((l) => l.trim());
        const isList = lines.every((l) => l === "" || /^[-*]\s+/.test(l));
        if (isList && lines.some((l) => l !== "")) {
          return (
            <ul key={i}>
              {lines
                .filter((l) => l !== "")
                .map((l, j) => (
                  <li key={j}>{bold(l.replace(/^[-*]\s+/, ""))}</li>
                ))}
            </ul>
          );
        }
        return <p key={i}>{bold(chunk.replace(/\n/g, " "))}</p>;
      })}
    </>
  );
}

function bold(text: string): (string | JSX.Element)[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}
