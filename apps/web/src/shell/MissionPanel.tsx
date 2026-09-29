import { LEVELS, LEVEL_NAMES } from "../lib/layout";
import { nextStage } from "../lib/next-stage";
import { useShellData } from "./ShellData";
import { WarpLink } from "./RealmWarp";

/**
 * The mission panel (WEB-REMAKE.md §2): Starfield's MISSION STATUS, top-left on
 * every star route. The stage `lib/next-stage.ts` chooses, its next step in
 * words, one control to go there, and the depth meter the old Depth Gauge was.
 *
 * Depth is not a score: it is how far into the machine the student can see, L6
 * (the surface) down to L0. The levels are NAMED only once stage 11 is open, as
 * the old gauge withheld them: ten weeks of unexplained descent is the setup
 * for that reveal, and the withholding is designed (`DepthGauge`, now retired).
 */
export function MissionPanel({ compact = false }: { compact?: boolean }): JSX.Element | null {
  const { map, grid } = useShellData();
  if (!map) {
    return (
      <section className="mission hud-panel" aria-label="Mission" aria-busy="true">
        <p className="mission-eyebrow">Mission status</p>
        <div className="skel skel-line" />
      </section>
    );
  }
  const next = nextStage(map.nodes);
  const depth = grid?.depth ?? 6;
  const revealed = (map.nodes.find((n) => n.id === "11")?.state ?? "locked") !== "locked";

  let title = "";
  let step = "";
  let to: string | null = null;
  let cta = "";
  if (next.kind === "resume" || next.kind === "start") {
    title = `Stage ${next.node.id} · ${next.node.title}`;
    step = next.kind === "resume" ? `Continue: you are at ${Math.round(next.node.mastery * 100)}%` : "Start the reading";
    to = `/app/stage/${next.node.id}`;
    cta = next.kind === "resume" ? "Continue" : "Start";
  } else if (next.kind === "blocked") {
    title = `Stage ${next.node.id} · ${next.node.title}`;
    step = next.node.lockReason?.message ?? "Locked";
  } else if (next.kind === "done") {
    title = "Every stage mastered";
    step = "The whole machine is online.";
  } else {
    title = "No stages yet";
    step = "Your instructor has not published a stage.";
  }

  return (
    <section className={`mission hud-panel${compact ? " is-compact" : ""}`} aria-labelledby="mission-title">
      <p className="mission-eyebrow">Mission status</p>
      <h2 className="mission-title" id="mission-title">
        <NumberedTitle text={title} />
      </h2>
      <p className="mission-step">
        {next.kind === "blocked" && (
          <svg className="glyph" aria-hidden="true" viewBox="0 0 16 16">
            <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="2.5" y="7" width="11" height="7.5" rx="1" fill="currentColor" />
          </svg>
        )}
        <span>{step}</span>
      </p>
      {to && (
        <WarpLink className="hud-button mission-go" to={to}>
          {cta}
        </WarpLink>
      )}
      <div className="mission-depth" role="group" aria-label={`Depth: level ${depth}`}>
        <span className="mission-depth-label">
          Depth <span className="mono">L{depth}</span>
          {revealed && <span className="mission-depth-name"> · {LEVEL_NAMES[depth]}</span>}
        </span>
        <ol className="mission-depth-meter" aria-hidden="true">
          {LEVELS.map((level) => (
            <li key={level} className={level >= depth ? "is-reached" : ""} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/** "Stage 04 · Cache Memory" with the number in mono: the HUD face never sets a number. */
export function NumberedTitle({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(\d+(?:\.\d+)?%?)/);
  return (
    <>
      {parts.map((p, i) =>
        /^\d/.test(p) ? (
          <span key={i} className="mono">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
