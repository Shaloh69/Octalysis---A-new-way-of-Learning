import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type StageMapData, type StageNode } from "../lib/api";
import { parseInline } from "../lib/markdown";
import { nextStage } from "../lib/next-stage";
import { useDelayed } from "../lib/useDelayed";
import { useFlatWarp } from "../solar-system/Warp";
import { FlatMap, useMapSelection } from "../components/FlatMap";
import { InlineText } from "../components/ReaderBlocks";
import { readPosition } from "../components/StageReader";

/**
 * `/app/map`: the flat map, as a page a student chooses.
 *
 * Rebuilt 29 Sep 2026 against `design/templates/web/map/` (SPEC.md there). The
 * head, the "what next" card and the page's own states live here; the map and
 * its panel are `FlatMap`, which `/app` also mounts when its ladder drops the
 * canvas (instructor ruling of that day: one flat presentation).
 *
 * The route stands on its own token ground (`--surface-0`), because `--bg` is
 * defined nowhere (NEXT-SESSION §0p.1), and its root sits at z 2, level with
 * the shell's nav inside `<main>`, so the 380 sheet opens over it (§0q).
 *
 * Nothing on this page writes to the server, so it raises no toast.
 */

type Load =
  | { kind: "loading" }
  | { kind: "ready"; data: StageMapData }
  | { kind: "error"; message: string };

const Words = ({ text }: { text: string }) => <InlineText c={parseInline(text)} />;

export function FlatMapPage(): JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const nav = useNavigate();
  const { warping, warpThen } = useFlatWarp();

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      setLoad({ kind: "ready", data: await api.stages() });
    } catch (err) {
      setLoad({
        kind: "error",
        message:
          err instanceof ApiError ? err.message : "Could not reach the server. Check your connection and try again.",
      });
    }
  }, []);
  useEffect(() => {
    void read();
  }, [read]);

  const loading = load.kind === "loading";
  const skeleton = useDelayed(loading, 400);
  const slow = useDelayed(loading, 3000);

  const enter = (id: string): void => warpThen(() => nav(`/app/stage/${id}`));
  const nodes = load.kind === "ready" ? load.data.nodes : [];
  const online = nodes.filter((n) => n.state === "mastered").length;

  return (
    <div className={`fm${load.kind === "ready" ? " fm-enter" : ""}`} data-flatmap={load.kind}>
      <header className="fm-head">
        <p className="fm-kicker">Course map</p>
        <h1>The machine, one subsystem at a time</h1>
        {load.kind === "ready" && nodes.length > 0 && (
          <p className="fm-sub">
            <span className="mono">{online}</span> of <span className="mono">{nodes.length}</span> subsystems
            online. Each line joins a stage to the one it needs first.
          </p>
        )}
        <p className="fm-links">
          <Link to="/app">Show the galaxy</Link>
          <Link to="/app/stages">
            {nodes.length > 0 ? (
              <>
                All <span className="mono">{nodes.length}</span> stages as a list
              </>
            ) : (
              "All stages as a list"
            )}
          </Link>
        </p>
      </header>

      {loading && (
        <div className="fm-state-box" aria-busy="true">
          <span className="sr-only">Loading the map</span>
          {slow && (
            <p className="fm-slow" role="status">
              Still arriving. The server may be waking up, which can take up to a minute.
            </p>
          )}
          {skeleton && <MapSkeleton />}
        </div>
      )}

      {load.kind === "error" && (
        <div className="fm-state-box fm-error">
          <p className="fm-error-title">The map did not load.</p>
          <p role="alert">{load.message}</p>
          <button type="button" className="fm-btn" onClick={() => void read()}>
            Try again
          </button>
        </div>
      )}

      {load.kind === "ready" &&
        (nodes.length === 0 ? (
          <p className="fm-state-box fm-quiet">No stages have been published yet.</p>
        ) : (
          <FlatMap data={load.data} warping={warping} onEnter={enter} lead={<NextCard nodes={nodes} onGo={enter} />} />
        ))}
    </div>
  );
}

/**
 * "What do I do next" (`WEB-REVAMP.md` §2), and PAGE-SPECS' "Pick up where you
 * left off". The SERVER's states choose the stage (`nextStage`); this device
 * adds only where its reader was, and the card is whole without it.
 */
function NextCard({ nodes, onGo }: { nodes: StageNode[]; onGo: (id: string) => void }): JSX.Element | null {
  const { open } = useMapSelection();
  const next = nextStage(nodes);
  if (next.kind === "none") return null;

  if (next.kind === "done" || next.kind === "blocked") {
    return (
      <section className="fm-card" data-card aria-labelledby="fm-card-title">
        <h2 className="fm-card-eyebrow" id="fm-card-title" data-card-eyebrow>
          {next.kind === "done" ? "Every stage is mastered." : "Nothing is open to you yet"}
        </h2>
        {next.kind === "blocked" && next.node.lockReason && (
          <p className="fm-reason">
            <Words text={next.node.lockReason.message} />
          </p>
        )}
      </section>
    );
  }

  const n = next.node;
  const where = readPosition(n.id);
  return (
    <section className="fm-card" data-card aria-labelledby="fm-card-title">
      <h2 className="fm-card-eyebrow" id="fm-card-title" data-card-eyebrow>
        {next.kind === "resume" ? "Pick up where you left off" : "Next up"}
      </h2>
      <p className="fm-card-stage" data-card-stage>
        Stage <span className="mono">{n.id}</span> · {n.title}
      </p>
      <p className="fm-card-state">
        {n.state === "in_progress" ? (
          <>
            In progress: your best check is <span className="mono">{Math.round(n.mastery * 100)}%</span>
          </>
        ) : (
          "Not started"
        )}
      </p>
      {where && <p className="fm-card-where">You were reading: {where.label}</p>}
      <div className="fm-row">
        <a
          className="fm-btn fm-btn-primary"
          href={`/app/stage/${n.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onGo(n.id);
          }}
        >
          Go to Stage <span className="mono">{n.id}</span>
        </a>
        <button type="button" className="fm-btn" onClick={() => open(n.id)}>
          Show on the map
        </button>
      </div>
    </section>
  );
}

/** The shape of what is coming: the card, the square picture, the panel. */
function MapSkeleton(): JSX.Element {
  return (
    <div className="fm-skel" data-skeleton aria-hidden="true">
      <div className="fm-skel-main">
        <div className="fm-skel-card">
          <div className="fm-skel-bar fm-skel-short" />
          <div className="fm-skel-bar" />
          <div className="fm-skel-bar fm-skel-short" />
        </div>
        <div className="fm-skel-plot" />
      </div>
      <div className="fm-skel-panel">
        <div className="fm-skel-bar fm-skel-short" />
        <div className="fm-skel-bar" />
      </div>
    </div>
  );
}
