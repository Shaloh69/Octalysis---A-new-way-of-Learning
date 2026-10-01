import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { clearArrival, useArrival } from "../lib/arrival";
import { useSitting } from "../lib/sitting";
import { useCosmetics } from "../solar-system/cosmetic-seed";
import { moonArrival, planetArrival, type Arrival, type WorldStage } from "../solar-system/world";
import { useShellData } from "./ShellData";

/**
 * The arrival screen (instructor, 2 Oct 2026; R3.4; template
 * `design/templates/web/arrival/`, Starfield's loading screen): after the
 * warp, the planet's own biome fills the screen, and a caption names the world
 * you are entering ("a deep blue ice giant", the globe the map drew) with facts
 * about it. No globe and no veil (instructor, 2 Oct 2026: "the background
 * should be its biome design", "remove the planet, make it seamless"): the
 * biome behind it IS the page's background, so while it shows the shell's bars
 * and the page are hidden (CSS, `.biome-shell:has(> .arrival)`), and on dismiss
 * the caption fades out as they fade in over the same, unchanged biome.
 *
 * Every fact is the instructor's brief word for word or the planet's own data
 * (`solar-system/world.ts`, tested). Shown only after TRAVEL from the star
 * system (`lib/arrival.ts`), never on a deep link or a reload, never over a
 * paper (hard rule 9). It clears itself after `--dur-arrival`, or at once on
 * any key, a click, or Continue; the page beneath has been loading all along.
 * Under reduced motion the globe does not turn and the screen cuts in and out.
 */
/**
 * A duration token in milliseconds. The build's CSS minifier rewrites
 * `6000ms` as `6s`, so the unit must be read, never assumed: reading the
 * number alone made the screen clear itself after 6ms (found by a probe,
 * 2 Oct 2026).
 */
function tokenMs(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

export function ArrivalScreen({ stageId }: { stageId: string }): JSX.Element | null {
  const { pathname } = useLocation();
  const arrived = useArrival();
  const sitting = useSitting();
  const showing = arrived === pathname && !sitting && !/\/check(\/|$)/.test(pathname);
  // Its data is read only while it shows: the shell is mounted on every planet visit.
  return showing ? <ArrivalView stageId={stageId} pathname={pathname} /> : null;
}

function ArrivalView({ stageId, pathname }: { stageId: string; pathname: string }): JSX.Element {
  const { map } = useShellData();
  const { cosmetics } = useCosmetics();
  const [leaving, setLeaving] = useState(false);
  const moonId = /\/moon\/([^/]+)/.exec(pathname)?.[1];

  const node = map?.nodes.find((n) => n.id === stageId) ?? null;
  const arrival: Arrival | null = useMemo(() => {
    if (!node) return null;
    const stage: WorldStage = {
      id: node.id,
      title: node.title,
      act: node.act,
      levels: node.levels,
      gradeable: node.gradeable,
      objectives: [...node.objectives].map((o) => ({ id: o.id, level: o.level, description: o.description })),
    };
    const objective = moonId ? stage.objectives.find((o) => o.id === decodeURIComponent(moonId)) : undefined;
    return objective ? moonArrival(stage, objective, cosmetics.rotationOffset) : planetArrival(stage, cosmetics.rotationOffset);
  }, [node, moonId, cosmetics.rotationOffset]);

  const dismiss = useCallback(() => setLeaving(true), []);

  // Clears itself after the reading time; any key or a click clears it sooner.
  useEffect(() => {
    const ms = tokenMs("--dur-arrival", 6000);
    const t = window.setTimeout(dismiss, ms);
    const onKey = (e: KeyboardEvent) => {
      // The key only dismisses: it must not also fire a shortcut beneath.
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [dismiss]);

  // Fade out, then clear the mark (a cut under reduced motion: --dur-base is 0).
  useEffect(() => {
    if (!leaving) return;
    const ms = tokenMs("--dur-base", 0);
    const t = window.setTimeout(() => {
      clearArrival();
      setLeaving(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const [lore, ...facts] = arrival?.facts ?? [];
  const where = moonId ? `Moon ${decodeURIComponent(moonId)}` : `Stage ${stageId}`;

  return (
    <div
      className={`arrival${leaving ? " is-leaving" : ""}`}
      data-arrival={moonId ? "moon" : "planet"}
      data-world={arrival?.skinKey ?? "unknown"}
      role="status"
      aria-live="polite"
      onClick={dismiss}
    >
      <section className="arrival-caption sprite-panel" aria-label={`Arriving at ${where}`}>
        <div className="arrival-head">
          <span className="arrival-badge mono" aria-hidden="true">
            {moonId ? decodeURIComponent(moonId) : stageId}
          </span>
          <div>
            <p className="arrival-eyebrow">Entering</p>
            <h2 className="arrival-title">{arrival ? arrival.descriptor : where}</h2>
            <p className="arrival-where">
              {where}
              {node ? ` · ${node.title}` : ""}
            </p>
          </div>
        </div>
        {lore ? (
          <p className="arrival-lore" data-source={lore.source}>
            {lore.label ? <strong>{lore.label}: </strong> : null}
            {lore.text}
          </p>
        ) : null}
        {facts.length ? (
          <ul className="arrival-facts">
            {facts.map((f) => (
              <li key={f.text} data-source={f.source}>
                {f.label ? <strong>{f.label}: </strong> : null}
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="arrival-go">
          <span className="arrival-ring" aria-hidden="true" />
          <span className="arrival-hint">Press any key</span>
          <button type="button" className="sprite-button" onClick={dismiss}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
