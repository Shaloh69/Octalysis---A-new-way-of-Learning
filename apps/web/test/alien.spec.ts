import { describe, it, expect } from "vitest";
import { ALIEN_LINES, alienComet, alienFirstPass, alienLine, alienNear, alienOrbit } from "../src/solar-system/alien";
import { positionAt } from "../src/solar-system/kepler";
import { computeSolarLayout, type StageInput } from "../src/solar-system/layout";
import { populations } from "../src/solar-system/populations";

/** The easter egg (instructor, 5 Oct 2026): an alien on a comet's orbit, focused on a click, talking. */

const STAGES: StageInput[] = Array.from({ length: 19 }, (_, i) => ({
  id: String(i).padStart(2, "0"),
  act: 1 + Math.floor(i / 5),
  ordinal: i,
  levels: i === 1 ? [0, 1, 2, 3, 4, 5, 6] : [[6], [6], [6, 2], [2, 1], [3, 2], [1, 0], [3], [3, 1], [3], [2, 0], [2], [2], [1], [2, 1], [1], [1], [1], [1, 0], [6, 3]][i]!,
}));
const L = computeSolarLayout(STAGES, []);

describe("the alien", () => {
  it("says the instructor's four lines, in order, round and round", () => {
    expect(ALIEN_LINES).toEqual(["Pag tuon haa", "Oi tan aw man ka", "Alien nako BOII!", "Shem gwapo"]);
    expect([0, 1, 2, 3, 4, 5].map(alienLine)).toEqual([...ALIEN_LINES, "Pag tuon haa", "Oi tan aw man ka"]);
  });

  it("rides a real comet's ellipse: the same size, shape and perihelion", () => {
    for (const seed of [0.37, 3.7449036281682666, 6.1]) {
      const P = populations(L, seed, false);
      const k = alienComet(P.comets, seed);
      const c = P.comets[k]!;
      const o = alienOrbit(c, seed, alienFirstPass(seed));
      expect([o.a, o.e]).toEqual([c.a, c.e]);
    }
  });

  it("first passes perihelion 25 to 75 seconds in, seeded, and is in the inner system then", () => {
    const seeds = [0.1, 0.37, 1.7, 3.7449036281682666, 6.1, 9.81];
    const passes = seeds.map(alienFirstPass);
    for (const p of passes) {
      expect(p).toBeGreaterThanOrEqual(25);
      expect(p).toBeLessThanOrEqual(75);
    }
    expect(new Set(passes.map((p) => p.toFixed(3))).size).toBeGreaterThan(1);
    const P = populations(L, 0.37, false);
    const o = alienOrbit(P.comets[alienComet(P.comets, 0.37)]!, 0.37, alienFirstPass(0.37));
    const r = positionAt(o, alienFirstPass(0.37)).r;
    expect(r).toBeCloseTo(o.a * (1 - o.e), 6);
    expect(alienNear(o, alienFirstPass(0.37), L.frost.radius)).toBe(true);
  });

  it("is only sometimes there: still on its way in at t = 0, and away for most of its period", () => {
    const P = populations(L, 0.37, false);
    const o = alienOrbit(P.comets[alienComet(P.comets, 0.37)]!, 0.37, alienFirstPass(0.37));
    for (const seed of [0.1, 0.37, 1.7, 3.7449036281682666, 6.1, 9.81]) {
      const Q = populations(L, seed, false);
      const q = alienOrbit(Q.comets[alienComet(Q.comets, seed)]!, seed, alienFirstPass(seed));
      expect(positionAt(q, 0).r, `seed ${seed}: beyond the frost line, inbound`).toBeGreaterThan(L.frost.radius);
    }
    let near = 0;
    for (let i = 0; i < 2000; i++) if (alienNear(o, (o.period * i) / 2000, L.frost.radius)) near++;
    expect(near / 2000).toBeLessThan(0.2);
    expect(near).toBeGreaterThan(0);
  });

  it("?alien=now brings it in at once: perihelion at t = 0", () => {
    const P = populations(L, 0.37, false);
    const o = alienOrbit(P.comets[alienComet(P.comets, 0.37)]!, 0.37, 0);
    expect(alienNear(o, 0, L.frost.radius)).toBe(true);
  });
});
