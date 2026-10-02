import { solveKepler } from "./kepler";
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

  // Comets: from the Oort cloud to inside the frost line. R4.9 (instructor,
  // 2 Oct 2026: "stay out at the edges", "much slower"): each starts near
  // aphelion, and at its real speed the second law keeps it out there for over
  // 90% of its period (tested); it swings in, grows its coma and tail, and goes.
  const comets: SmallOrbit[] = Array.from({ length: 3 }, () => {
    const peri = 3.2 + rand() * (frost.inner * 0.3);
    const apo = oort * (0.95 + rand() * 0.1);
    const omega = rand() * Math.PI * 2;
    const e = (apo - peri) / (apo + peri);
    // Near aphelion in TIME: a mean anomaly within 2% of a period of it. (On an
    // orbit this eccentric, an angle near aphelion can be far from it.)
    const E = solveKepler(Math.PI + (rand() - 0.5) * 0.25, e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    return { a: (peri + apo) / 2, e, omega, theta0: omega + nu, size: 0.1 };
  });

  const wind: WindParticle[] = Array.from({ length: Math.round(240 * k) }, () => {
    const t = rand() * Math.PI * 2;
    return { dx: Math.cos(t), dz: Math.sin(t), phase: rand(), y: (rand() - 0.5) * 0.6 };
  });

  return { belt, dust, kuiper: kuiperPts, oort: oortPts, centaurs, comets, wind };
}

/* --------------------------------------------- R4.8: the rest of the brief */

/** One Trojan: its offset from the swarm's Lagrange point, along the orbit (radians) and across it. */
export interface TrojanMember {
  dTheta: number;
  dr: number;
  y: number;
}

export interface TrojanSwarm {
  planetId: string;
  /** L4 leads the planet by 60°, L5 trails it. */
  side: 4 | 5;
  members: TrojanMember[];
}

/**
 * Trojan swarms (the brief: "a massive planet paired with a smaller companion
 * tucked 60 degrees ahead or behind it in a stable Lagrange point"). Drawn as
 * Jupiter's Trojans and Greeks are, a loose cloud at L4 and one at L5 of every
 * giant, and NOT as a second planet: every planet on this map is a stage, and
 * a companion planet would be a stage that does not exist.
 *
 * Each cloud is built in mirrored pairs, so its offsets balance exactly and
 * its centre IS the Lagrange point (`kepler.ts`'s `lagrangePoint`, tested).
 * Spread along the orbit, as real swarms are, thin across it.
 */
export function trojanSwarms(giants: readonly string[], seed: number, low: boolean): TrojanSwarm[] {
  const rand = lcg(seed + 0.5);
  const half = low ? 12 : 30;
  return giants.flatMap((planetId) =>
    ([4, 5] as const).map((side) => {
      const members: TrojanMember[] = [];
      for (let i = 0; i < half; i++) {
        // Denser near the point: the product of two uniforms leans towards 0.
        const dTheta = (rand() - 0.5) * 0.8 * rand();
        const dr = (rand() - 0.5) * 1.6 * rand();
        const y = (rand() - 0.5) * 0.4;
        members.push({ dTheta, dr, y }, { dTheta: -dTheta, dr: -dr, y: -y });
      }
      return { planetId, side, members };
    }),
  );
}

/** The sun turns once in this many seconds on the map (`StarMapScene`'s Sun). */
export const SUN_SPIN_S = 90;
/** The solar wind is drawn from this distance out to the frost line... */
export const WIND_INNER = 2.4;
/** ...and takes this many seconds to cross it. */
export const WIND_CROSSING_S = 20;

/**
 * The Parker spiral's winding, k = Ω/v: the star's spin over the wind's speed,
 * both as the map draws them. The star turns while the wind carries its field
 * outward, so a field line trails the turn by k radians per unit of distance.
 */
export function parkerK(layout: SolarLayout): number {
  const omega = (2 * Math.PI) / SUN_SPIN_S;
  const v = (layout.frost.inner - WIND_INNER) / WIND_CROSSING_S;
  return omega / v;
}

/**
 * The star's magnetic field (the brief's interplanetary medium: "cosmic dust,
 * solar wind ... and magnetic fields") as Parker spirals: `lines` field lines
 * from the wind's start out past the Kuiper belt, each φ(r) = φ0 - k(r - r0),
 * as one set of line segments (x, y, z pairs) so the whole field is one draw.
 * The same for every student: it is the star's, not the student's.
 */
export function parkerField(layout: SolarLayout, lines = 12, segs = 96): Float32Array {
  const k = parkerK(layout);
  const r0 = WIND_INNER;
  const r1 = layout.kuiper.outer;
  const out = new Float32Array(lines * segs * 2 * 3);
  let o = 0;
  const put = (r: number, phi0: number) => {
    const phi = phi0 - k * (r - r0);
    out[o++] = Math.cos(phi) * r;
    out[o++] = 0;
    out[o++] = Math.sin(phi) * r;
  };
  for (let j = 0; j < lines; j++) {
    const phi0 = (j / lines) * Math.PI * 2;
    for (let s = 0; s < segs; s++) {
      put(r0 + ((r1 - r0) * s) / segs, phi0);
      put(r0 + ((r1 - r0) * (s + 1)) / segs, phi0);
    }
  }
  return out;
}

/** How strongly a comet's ices boil at distance r: 0 beyond 1.3 × the frost line, rising to 1 near the star. */
export function cometActivity(r: number, layout: SolarLayout): number {
  const onset = layout.frost.radius * 1.3;
  if (r >= onset) return 0;
  return Math.min(1, (onset - r) / (onset - 3));
}
