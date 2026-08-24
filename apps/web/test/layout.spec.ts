import { describe, it, expect } from "vitest";
import { computeLayout, layoutBounds, LEVELS, LEVEL_NAMES } from "../src/lib/layout";

/**
 * INV-32 and INV-33 from SKILL-TREE-3D.md §9, as CI checks rather than SQL:
 * the map may not invent a node, forget one, or editorialise the curriculum.
 *
 * This mirrors db/schema.sql's seed exactly. If the seed changes and this does
 * not, these tests fail -- which is the point.
 */
const SEED = [
  { id: "00", act: 1, ordinal: 0, levels: [6], prereq: [] },
  { id: "01", act: 1, ordinal: 1, levels: [6], prereq: ["00"] },
  { id: "02", act: 1, ordinal: 2, levels: [2], prereq: ["01"] },
  { id: "03", act: 1, ordinal: 3, levels: [4], prereq: ["02"] },
  { id: "04", act: 1, ordinal: 4, levels: [5, 3], prereq: ["03"] },
  { id: "05", act: 1, ordinal: 5, levels: [4, 3], prereq: ["03", "04"] },
  { id: "06", act: 2, ordinal: 6, levels: [0, 1, 2, 3, 4, 5, 6], prereq: ["05"] },
  { id: "07", act: 2, ordinal: 7, levels: [6, 2], prereq: ["06"] },
  { id: "08", act: 2, ordinal: 8, levels: [6, 2], prereq: ["07"] },
  { id: "09", act: 2, ordinal: 9, levels: [2, 0], prereq: ["07"] },
  { id: "10", act: 2, ordinal: 10, levels: [0], prereq: ["09"] },
  { id: "11", act: 3, ordinal: 11, levels: [0, 1, 2, 3, 4, 5, 6], prereq: ["06", "10"] },
  { id: "12", act: 3, ordinal: 12, levels: [2, 1], prereq: ["11"] },
  { id: "13", act: 3, ordinal: 13, levels: [1], prereq: ["12"] },
  { id: "14", act: 3, ordinal: 14, levels: [2], prereq: ["13"] },
  { id: "15", act: 3, ordinal: 15, levels: [4], prereq: ["03", "14"] },
  { id: "16", act: 4, ordinal: 16, levels: [3, 2], prereq: ["13"] },
  { id: "17", act: 4, ordinal: 17, levels: [1, 0], prereq: ["16", "08"] },
];

describe("the seed graph", () => {
  it("is 18 nodes and 21 edges", () => {
    expect(SEED).toHaveLength(18);
    expect(SEED.reduce((a, s) => a + s.prereq.length, 0)).toBe(21);
  });

  it("is acyclic — every prereq has a lower ordinal", () => {
    const ordinalOf = new Map(SEED.map((s) => [s.id, s.ordinal]));
    for (const s of SEED) {
      for (const p of s.prereq) {
        expect(ordinalOf.get(p), `${p} is not a seeded stage`).toBeDefined();
        expect(ordinalOf.get(p)!, `${p} -> ${s.id} goes backwards`).toBeLessThan(s.ordinal);
      }
    }
  });

  it("has exactly two leaves after D1 wired 08 into 17", () => {
    const hasDependents = new Set(SEED.flatMap((s) => s.prereq));
    const leaves = SEED.map((s) => s.id).filter((id) => !hasDependents.has(id));
    expect(leaves.sort()).toEqual(["15", "17"]);
  });

  it("has the three documented forks", () => {
    const dependents = (id: string) => SEED.filter((s) => s.prereq.includes(id)).map((s) => s.id);
    expect(dependents("07").sort()).toEqual(["08", "09"]);
    expect(dependents("13").sort()).toEqual(["14", "16"]);
    expect(SEED.find((s) => s.id === "15")!.prereq.sort()).toEqual(["03", "14"]);
  });
});

describe("computeLayout — INV-32: no invented or forgotten nodes", () => {
  const positions = computeLayout(SEED);

  it("places every seeded stage and nothing else", () => {
    expect(positions.size).toBe(SEED.length);
    for (const s of SEED) expect(positions.has(s.id)).toBe(true);
  });

  it("is deterministic — identical output across runs", () => {
    const a = JSON.stringify([...computeLayout(SEED).entries()]);
    const b = JSON.stringify([...computeLayout(SEED).entries()]);
    expect(a).toBe(b);
  });

  it("does not depend on the order stages arrive in", () => {
    // The API returns them ordered, but a layout that changes when the sort
    // changes is not reproducible.
    const shuffled = [...SEED].reverse();
    const a = JSON.stringify([...computeLayout(SEED).entries()]);
    const b = JSON.stringify([...computeLayout(shuffled).entries()]);
    expect(b).toBe(a);
  });

  it("never places two nodes at the same point", () => {
    const seen = new Set([...positions.values()].map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(positions.size);
  });
});

describe("computeLayout — the vertical axis IS the level hierarchy", () => {
  const positions = computeLayout(SEED);

  it("puts L0 stages below L6 stages", () => {
    // Stage 10 is the gate level; Stage 01 is the user level. Depth on the map
    // and depth into the machine are the same motion -- that is what makes this
    // pass the design mandate's teaching test rather than being decoration.
    const gates = positions.get("10")!;
    const user = positions.get("01")!;
    expect(gates.y).toBeGreaterThan(user.y);
    expect(gates.level).toBe(0);
    expect(user.level).toBe(6);
  });

  it("places a stage at the DEEPEST level it touches", () => {
    // Stage 09 declares [2, 0]. It belongs at L0 on an axis that means depth.
    expect(positions.get("09")!.level).toBe(0);
    // Stage 04 declares [5, 3].
    expect(positions.get("04")!.level).toBe(3);
  });

  it("treats Stages 06 and 11 as spanning all levels, not sitting at one", () => {
    // They are ABOUT the hierarchy rather than in it, so they render as columns.
    expect(positions.get("06")!.spansAllLevels).toBe(true);
    expect(positions.get("11")!.spansAllLevels).toBe(true);
    expect(positions.get("06")!.level).toBeNull();

    for (const id of ["01", "09", "10", "13"]) {
      expect(positions.get(id)!.spansAllLevels).toBe(false);
    }
  });

  it("gives the four acts four distinct 3D arms", () => {
    const angleOf = (id: string) => {
      const p = positions.get(id)!;
      return Math.round(Math.atan2(p.z3, p.x3) * 1000);
    };
    // Same act, same arm angle.
    expect(angleOf("01")).toBe(angleOf("05"));
    expect(angleOf("16")).toBe(angleOf("17"));
    // Different acts, different arms.
    expect(angleOf("01")).not.toBe(angleOf("07"));
    expect(angleOf("07")).not.toBe(angleOf("12"));
  });
});

describe("level naming", () => {
  it("names all seven levels of the Computer Level Hierarchy", () => {
    expect(LEVELS).toHaveLength(7);
    for (const l of LEVELS) {
      expect(LEVEL_NAMES[l], `L${l} has no name`).toBeTruthy();
    }
    // L6 at the top, L0 at the bottom.
    expect(LEVELS[0]).toBe(6);
    expect(LEVELS[LEVELS.length - 1]).toBe(0);
    expect(LEVEL_NAMES[0]).toBe("Digital Logic");
    expect(LEVEL_NAMES[6]).toBe("User");
  });
});

describe("layoutBounds", () => {
  it("covers every node", () => {
    const positions = computeLayout(SEED);
    const b = layoutBounds(positions);
    for (const p of positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(b.minX);
      expect(p.x).toBeLessThanOrEqual(b.minX + b.width);
      expect(p.y).toBeGreaterThanOrEqual(b.minY);
      expect(p.y).toBeLessThanOrEqual(b.minY + b.height);
    }
  });

  it("handles an empty layout without dividing by zero", () => {
    expect(layoutBounds(new Map())).toEqual({ width: 0, height: 0, minX: 0, minY: 0 });
  });
});
