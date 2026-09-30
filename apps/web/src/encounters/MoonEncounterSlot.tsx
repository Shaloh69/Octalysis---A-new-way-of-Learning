import { Component, lazy, Suspense, useMemo, type ReactNode } from "react";
import { encounterFor } from "../lib/encounters";
import { useDelayed } from "../lib/useDelayed";
import { encounterForMoon } from "./registry";

/**
 * The moon's encounter, if it has one (WEB-REVAMP 3.6), below its journey.
 *
 * It sits OUTSIDE the runner, in its own section wearing the stage's encounter
 * theme (`data-encounter`), so it can never dress the paper, and the paper is
 * never the only thing on the page nor the encounter the only path: the moon
 * is mastered by its questions either way. Its code arrives in its own lazy
 * chunk. A failed load says so and leaves the questions untouched.
 */
export function MoonEncounterSlot({ stageId, objectiveId }: { stageId: string; objectiveId: string }): JSX.Element | null {
  const entry = encounterForMoon(objectiveId);
  const Game = useMemo(() => (entry ? lazy(entry.load) : null), [entry]);
  if (!entry || !Game) return null;
  return (
    <section
      className="moon-encounter encounter"
      data-encounter={encounterFor(stageId)}
      aria-label={`${entry.name}, a ${entry.kind.toLowerCase()} for moon ${objectiveId}`}
    >
      <LoadFailure>
        <Suspense fallback={<Waiting />}>
          <Game />
        </Suspense>
      </LoadFailure>
    </section>
  );
}

function Waiting(): JSX.Element {
  const show = useDelayed(true, 400);
  return (
    <div aria-busy="true" style={{ minHeight: "12rem" }}>
      {show ? <p role="status">Loading the warm-up…</p> : null}
    </div>
  );
}

class LoadFailure extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <p role="alert">
          The warm-up did not load. The questions above still count; reload the page to try the warm-up again.
        </p>
      );
    }
    return this.props.children;
  }
}
