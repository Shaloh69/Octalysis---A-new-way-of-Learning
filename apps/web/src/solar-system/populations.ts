import type { SolarLayout } from "./layout";

/**
 * The system's leftovers (R4.7; the instructor's brief, 1 Oct 2026,
 * `docs/source/solar-system-brief.md`): an inner rocky asteroid belt, dust,
 * scattered centaurs, a Kuiper belt and an Oort cloud of comets, comets that
 * grow a coma and a tail near the star, and the solar wind. Each sits where the
 * brief puts it, relative to the layout's own bands and frost line.
 *
 * COSMETIC ONLY: none of it is a lock, a stage or a moon, nothing can be
 * chosen, and the scene draws it all `aria-hidden` and unpickable. SEEDED from
 * the student's rotation offset with a plain LCG, never `Math.random`, so a
 * student sees the same system every session. Lighter on a phone.
 */

export interface SmallOrbit {
  a: number;
  e: number;
  omega: number;
  theta0: number;
  size: number;
}

export interface WindParticle {
  /** Unit direction outward from the star, in the plane. */
  dx: number;
  dz: number;
  /** Phase along its stream, 0-1. */
  phase: number;
  y: number;
}

export interface Populations {
  /** x, y, z triples. */
  belt: Float32Array;
  dust: Float32Array;
  kuiper: Float32Array;
  oort: Float32Array;
  centaurs: SmallOrbit[];
  comets: SmallOrbit[];
  wind: WindParticle[];
}

function lcg(seed: number): () => number {
  let s = (Math.floor(Math.abs(seed) * 1e6) ^ 0x5eed) >>> 0 || 7;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000;
}

/** A flat annulus of points, spread evenly by area, with a little thickness. */
function annulus(n: number, inner: number, outer: number, thick: number, rand: () => number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
    const t = rand() * Math.PI * 2;
    out[i * 3] = Math.cos(t) * r;
    out[i * 3 + 1] = (rand() - 0.5) * thick;
    out[i * 3 + 2] = Math.sin(t) * r;
  }
  return out;
}

export function populations(layout: SolarLayout, seed: number, low: boolean): Populations {
  const rand = lcg(seed);
  const k = low ? 0.4 : 1;
  const { frost, kuiper, oort, bands } = layout;
  const margin = (frost.outer - frost.inner) * 0.12;

  // The belt is the brief's most recognisable feature: it keeps most of its points on a slow device.
  const belt = annulus(Math.round(1400 * (low ? 0.8 : 1)), frost.inner + margin, frost.outer - margin, 0.5, rand);
  const dust = annulus(Math.round(500 * k), 2.6, frost.inner - 0.2, 1.4, rand);
  const kuiperPts = annulus(Math.round(1200 * k), kuiper.inner, kuiper.outer, 2.4, rand);

  const nOort = Math.round(1500 * k);
  const oortPts = new Float32Array(nOort * 3);
  for (let i = 0; i < nOort; i++) {
    const u = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = oort * (0.9 + rand() * 0.2);
    const q = Math.sqrt(1 - u * u);
    oortPts[i * 3] = q * Math.cos(t) * r;
    oortPts[i * 3 + 1] = u * r;
    oortPts[i * 3 + 2] = q * Math.sin(t) * r;
  }

  // Centaurs: perihelion among the giants (beyond the frost line), aphelion short of the Kuiper belt.
  const giantsInner = frost.outer + 0.5;
  const giantsOuter = Math.min(bands[6]!.outer, kuiper.inner - 0.5);
  const centaurs: SmallOrbit[] = Array.from({ length: 7 }, () => {
    const span = giantsOuter - giantsInner;
    const peri = giantsInner + rand() * span * 0.12;
    const apo = giantsOuter - rand() * span * 0.12;
    return { a: (peri + apo) / 2, e: (apo - peri) / (apo + peri), omega: rand() * Math.PI * 2, theta0: rand() * Math.PI * 2, size: 0.12 + rand() * 0.1 };
  });

  // Comets: from the icy reservoir to inside the frost line.
  const comets: SmallOrbit[] = Array.from({ length: 3 }, (_, i) => {
    const peri = 3.2 + rand() * (frost.inner * 0.45);
    const apo = kuiper.inner + (oort * 0.7 - kuiper.inner) * (0.3 + rand() * 0.6);
    return { a: (peri + apo) / 2, e: (apo - peri) / (apo + peri), omega: rand() * Math.PI * 2, theta0: (i / 3) * Math.PI * 2 + rand(), size: 0.1 };
  });

  const wind: WindParticle[] = Array.from({ length: Math.round(240 * k) }, () => {
    const t = rand() * Math.PI * 2;
    return { dx: Math.cos(t), dz: Math.sin(t), phase: rand(), y: (rand() - 0.5) * 0.6 };
  });

  return { belt, dust, kuiper: kuiperPts, oort: oortPts, centaurs, comets, wind };
}

/** How strongly a comet's ices boil at distance r: 0 beyond 1.3 × the frost line, rising to 1 near the star. */
export function cometActivity(r: number, layout: SolarLayout): number {
  const onset = layout.frost.radius * 1.3;
  if (r >= onset) return 0;
  return Math.min(1, (onset - r) / (onset - 3));
}
