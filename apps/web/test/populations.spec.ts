import { describe, it, expect } from "vitest";
import { computeSolarLayout, type StageInput, type ObjectiveInput } from "../src/solar-system/layout";
import { populations, cometActivity } from "../src/solar-system/populations";

/**
 * R4.7, the system's leftovers (the instructor's brief, 1 Oct 2026): "an inner
 * rocky asteroid belt, chaotic dust clouds, scattered centaurs, and an
 * outermost freezing reservoir of icy comets like a Kuiper Belt or Oort
 * Cloud", comets that grow "a visible glowing coma and tail" near the star,
 * and the solar wind. Each is placed where the brief puts it, relative to the
 * layout's own bands and frost line, and every one is seeded, never random.
 */

const STAGES: StageInput[] = Array.from({ length: 19 }, (_, i) => ({
  id: String(i).padStart(2, "0"),
  act: 1 + Math.floor(i / 5),
  ordinal: i,
  levels: i === 1 ? [0, 1, 2, 3, 4, 5, 6] : [[6], [6], [6, 2], [2, 1], [3, 2], [1, 0], [3], [3, 1], [3], [2, 0], [2], [2], [1], [2, 1], [1], [1], [1], [1, 0], [6, 3]][i]!,
}));
const OBJ: ObjectiveInput[] = STAGES.filter((s) => s.id !== "00").flatMap((s) =>
  Array.from({ length: 5 }, (_, k) => ({ id: `${s.id}.${k + 1}`, stageId: s.id, level: s.levels[0]! })),
);
const L = computeSolarLayout(STAGES, OBJ);
const radial = (a: Float32Array) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i += 3) out.push(Math.hypot(a[i]!, a[i + 2]!));
  return out;
};

describe("where the brief puts them", () => {
  const P = populations(L, 0.42, false);

  it("the asteroid belt fills the gap at the frost line, between the rocky worlds and the giants", () => {
    expect(P.belt.length / 3).toBeGreaterThan(500);
    for (const r of radial(P.belt)) {
      expect(r).toBeGreaterThan(L.frost.inner);
      expect(r).toBeLessThan(L.frost.outer);
    }
  });

  it("the dust lies in the inner system, inside the frost line", () => {
    for (const r of radial(P.dust)) expect(r).toBeLessThan(L.frost.inner);
  });

  it("the Kuiper belt lies beyond the last band; the Oort cloud is a shell beyond it, in every direction", () => {
    for (const r of radial(P.kuiper)) {
      expect(r).toBeGreaterThanOrEqual(L.kuiper.inner);
      expect(r).toBeLessThanOrEqual(L.kuiper.outer);
    }
    let above = 0;
    let below = 0;
    for (let i = 0; i < P.oort.length; i += 3) {
      const d = Math.hypot(P.oort[i]!, P.oort[i + 1]!, P.oort[i + 2]!);
      expect(d).toBeGreaterThan(L.oort * 0.85);
      expect(d).toBeLessThan(L.oort * 1.15);
      if (P.oort[i + 1]! > L.oort * 0.5) above++;
      if (P.oort[i + 1]! < -L.oort * 0.5) below++;
    }
    expect(above, "a sphere, not a disc").toBeGreaterThan(50);
    expect(below).toBeGreaterThan(50);
  });

  it("centaurs cross the orbits of the giant planets: each spans at least two giants' orbits, beyond the frost line, short of the Kuiper belt", () => {
    const giants = [...L.bodies.values()].filter((b) => b.kind === "planet" && b.radius > L.frost.outer).map((b) => b.radius);
    expect(P.centaurs.length).toBeGreaterThanOrEqual(5);
    for (const c of P.centaurs) {
      const peri = c.a * (1 - c.e);
      const apo = c.a * (1 + c.e);
      expect(peri).toBeGreaterThan(L.frost.outer);
      expect(apo).toBeLessThan(L.kuiper.inner);
      expect(c.e).toBeGreaterThan(0.1);
      expect(giants.filter((g) => g > peri && g < apo).length, "giants' orbits crossed").toBeGreaterThanOrEqual(2);
    }
  });

  it("comets fall from the icy reservoir to inside the frost line, on eccentric orbits", () => {
    expect(P.comets.length).toBeGreaterThanOrEqual(2);
    for (const c of P.comets) {
      expect(c.a * (1 + c.e), "aphelion out in the reservoir").toBeGreaterThan(L.kuiper.inner);
      expect(c.a * (1 - c.e), "perihelion inside the frost line").toBeLessThan(L.frost.inner);
      expect(c.e).toBeGreaterThan(0.6);
    }
  });

  it("a comet's coma and tail come only near the star: none far out, full at perihelion", () => {
    const c = P.comets[0]!;
    expect(cometActivity(c.a * (1 + c.e), L)).toBe(0);
    expect(cometActivity(c.a * (1 - c.e), L)).toBeGreaterThan(0.6);
    expect(cometActivity(L.frost.radius * 2, L)).toBe(0);
  });

  it("the solar wind streams outward from the star", () => {
    expect(P.wind.length).toBeGreaterThan(50);
    for (const w of P.wind) expect(Math.hypot(w.dx, w.dz)).toBeCloseTo(1, 6);
  });
});

describe("seeded, never random; lighter on a phone", () => {
  it("the same seed gives the same system; another seed another", () => {
    const a = populations(L, 0.42, false);
    const b = populations(L, 0.42, false);
    const c = populations(L, 1.7, false);
    expect(Array.from(a.belt.slice(0, 30))).toEqual(Array.from(b.belt.slice(0, 30)));
    expect(Array.from(a.belt.slice(0, 30))).not.toEqual(Array.from(c.belt.slice(0, 30)));
  });

  it("low quality draws fewer points, the same populations", () => {
    const hi = populations(L, 0.42, false);
    const lo = populations(L, 0.42, true);
    expect(lo.belt.length).toBeLessThan(hi.belt.length);
    expect(lo.oort.length).toBeLessThan(hi.oort.length);
    expect(lo.comets.length).toBe(hi.comets.length);
  });
});
