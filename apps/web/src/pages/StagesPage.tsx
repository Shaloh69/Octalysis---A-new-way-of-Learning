import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { StageNode } from "../lib/api";
import { nextStage } from "../lib/next-stage";
import { useDelayed } from "../lib/useDelayed";
import { useCosmetics } from "../solar-system/cosmetic-seed";
import { NumberedTitle } from "../shell/MissionPanel";
import { useShellData } from "../shell/ShellData";
import { ACTS, BodyPanel, LockGlyph, STATE_WORD, useWide } from "../map/body";
import { useSelection } from "../map/useSelection";

/**
 * `/app/stages`: every stage, No Man's Sky's discoveries screen
 * (`design/templates/web/stages/template.png`, WEB-REMAKE.md §8 row 6).
 *
 *   STAR SYSTEMS   the four grading periods as systems, each stage a planet
 *                  row under its system: number, title, state in words, and
 *                  a locked stage's reason PRINTED on its row, always
 *                  (SOLAR-SYSTEM-SPEC.md §1.4b: this list never withholds)
 *   THE CARD       the chosen stage, the same BODY card the map shows
 *                  (map/body.tsx): mastery, stats, lock, summary, moons, and
 *                  Enter journey / Show Stage NN / Show on the map
 *
 * The rows are one radio group, the map's accessible pattern: one Tab stop,
 * arrow keys walk the syllabus in order, and choosing is the same act as a
 * click. The choice is `?stage=NN`, shared with the map, so Show on the map
 * opens the same planet there. With nothing chosen the card shows the stage
 * `lib/next-stage.ts` names. Under 900px the card opens under its row.
 */
export function StagesPage(): JSX.Element {
  const { map, error, reload } = useShellData();
  const loading = !map && !error;
  const skeleton = useDelayed(loading, 400);
  const slow = useDelayed(loading, 3000);

  if (error) {
    return (
      <section className="stages" data-stages="error" aria-labelledby="stages-title">
        <div className="hud-panel stages-state">
          <h1 id="stages-title" className="hud-caption">
            Stages
          </h1>
          <div className="stages-state-body">
            <p role="alert">{error}</p>
            <button type="button" className="button hud-button button-primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }
  if (!map) {
    if (!skeleton) return <section className="stages" data-stages="loading" aria-busy="true" />;
    return (
      <section className="stages" data-stages="loading" aria-busy="true" aria-labelledby="stages-title">
        <h1 id="stages-title" className="stages-title">
          Stages
        </h1>
        {slow && <p className="stages-slow">Still loading your stages. The server may be waking up, which can take up to a minute.</p>}
        <div className="stages-body" data-skeleton="">
          <div className="hud-panel stages-list">
            <p className="hud-caption">Star systems</p>
            <div className="stages-skel">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="stages-skel-row" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  return <Stages nodes={map.nodes} />;
}

function Stages({ nodes: raw }: { nodes: StageNode[] }): JSX.Element {
  const { cosmetics } = useCosmetics();
  const { selected, open } = useSelection();
  const wide = useWide(900);

  const nodes = useMemo(() => [...raw].sort((a, b) => a.ordinal - b.ordinal), [raw]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const acts = [...new Set(nodes.map((n) => n.act))];
  const next = nextStage(nodes);
  const nextId = next.kind === "resume" || next.kind === "start" ? next.node.id : null;
  const chosen = (selected && byId.get(selected)) || (nextId && byId.get(nextId)) || nodes[0] || null;

  const mastered = nodes.filter((n) => n.state === "mastered").length;
  const graded = nodes.filter((n) => n.gradeable);
  const survey = graded.length ? Math.round((graded.reduce((s, n) => s + n.mastery, 0) / graded.length) * 100) : 0;
  const biomeOf = (id: string) => cosmetics.planetBiomes[id] ?? "neutral";

  const card = chosen && (
    <section
      className={`hud-panel stages-card${wide ? "" : " is-inline"}`}
      data-card={chosen.id}
      aria-labelledby="stages-card-title"
    >
      <header className="stages-card-head">
        <span className="stages-card-dot" style={{ ["--tint" as string]: `var(--biome-planet-${biomeOf(chosen.id)})` }} aria-hidden="true" />
        <div>
          <h2 id="stages-card-title">{chosen.title}</h2>
          <p className="stages-card-sub">
            <NumberedTitle text={`Stage ${chosen.id} · ${ACTS[chosen.act]?.name ?? `Act ${chosen.act}`}`} />
          </p>
        </div>
      </header>
      <BodyPanel
        node={chosen}
        byId={byId}
        onShow={open}
        enterTo={chosen.state !== "locked" ? `/app/stage/${chosen.id}` : null}
        extra={
          <Link className="button hud-button" to={`/app?stage=${chosen.id}`}>
            Show on the map
          </Link>
        }
      />
    </section>
  );

  return (
    <section className="stages" data-stages="" aria-labelledby="stages-title">
      <header className="stages-head">
        <h1 id="stages-title" className="stages-title">
          Stages
        </h1>
        <p className="stages-sum">
          <span className="mono">{mastered}</span> of <span className="mono">{nodes.length}</span> mastered
          <span className="stages-sum-sep" aria-hidden="true">
            ·
          </span>
          course mastery <span className="mono">{survey}%</span>
        </p>
        <span className="starmap-meter stages-meter" aria-hidden="true">
          <span style={{ width: `${survey}%` }} />
        </span>
      </header>

      <div className="stages-body">
        <section className="hud-panel stages-list" aria-labelledby="stages-list-title">
          <h2 id="stages-list-title" className="hud-caption">
            Star systems
          </h2>
          <fieldset className="stages-systems">
            <legend className="sr-only">Every stage, grouped by grading period. Choose one to see it.</legend>
            {acts.map((act) => {
              const group = nodes.filter((n) => n.act === act);
              const done = group.filter((n) => n.state === "mastered").length;
              return (
                <div key={act} className="stages-system" role="group" aria-labelledby={`stages-act-${act}`}>
                  <p className="stages-system-head" id={`stages-act-${act}`}>
                    <span className="stages-system-mark" aria-hidden="true" />
                    <span className="stages-system-name">
                      System · {ACTS[act]?.name ?? `Act ${act}`}
                    </span>
                    <span className="stages-system-range mono">
                      {group[0]?.id}–{group[group.length - 1]?.id}
                    </span>
                    <span className="stages-system-count">
                      <span className="mono">{done}</span> of <span className="mono">{group.length}</span> mastered
                    </span>
                  </p>
                  {group.map((n) => (
                    <div key={n.id} className="stages-row">
                      <label
                        className={`stages-planet${n.id === nextId ? " is-next" : ""}`}
                        data-state={n.state}
                        data-stage-row={n.id}
                      >
                        <input
                          type="radio"
                          name="stage"
                          className="sr-only"
                          checked={chosen?.id === n.id}
                          onChange={() => open(n.id)}
                        />
                        <span
                          className="stages-planet-dot"
                          style={{ ["--tint" as string]: `var(--biome-planet-${biomeOf(n.id)})` }}
                          aria-hidden="true"
                        />
                        <span className="stages-planet-id mono">{n.id}</span>
                        <span className="stages-planet-title" data-stage-title="">
                          {n.title}
                        </span>
                        <span className="stages-planet-state">
                          {n.state === "locked" && <LockGlyph />}
                          {STATE_WORD[n.state]}
                          {n.state === "in_progress" && <span className="mono"> {Math.round(n.mastery * 100)}%</span>}
                          {n.id === nextId && <span className="stages-planet-next">Next</span>}
                        </span>
                        {n.state === "locked" && n.lockReason && (
                          <span className="stages-planet-lock">{n.lockReason.message}</span>
                        )}
                      </label>
                      {!wide && chosen?.id === n.id && card}
                    </div>
                  ))}
                </div>
              );
            })}
          </fieldset>
        </section>

        {wide && card}
      </div>
    </section>
  );
}
