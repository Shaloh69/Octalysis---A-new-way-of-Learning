import { useEffect, useMemo } from "react";
import { RATES, speakable, useListen } from "../lib/listen";

/**
 * Listen: the stage's lesson read aloud (the audiobook; instructor rulings of
 * 6 Oct 2026, docs/FIGURES-AND-AUDIO.md). Controls, against DESIGN-MANDATE.md §1:
 *
 *   Listen / Pause / Resume / Stop   hear the lesson hands-free, and stop it
 *   Speed                            0.75x to 1.5x, from the sentence being read
 *
 * The block being read is marked (`data-speaking`, in words for a screen
 * reader too) and kept in view. Where the browser has no speech synthesis the
 * control is not drawn and one line says so. Only the reader mounts this,
 * never a paper (hard rule 9).
 */
export function ListenBar({ blocks }: { blocks: ReadonlyArray<{ kind: string; body: string }> }): JSX.Element | null {
  const chunks = useMemo(() => speakable(blocks), [blocks]);
  const { supported, state, at, rate, play, pause, resume, stop, setRate } = useListen(chunks);
  const block = state === "idle" ? null : (chunks[at]?.block ?? null);

  // Mark the block being read, and keep it in view (a cut under reduced motion).
  useEffect(() => {
    if (block === null) return;
    const el = document.querySelector<HTMLElement>(`[data-reading] [data-block="${block}"]`);
    if (!el) return;
    el.setAttribute("data-speaking", "");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    return () => el.removeAttribute("data-speaking");
  }, [block]);

  if (chunks.length === 0) return null;
  if (!supported) {
    return (
      <p className="rd-listen-note" data-listen="unsupported">
        This browser cannot read the lesson aloud.
      </p>
    );
  }

  return (
    <div className="rd-listen" data-listen={state} role="group" aria-label="Listen to the lesson">
      {state === "idle" ? (
        <button type="button" className="sprite-button" onClick={play}>
          Listen
        </button>
      ) : (
        <>
          <button type="button" className="sprite-button" onClick={state === "playing" ? pause : resume}>
            {state === "playing" ? "Pause" : "Resume"}
          </button>
          <button type="button" className="sprite-button" onClick={stop}>
            Stop
          </button>
          <span className="rd-listen-where" aria-live="off">
            {state === "paused" ? "Paused at" : "Reading"} part <span className="mono">{block === null ? 0 : block + 1}</span> of{" "}
            <span className="mono">{blocks.length}</span>
          </span>
        </>
      )}
      <span className="rd-listen-speed" role="group" aria-label="Reading speed">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className="rd-listen-rate"
            aria-pressed={rate === r}
            aria-label={`Speed ${r} times`}
            onClick={() => setRate(r)}
          >
            <span className="mono">{r}×</span>
          </button>
        ))}
      </span>
    </div>
  );
}
