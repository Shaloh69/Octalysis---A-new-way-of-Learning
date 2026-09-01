import { describe, it, expect } from "vitest";
import { computeLayout, layoutBounds, LEVELS, LEVEL_NAMES } from "../src/lib/layout";

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * INV-32 and INV-33 from SKILL-TREE-3D.md 9, as CI checks rather than SQL:
 * the map may not invent a node, forget one, or editorialise the curriculum.
 *
 * THE SEED IS PARSED OUT OF db/schema.sql, NOT COPIED FROM IT.
 *
 * This block used to be a hand-maintained array with a comment promising that
 * "if the seed changes and this does not, these tests fail". It did not. The
 * seed went from 17 chapters to 18 and every assertion here kept passing
 * against the stale copy, because nothing ever compared the two. A duplicate
 * that claims to be a mirror is worse than an obvious duplicate.
 *
 * `stages.prereq` is the only edge list in the project (CLAUDE.md, "The skill
 * tree"). Parsing it here is what makes that literally true for the web app.
 */
const SCHEMA = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "db", "schema.sql",
);

interface SeedRow {
  id: string;
  act: number;
  ordinal: number;
  levels: number[];
  prereq: string[];
}

function parseSeed(): SeedRow[] {
  const sql = readFileSync(SCHEMA, "utf8");
  const start = sql.indexOf(
    "insert into stages (id, act, ordinal, title, est_minutes, prereq, published, gradeable, archetype, levels) values",
  );
  if (start < 0) throw new Error("stages seed not found in db/schema.sql");
  const body = sql.slice(start, sql.indexOf(";", start));

  //  ('04',1, 4,'Cache Memory', 80, '{03}', true, true, 'B', '{3,2}')
  const row =
    /\('(\d{2})',\s*(\d+),\s*(\d+),\s*'(?:[^']|'')*',\s*(\d+),\s*'\{([^}]*)\}',\s*\w+,\s*\w+,\s*'[A-D]',\s*'\{([^}]*)\}'\)/g;

  const rows: SeedRow[] = [];
  for (const m of body.matchAll(row)) {
    const split = (t: string) => (t.trim() === "" ? [] : t.split(",").map((x) => x.trim()));
    rows.push({
      id: m[1]!,
      act: Number(m[2]),
      ordinal: Number(m[3]),
      prereq: split(m[5]!),
      levels: split(m[6]!).map(Number),
    });
  }
  return rows;
}

const SEED = parseSeed();

/** Orientation plus the 18 chapters of the CPE 412 syllabus. */
const CHAPTERS = 18;
const STAGES = CHAPTERS + 1;

describe("the seed parser itself", () => {
  it("actually read rows out of db/schema.sql", () => {
    // If the regex stops matching, every test below would pass vacuously on an
    // empty array. This is the guard against that.
    expect(SEED.length, "parsed nothing -- has the seed's column order changed?")
      .toBe(STAGES);
    expect(SEED[0]).toMatchObject({ id: "00", act: 1, ordinal: 0, prereq: [] });
    expect(SEED.at(-1)!.id).toBe(String(CHAPTERS).padStart(2, "0"));
    expect(SEED.every((s) => s.levels.length > 0)).toBe(true);
  });
});


describe("the seed graph", () => {
  it("is 19 nodes and 18 edges - one linear chain", () => {
    expect(SEED).toHaveLength(STAGES);
    expect(SEED.reduce((a, s) => a + s.prereq.length, 0)).toBe(CHAPTERS);
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

  it("is ONE CHAIN: no forks, no joins, a single leaf", () => {
    // The instructor teaches in syllabus order, straight down the line, so the
    // graph models the COURSE rather than the subject's intellectual structure.
    // An earlier draft branched it; that was a defensible reading of the
    // material and the wrong reading of the delivery.
    const dependents = (id: string) => SEED.filter((s) => s.prereq.includes(id)).map((s) => s.id);
    for (const st of SEED) {
      expect(st.prereq.length, `${st.id} has ${st.prereq.length} prereqs`).toBeLessThanOrEqual(1);
      expect(dependents(st.id).length, `${st.id} forks`).toBeLessThanOrEqual(1);
    }
    const hasDependents = new Set(SEED.flatMap((s) => s.prereq));
    expect(SEED.map((s) => s.id).filter((id) => !hasDependents.has(id)))
      .toEqual([String(CHAPTERS).padStart(2, "0")]);
  });

  it("every chapter requires exactly the one before it", () => {
    for (const st of SEED) {
      if (st.id === "00") { expect(st.prereq).toEqual([]); continue; }
      expect(st.prereq).toEqual([String(Number(st.id) - 1).padStart(2, "0")]);
    }
  });

  it("act == grading period, four of them", () => {
    const byAct = new Map<number, string[]>();
    for (const s of SEED) byAct.set(s.act, [...(byAct.get(s.act) ?? []), s.id]);
    expect([...byAct.keys()].sort()).toEqual([1, 2, 3, 4]);

    /*
     * THE INSTRUCTOR'S RANGES, 2 Sep 2026: Prelim covers chapters 1-4, Midterm
     * 5-8, Semi-finals 9-12, Finals 13-17. Stage NN is chapter NN, and stage 00
     * is orientation, which is ungraded and sits with the Prelim.
     *
     * This corrects a ONE-STAGE DRIFT the seed carried: it grouped 00-05 /
     * 06-09 / 10-13 / 14-18, which put chapter 5 in the Prelim, chapter 9 in
     * the Midterm and chapter 13 in the Semi-finals. That was never cosmetic —
     * `db/schema.sql`'s blueprints scope by `by_act`, so each of the four
     * examinations was sampling one chapter beyond its own grading period. A
     * student revising their syllabus would have been right and the generated
     * paper wrong.
     */
    expect(byAct.get(1)).toEqual(["00", "01", "02", "03", "04"]); // Prelim, ch 1-4
    expect(byAct.get(2)).toEqual(["05", "06", "07", "08"]);       // Midterm, ch 5-8
    expect(byAct.get(3)).toEqual(["09", "10", "11", "12"]);       // Semi-finals, ch 9-12

    /*
     * Chapter 18 is the open edge. The ruling's ranges stop at 17, but chapter
     * 18 exists and is gradeable, so it sits with the Finals — every stage must
     * belong to a period for `by_act` to reach it, and omitting it would
     * silently drop it from the only cumulative examination. Flagged in
     * `PROGRESS.md` F-7, not decided here.
     */
    expect(byAct.get(4)).toEqual(["13", "14", "15", "16", "17", "18"]); // Finals
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
    // Stage 05 (Internal Memory) reaches L0; Stage 02 (Evolution/Performance)
    // sits at the user level. Depth on the map is depth into the machine.
    const gates = positions.get("05")!;
    const user = positions.get("02")!;
    expect(gates.y).toBeGreaterThan(user.y);
    expect(gates.level).toBe(0);
    expect(user.level).toBe(2);
  });

  it("places a stage at the DEEPEST level it touches", () => {
    // Stage 09 (Computer Arithmetic) declares [2, 0] -- it belongs at L0.
    expect(positions.get("09")!.level).toBe(0);
    // Stage 04 (Cache Memory) declares [3, 2] -- deepest is 2.
    expect(positions.get("04")!.level).toBe(2);
  });

  it("treats Stages 06 and 11 as spanning all levels, not sitting at one", () => {
    // Chapter 1 (Introduction) is the org-vs-architecture chapter -- it is ABOUT
    // the hierarchy rather than sitting in it, so it renders as a column.
    expect(positions.get("01")!.spansAllLevels).toBe(true);
    expect(positions.get("01")!.level).toBeNull();

    for (const id of ["02", "09", "12", "17"]) {
      expect(positions.get(id)!.spansAllLevels).toBe(false);
    }
  });

  it("gives the four acts four distinct 3D arms", () => {
    const angleOf = (id: string) => {
      const p = positions.get(id)!;
      return Math.round(Math.atan2(p.z3, p.x3) * 1000);
    };
    // Same act (grading period), same arm angle.
    expect(angleOf("01")).toBe(angleOf("04")); // both Prelim
    expect(angleOf("16")).toBe(angleOf("17")); // both Finals
    // Different periods, different arms.
    expect(angleOf("01")).not.toBe(angleOf("07")); // Prelim vs Midterm
    expect(angleOf("07")).not.toBe(angleOf("12")); // Midterm vs Semi-finals
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
