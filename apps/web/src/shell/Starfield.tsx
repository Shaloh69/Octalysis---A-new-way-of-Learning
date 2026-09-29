import { useMemo } from "react";

/**
 * The star system's still background on every star route except the map, whose
 * 3D scene is its own sky (WEB-REMAKE.md §2). One element per layer carrying a
 * long `box-shadow` list, so 220 stars cost three DOM nodes, no canvas and no
 * frame loop: it costs nothing on a phone (BIOME-AND-LOADING-SPEC.md §4.1b).
 *
 * The list has no colour of its own: each star is `currentColor`, and each
 * layer takes a token. Seeded with a fixed number, NOT the student's cosmetic
 * seed, so every student sees the same sky over the same curriculum.
 */
function layer(count: number, seed: number): string {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`${(rand() * 100).toFixed(2)}vw ${(rand() * 100).toFixed(2)}vh`);
  }
  return out.join(", ");
}

export function Starfield(): JSX.Element {
  const layers = useMemo(() => [layer(140, 7), layer(60, 19), layer(20, 43)], []);
  return (
    <div className="starfield" aria-hidden="true">
      {layers.map((l, i) => (
        <span key={i} className={`starfield-layer starfield-${i}`} style={{ boxShadow: l }} />
      ))}
    </div>
  );
}
