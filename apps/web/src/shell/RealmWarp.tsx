import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { realmFor } from "../lib/realm";

/**
 * The transition between the realms (WEB-REMAKE.md §5): always, both ways.
 *
 * It is driven by the REALM changing, not by which control was pressed, so a
 * link, the browser's Back, Leave planet and a bookmark all get the same
 * transition. It mounts in a layout effect, which React runs before the
 * browser paints the new route: the first frame of the new realm is already
 * under the warp's full cover, so no frame mixes two looks (the "switch at the
 * peak"). Then the cover clears and the new realm resolves.
 *
 *   star -> biome   the streaks rush outward: you are arriving somewhere
 *   biome -> star   they draw back in: you are pulling out to the system
 *
 * A deep link or a reload has no warp: nothing was travelled. Under
 * `prefers-reduced-motion` there is none either: the realm cuts in one frame.
 * Motion is never the only signal: the nav's words change with the realm.
 */
export function RealmWarp(): JSX.Element | null {
  const { pathname } = useLocation();
  const realm = realmFor(pathname).realm;
  const prev = useRef<string | null>(null);
  const [warp, setWarp] = useState<{ dir: "in" | "out"; n: number } | null>(null);

  useLayoutEffect(() => {
    const was = prev.current;
    prev.current = realm;
    if (was === null || was === realm) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setWarp((w) => ({ dir: realm === "biome" ? "in" : "out", n: (w?.n ?? 0) + 1 }));
  }, [realm]);

  if (!warp) return null;
  return (
    <div
      key={warp.n}
      className={`realm-warp realm-warp-${warp.dir}`}
      data-shell
      data-warp={warp.dir}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setWarp(null);
      }}
    >
      <span className="realm-warp-streaks" />
    </div>
  );
}

/**
 * A link that crosses the realms. It is an ordinary link on purpose: the warp
 * above belongs to the realm change, so this only names the intent in the
 * markup (`data-warp-link`), for the specs and for a reader of the code.
 */
export function WarpLink(props: ComponentProps<typeof Link>): JSX.Element {
  return <Link {...props} data-warp-link="" />;
}
