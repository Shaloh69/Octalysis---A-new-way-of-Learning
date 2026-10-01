import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FROST_RING,
  describeSkin,
  moonArrival,
  planetArrival,
  planetSkinKey,
  stageRing,
  zoneOf,
  INNER_WORLDS,
  OUTER_WORLDS,
  type WorldStage,
} from "../src/solar-system/world";

/**
 * The world a student is entering (R3.4's arrival screen, R4.7's frost line;
 * instructor rulings 1-2 Oct 2026). One module decides a planet's look for the
 * map AND names it on the arrival screen, so the two can never disagree.
 *
 * HARD RULE 5: every fact marked `brief` is the instructor's own text, word for
 * word (`docs/source/solar-system-brief.md`); every other fact is the planet's
 * own data. Nothing about a body is invented.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BRIEF = readFileSync(resolve(ROOT, "docs/source/solar-system-brief.md"), "utf8").replace(/\s+/g, " ");

/** The seed's 19 stages, levels as `db/schema.sql` declares them, with plausible objective levels. */
function stage(id: string, levels: number[], moonLevels: number[], over: Partial<WorldStage> = {}): WorldStage {
  return {
    id,
    title: `Title ${id}`,
    act: Number(id) <= 4 ? 1 : Number(id) <= 8 ? 2 : Number(id) <= 12 ? 3 : 4,
    levels,
    gradeable: id !== "00",
    objectives: moonLevels.map((level, i) => ({ id: `${id}.${i + 1}`, level, description: `Objective ${id}.${i + 1}` })),
    ...over,
  };
}
const STAGES: WorldStage[] = [
  stage("00", [6], []),
  stage("01", [0, 1, 2, 3, 4, 5, 6], [6, 6, 2, 2, 2]),
  stage("02", [6, 2], [6, 6, 2, 2, 2, 2, 2, 2]),
  stage("03", [2, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  stage("04", [3, 2], [3, 3, 3, 3, 2, 3, 3, 3]),
  stage("05", [1, 0], [1, 0, 0, 0]),
  stage("06", [3], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
  stage("07", [3, 1], [3, 3, 3, 1, 1, 1]),
  stage("08", [3], [3, 3, 3, 3, 3]),
  stage("09", [2, 0], [0, 0, 2, 2, 2, 2]),
  stage("10", [2], [2, 2, 2, 2, 2, 2]),
  stage("11", [2], [2, 2, 2, 2, 2]),
  stage("12", [1], [1, 1, 1, 1, 1, 1]),
  stage("13", [2, 1], [2, 2, 1, 1, 1, 1]),
  stage("14", [1], [1, 1, 1, 1, 1]),
  stage("15", [1], [1, 1, 1, 1, 1]),
  stage("16", [1], [1, 1, 1, 1]),
  stage("17", [1, 0], [1, 1, 0, 0]),
  stage("18", [6, 3], [6, 6, 3, 3]),
];

describe("the frost line", () => {
  it("sits between Machine / ISA (L2) and System Software (L3)", () => {
    expect(FROST_RING).toBe(2.5);
    expect(zoneOf(2)).toBe("inner");
    expect(zoneOf(2.49)).toBe("inner");
    expect(zoneOf(3)).toBe("outer");
  });

  it("a planet's ring is the mean of its moons' levels, as the map's layout says; Orientation falls back to its lowest level", () => {
    expect(stageRing([2, 1], [1, 1, 1, 2])).toBeCloseTo(1.25, 10);
    expect(stageRing([6], [])).toBe(6);
  });

  it("rocky worlds inside it, giants beyond it, for every seed", () => {
    for (const s of STAGES) {
      const ring = stageRing(s.levels, s.objectives.map((o) => o.level));
      const spoke = s.levels.length === 7;
      for (const seed of [0, 0.37, 1.234, 5.5]) {
        const key = planetSkinKey(s.id, ring, spoke, seed);
        if (spoke) expect(key, s.id).toBe("earth");
        else if (ring < FROST_RING) expect(INNER_WORLDS, `${s.id} at ${ring}`).toContain(key);
        else expect(OUTER_WORLDS, `${s.id} at ${ring}`).toContain(key);
      }
    }
  });

  it("is seeded, never random: the same stage and seed give the same world; seeds move it", () => {
    expect(planetSkinKey("04", 2.9, false, 1.234)).toBe(planetSkinKey("04", 2.9, false, 1.234));
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) seen.add(planetSkinKey("06", 3, false, s * 0.37));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("every world is named", () => {
  it("each inner and outer world, and each moon, has a descriptor", () => {
    for (const k of [...INNER_WORLDS, ...OUTER_WORLDS]) expect(describeSkin(k, "planet"), k).toMatch(/^an? [a-z]/);
    for (const k of ["moon", "ceres", "eris", "makemake", "mercury", "haumea"] as const) {
      expect(describeSkin(k, "moon"), k).toMatch(/ moon$/);
    }
  });

  it("the giants say giant, and the inner worlds never do", () => {
    for (const k of OUTER_WORLDS) expect(describeSkin(k, "planet"), k).toMatch(/giant/);
    for (const k of INNER_WORLDS) expect(describeSkin(k, "planet"), k).not.toMatch(/giant/);
  });
});

describe("the arrival's facts (hard rule 5)", () => {
  const all = STAGES.map((s) => ({ s, a: planetArrival(s, 0.42) }));

  it("every brief fact is the instructor's text, word for word", () => {
    for (const { s, a } of all) {
      for (const f of a.facts.filter((x) => x.source === "brief")) {
        expect(BRIEF, `${s.id}: ${f.text}`).toContain(f.text);
      }
    }
  });

  it("every planet has a brief fact about its kind and one about its own data", () => {
    for (const { s, a } of all) {
      expect(a.facts.some((f) => f.source === "brief"), s.id).toBe(true);
      expect(a.facts.some((f) => f.source === "data"), s.id).toBe(true);
    }
  });

  it("no two planets read the same: each planet's facts are its own", () => {
    const sigs = all.map(({ a }) => a.facts.map((f) => f.text).join("|"));
    expect(new Set(sigs).size).toBe(STAGES.length);
  });

  it("the facts follow the world: a giant gets the giants' line, a rocky world the terrestrial one", () => {
    for (const { s, a } of all) {
      const text = a.facts.map((f) => f.text).join(" ");
      // The spoke (01) is the home world wherever its mean ring falls.
      if (a.spoke || (a.zone === "inner" && s.gradeable)) expect(text, s.id).toContain("Terrestrial Planets:");
      else if (s.gradeable) expect(text, s.id).toContain("Gas & Ice Giants:");
    }
  });

  it("the data facts are the planet's own: its moons counted, its levels named", () => {
    const three = planetArrival(STAGES[3]!, 0.42);
    const data = three.facts.filter((f) => f.source === "data").map((f) => f.text).join(" ");
    expect(data).toContain("11 moons");
    expect(data).toContain("L1");
    expect(data).toContain("L2");
  });

  it("Orientation has no moons: its belt is the fact, and it says nothing in it is graded", () => {
    const zero = planetArrival(STAGES[0]!, 0.42);
    const text = zero.facts.map((f) => f.text).join(" ");
    expect(text).toContain("Asteroid Belts:");
    expect(text).toMatch(/no moons/i);
  });

  it("the facts name the descriptor the map draws", () => {
    for (const { s, a } of all) {
      const ring = stageRing(s.levels, s.objectives.map((o) => o.level));
      expect(a.descriptor, s.id).toBe(describeSkin(planetSkinKey(s.id, ring, s.levels.length === 7, 0.42), "planet"));
    }
  });
});

describe("a moon's arrival", () => {
  it("names the moon, its planet, its objective, and quotes the brief on moons and on the Hill sphere", () => {
    const three = STAGES[3]!;
    const m = moonArrival(three, three.objectives[8]!, 0.42);
    expect(m.descriptor).toMatch(/ moon$/);
    const text = m.facts.map((f) => f.text).join(" ");
    expect(text).toContain("Objective 03.9");
    expect(text).toContain("one of 11 moons");
    expect(text).toContain("Moons (Natural Satellites):");
    expect(text).toContain("Hill Sphere");
    for (const f of m.facts.filter((x) => x.source === "brief")) expect(BRIEF).toContain(f.text);
  });
});
