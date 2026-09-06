import { BiomeScene } from "../biomes/BiomeScene";
import { useSeededBiome } from "../biomes/useSeededBiome";
import { useEffect, useState } from "react";
import { api, ApiError, type StageDetail } from "../lib/api";
import { encounterFor } from "../lib/encounters";

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
  onStartCheck,
}: {
  stageId: string;
  onBack: () => void;
  onProgressChanged?: () => void;
  /** Opens the attempt runner. Absent on surfaces that cannot sit a check. */
  onStartCheck?: (assessmentId: string, title: string) => void;
}): JSX.Element {
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The seeded landing biome. Read from the <html> attribute rather than
  // re-fetching: AppShell already applied it for every authenticated route.
  //
  // AT THE TOP, before the error and loading returns below. It was originally
  // placed just above the main `return`, which is after two conditional
  // returns -- so the hook ran on some renders and not others and React threw
  // "Rendered more hooks than during the previous render". The stage page was
  // blank, and no test covered it.
  const biome = useSeededBiome();

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
    <article className={`reader${biome ? " app-over-biome" : ""}`}>
      <button type="button" className="reader-back" onClick={onBack}>
        &larr; Map
      </button>

      {/*
        First child and out of the flow — it is the page's background now, not a
        banner above the title (§1b). The reader's own content carries a surface
        so the words never sit directly on the art.
      */}
      <BiomeScene name={biome} />

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
        <>
          <div className="reader-body">
            {stage.blocks.map((b) =>
              /*
               * A LAB block wears the stage's encounter theme; everything else
               * stays in the token system. The wrapper carries `data-encounter`
               * and the CSS does the rest -- four tokens and a panel skin, never
               * a redesign.
               */
              b.kind === "lab" ? (
                <div key={b.ordinal} data-encounter={encounterFor(stage.id)} className="encounter">
                  <Block kind={b.kind} body={b.body} meta={b.meta} />
                </div>
              ) : (
                <Block key={b.ordinal} kind={b.kind} body={b.body} meta={b.meta} />
              ),
            )}
          </div>

          {stage.assessment && onStartCheck && (
            <CheckCard
              assessment={stage.assessment}
              onStart={() => onStartCheck(stage.assessment!.id, stage.assessment!.title)}
            />
          )}
        </>
      )}
    </article>
  );
}

/**
 * The stage check.
 *
 * Sits at the END of the reading, deliberately: a student who has scrolled this
 * far has met the material, and a check button at the top invites guessing at
 * it instead.
 *
 * It states what it costs before it is pressed -- attempts used and remaining --
 * because discovering you had one try after using it is the kind of surprise
 * that is entirely avoidable.
 */
function CheckCard({
  assessment,
  onStart,
}: {
  assessment: NonNullable<StageDetail["assessment"]>;
  onStart: () => void;
}): JSX.Element {
  const left = assessment.attemptsAllowed - assessment.attemptsUsed;
  const closed = assessment.closesAt ? new Date(assessment.closesAt) < new Date() : false;
  const notOpen = assessment.opensAt ? new Date(assessment.opensAt) > new Date() : false;
  const exhausted = left <= 0;

  return (
    <section className="check-card">
      <h2>{assessment.title}</h2>

      <p className="check-meta mono">
        {assessment.attemptsAllowed === 1
          ? "One attempt"
          : `${assessment.attemptsUsed} of ${assessment.attemptsAllowed} attempts used`}
      </p>

      {notOpen && (
        <p className="check-note">
          This opens {new Date(assessment.opensAt!).toLocaleString()}.
        </p>
      )}
      {closed && <p className="check-note">This closed on {new Date(assessment.closesAt!).toLocaleString()}.</p>}
      {exhausted && !closed && (
        <p className="check-note">
          You have used every attempt. Your instructor can grant another.
        </p>
      )}

      <p className="check-blurb">
        Your questions are generated for you — the numbers differ from everyone else&apos;s.
        Answers save as you give them, so a lost connection costs you the current question and
        nothing more.
      </p>

      <button
        type="button"
        className="btn-primary"
        onClick={onStart}
        disabled={notOpen || closed || exhausted}
      >
        {assessment.attemptsUsed > 0 && !exhausted ? "Start another attempt" : "Start the check"}
      </button>
    </section>
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
    /*
     * A PLANNED chapter says so, and says it in its own voice rather than as a
     * warning. Chapters 1-7 are written; 8-18 carry their syllabus objectives
     * and topic outline while the teaching text is authored.
     *
     * It gets its own treatment because the alternative -- an ordinary callout
     * a student skims past -- lets an unfinished chapter read as a finished
     * one, and finding that out halfway through revision is the worst possible
     * moment.
     */
    if (meta.kind === "planned" || meta.kind === "scaffold") {
      return (
        <aside className="block-planned" role="note">
          <p className="block-planned-tag mono">Coming in a later update</p>
          <Paragraphs body={body} />
        </aside>
      );
    }
    return (
      <aside className="block-callout" data-kind={meta.kind ?? undefined}>
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
