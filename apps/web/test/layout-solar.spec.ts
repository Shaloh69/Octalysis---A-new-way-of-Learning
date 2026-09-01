import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeSolarLayout,
  angleForOrdinal,
  flightPath,
  LEVELS,
  LEVEL_NAMES,
  type StageInput,
  type ObjectiveInput,
} from "../src/solar-system/layout";

/**
 * INV-32 and INV-33, restated for the solar system: the map may not invent a
 * body, forget one, or editorialise the curriculum. Same invariants as
 * `layout.spec.ts`, one level deeper -- moons are now in scope too.
 *
 * NEITHER INPUT IS COPIED. Stages are parsed out of `db/schema.sql` and
 * objectives out of `content/stages/*.md`, for the reason `layout.spec.ts`
 * already learned the hard way: a hand-maintained mirror that claims to track
 * the seed will silently stop tracking it. That file's array survived the
 * curriculum going from 17 chapters to 18 with every assertion still passing.
 *
 * `content/stages/*.md` front matter is the AUTHORING source of truth for
 * objectives; `scripts/sync-content.mjs` is what puts them in the database.
 * Parsing the files here means this test fails the moment a chapter is
 * re-authored in a way the layout cannot handle -- which is what happened to
 * chapter 3 once already, losing four objectives to a retyped front matter.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/* --------------------------------------------------------- parse the seed */

function parseStages(): StageInput[] {
  const sql = readFileSync(resolve(ROOT, "db", "schema.sql"), "utf8");
  const start = sql.indexOf(
    "insert into stages (id, act, ordinal, title, est_minutes, prereq, published, gradeable, archetype, levels) values",
  );
  if (start < 0) throw new Error("stages seed not found in db/schema.sql");
  const body = sql.slice(start, sql.indexOf(";", start));

  const row =
    /\('(\d{2})',\s*(\d+),\s*(\d+),\s*'(?:[^']|'')*',\s*(\d+),\s*'\{([^}]*)\}',\s*\w+,\s*\w+,\s*'[A-D]',\s*'\{([^}]*)\}'\)/g;

  const rows: StageInput[] = [];
  for (const m of body.matchAll(row)) {
    rows.push({
      id: m[1]!,
      act: Number(m[2]),
      ordinal: Number(m[3]),
      levels: m[6]!.split(",").map((x) => Number(x.trim())),
    });
  }
  return rows;
}

/** Objectives out of each chapter's front matter, the same subset sync-content reads. */
function parseObjectives(): ObjectiveInput[] {
  const dir = resolve(ROOT, "content", "stages");
  const out: ObjectiveInput[] = [];

  for (const file of readdirSync(dir).filter((f) => /^\d{2}\.md$/.test(f))) {
    const stageId = file.slice(0, 2);
    const raw = readFileSync(resolve(dir, file), "utf8").replace(/\r\n/g, "\n");
    const fm = raw.split("---\n")[1] ?? "";

    // Only the objectives block, and only `- id:` / `level:` within it.
    const objBlock = fm.split(/^objectives:\s*$/m)[1];
    if (!objBlock) continue;

    let currentId: string | null = null;
    for (const line of objBlock.split("\n")) {
      if (/^\S/.test(line)) break; // dedented out of the objectives block
      const id = line.match(/^\s*-\s*id:\s*"?([\w.]+)"?/);
      if (id) {
        currentId = id[1]!;
        continue;
      }
      const level = line.match(/^\s*level:\s*(\d+)/);
      if (level && currentId) {
        out.push({ id: currentId, stageId, level: Number(level[1]) });
        currentId = null;
      }
    }
  }
  return out;
}

const STAGES = parseStages();
const OBJECTIVES = parseObjectives();
const LAYOUT = computeSolarLayout(STAGES, OBJECTIVES);

const planets = () => [...LAYOUT.bodies.values()].filter((b) => b.kind === "planet");
const moons = () => [...LAYOUT.bodies.values()].filter((b) => b.kind === "moon");

/* ---------------------------------------------------------- the parsers */

describe("the parsers themselves", () => {
  it("read real rows, so nothing below passes vacuously on an empty array", () => {
    expect(STAGES, "parsed no stages -- has the seed's column order changed?").toHaveLength(19);
    expect(OBJECTIVES.length, "parsed no objectives -- has the front matter shape changed?")
      .toBe(110);
  });

  it("every objective belongs to a seeded stage", () => {
    const ids = new Set(STAGES.map((s) => s.id));
    for (const o of OBJECTIVES) {
      expect(ids.has(o.stageId), `${o.id} belongs to unseeded stage ${o.stageId}`).toBe(true);
    }
  });

  it("every objective carries exactly one level, 0-6", () => {
    for (const o of OBJECTIVES) {
      expect(o.level, `${o.id} has level ${o.level}`).toBeGreaterThanOrEqual(0);
      expect(o.level).toBeLessThanOrEqual(6);
    }
  });
});

/* -------------------------------------------------------------- INV-32/33 */

describe("INV-32 — no invented or forgotten bodies", () => {
  it("places every stage as a planet, and nothing else", () => {
    expect(planets()).toHaveLength(STAGES.length);
    for (const s of STAGES) {
      expect(LAYOUT.bodies.get(s.id)?.kind, `${s.id} missing`).toBe("planet");
    }
  });

  it("places every objective as a moon, and nothing else — all 110", () => {
    expect(moons()).toHaveLength(OBJECTIVES.length);
    for (const o of OBJECTIVES) {
      const b = LAYOUT.bodies.get(o.id);
      expect(b?.kind, `${o.id} missing`).toBe("moon");
      expect(b?.parentId).toBe(o.stageId);
    }
  });

  it("every moon maps back to a seeded objective", () => {
    const known = new Set(OBJECTIVES.map((o) => o.id));
    for (const m of moons()) expect(known.has(m.id), `${m.id} invented`).toBe(true);
  });

  it("is deterministic, and independent of the order the data arrives in", () => {
    const canon = JSON.stringify([...computeSolarLayout(STAGES, OBJECTIVES).bodies.entries()]);
    const again = JSON.stringify([...computeSolarLayout(STAGES, OBJECTIVES).bodies.entries()]);
    const shuffled = JSON.stringify([
      ...computeSolarLayout([...STAGES].reverse(), [...OBJECTIVES].reverse()).bodies.entries(),
    ]);
    expect(again).toBe(canon);
    expect(shuffled).toBe(canon);
  });
});

/* ------------------------------------------------------------------- F-1 */

describe("F-1 — planet ring is the mean of its moons, with a stated fallback", () => {
  it("puts a planet on the mean of its own moons' levels", () => {
    for (const s of STAGES) {
      const mine = OBJECTIVES.filter((o) => o.stageId === s.id);
      if (mine.length === 0) continue;
      const mean = mine.reduce((a, o) => a + o.level, 0) / mine.length;
      expect(LAYOUT.bodies.get(s.id)!.ring, `stage ${s.id}`).toBeCloseTo(mean, 10);
    }
  });

  it("falls back to min(levels) for a stage with NO objectives — stage 00", () => {
    // Stage 00 is Orientation. It has zero objectives, so the mean is undefined,
    // and it is the first planet a student ever sees. The fallback is stated,
    // not improvised.
    const zeroObjective = STAGES.filter(
      (s) => !OBJECTIVES.some((o) => o.stageId === s.id),
    );
    expect(zeroObjective.map((s) => s.id), "expected exactly stage 00").toEqual(["00"]);

    const stage00 = STAGES.find((s) => s.id === "00")!;
    expect(LAYOUT.bodies.get("00")!.ring).toBe(Math.min(...stage00.levels));
    expect(LAYOUT.bodies.get("00")!.ring).toBe(6);
  });

  it("produces no NaN anywhere, which is what the fallback exists to prevent", () => {
    for (const b of LAYOUT.bodies.values()) {
      for (const v of [b.ring, b.radius, b.angle, b.x, b.y, b.z]) {
        expect(Number.isFinite(v), `${b.id} has a non-finite coordinate`).toBe(true);
      }
    }
  });

  it("records the measured fact this rule rests on: every stage is level-unanimous", () => {
    // If this ever fails, a chapter has been authored with objectives at more
    // than one level -- which is allowed, and would finally make the
    // mean-of-moons rule do something the old min(levels) rule could not.
    // SOLAR-SYSTEM-SPEC.md §1.1 says plainly that it does not happen today.
    for (const s of STAGES) {
      const levels = new Set(
        OBJECTIVES.filter((o) => o.stageId === s.id).map((o) => o.level),
      );
      expect(levels.size, `stage ${s.id} spans levels ${[...levels]}`).toBeLessThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------------------------- F-2 */

describe("F-2 — ring radii are spaced by occupancy", () => {
  it("is STRICTLY monotonic in level — L0 always innermost", () => {
    // The semantic claim the whole map rests on. Distance from the sun is depth
    // into the machine; if this breaks, the map has become decoration.
    for (let l = 1; l < LEVELS.length; l += 1) {
      expect(LAYOUT.ringRadii[l]!, `L${l} vs L${l - 1}`).toBeGreaterThan(LAYOUT.ringRadii[l - 1]!);
    }
  });

  it("counts occupancy from real data — L1 is the crowded one, L4/L5 empty", () => {
    // The measurement that motivated this rule. 7 planets + 43 moons on L1.
    expect(LAYOUT.ringOccupancy[1]).toBe(50);
    expect(LAYOUT.ringOccupancy[4]).toBe(0);
    expect(LAYOUT.ringOccupancy[5]).toBe(0);
    expect(LAYOUT.ringOccupancy.reduce((a, b) => a + b, 0)).toBe(
      STAGES.length + OBJECTIVES.length,
    );
  });

  it("spaces rings on a GROWING curve, not uniform steps", () => {
    // §1.1: each ring out gets proportionally more room than the one inside
    // it, which is what gives the system a sense of scale. Compare the
    // outermost gap against the innermost.
    const r = LAYOUT.ringRadii;
    const innerGap = r[1]! - r[0]!;
    const outerGap = r[6]! - r[5]!;
    expect(outerGap, "outer rings must be further apart than inner ones")
      .toBeGreaterThan(innerGap);
  });

  it("gives the tightest ring more room than even spacing would", () => {
    // The property, not the constants. Even spacing across the SAME total span
    // is the thing being beaten, so the comparison is fair -- this is not just
    // "our rings are bigger".
    const radii = LAYOUT.ringRadii;
    const span = radii[6]! - radii[0]!;
    const even = LEVELS.map((l) => radii[0]! + (span * l) / 6);

    const arcPerBody = (rs: readonly number[]) =>
      LEVELS.filter((l) => LAYOUT.ringOccupancy[l]! > 0).map(
        (l) => (2 * Math.PI * rs[l]!) / LAYOUT.ringOccupancy[l]!,
      );

    const worstOurs = Math.min(...arcPerBody(radii));
    const worstEven = Math.min(...arcPerBody(even));
    expect(worstOurs).toBeGreaterThan(worstEven);
  });

  it("is identical for two students, and takes only the seed it is allowed", () => {
    /*
     * THIS TEST WAS PASSING VACUOUSLY.
     *
     * It asserted `computeSolarLayout.length === 2` under the heading "there is
     * no seed input at all" — and there IS one: `previewSeed = 0`, a third
     * parameter added in R1. `Function.length` ignores parameters with
     * defaults, so it reported 2 and the claim went green while being false.
     *
     * That is the exact trap `cosmetics.spec.ts` already documented for
     * `deriveCosmetics(key, examSalt = "")`, and a defaulted parameter is
     * precisely how an unwanted input actually gets added. Asserted against the
     * SOURCE now, like that one.
     *
     * The seed is permitted, narrowly: it picks which moons preview at overview
     * zoom and nothing else. That it cannot move geometry is asserted over
     * every body in "CANNOT move a single radius or angle" below — this test
     * only pins the SHAPE of the input, so a fourth parameter, or a seed that
     * stops being a plain number, has to argue with a red test.
     */
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "solar-system", "layout.ts"),
      "utf8",
    );
    const sig = src.match(/export function computeSolarLayout\(([\s\S]*?)\)\s*:/);
    expect(sig, "computeSolarLayout signature not found").not.toBeNull();
    // Strip the doc comment first: it sits BETWEEN parameters and contains
    // commas of its own, which split the third parameter into three.
    const params = sig![1]!
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    expect(params, `unexpected parameters: ${params.join(" | ")}`).toHaveLength(3);
    expect(params[0], "first param is the stages").toMatch(/^stages\s*:/);
    expect(params[1], "second param is the objectives").toMatch(/^objectives\s*:/);
    expect(params[2], "third param is a plain, defaulted NUMBER").toMatch(
      /^previewSeed\s*(:\s*number)?\s*=\s*0$/,
    );

    // And the same inputs still give the same map, twice.
    const a = computeSolarLayout(STAGES, OBJECTIVES);
    const b = computeSolarLayout(STAGES, OBJECTIVES);
    expect(a.ringRadii).toEqual(b.ringRadii);
  });
});

describe("§5 — the seeded moon preview subset", () => {
  it("marks roughly one moon in five", () => {
    const preview = moons().filter((m) => m.previewAtOverview);
    // Not exactly a fifth -- it is a hash, not a quota. Wide bounds on
    // purpose: this asserts "a sparse subset", which is the design intent,
    // rather than pinning a hash's exact output.
    expect(preview.length).toBeGreaterThan(OBJECTIVES.length * 0.08);
    expect(preview.length).toBeLessThan(OBJECTIVES.length * 0.4);
  });

  it("is stable for a given seed — a preview set that reshuffles is worse than none", () => {
    const a = computeSolarLayout(STAGES, OBJECTIVES, 12345);
    const b = computeSolarLayout(STAGES, OBJECTIVES, 12345);
    const ids = (l: typeof a) =>
      [...l.bodies.values()].filter((x) => x.previewAtOverview).map((x) => x.id).sort();
    expect(ids(a)).toEqual(ids(b));
  });

  it("actually differs between students", () => {
    const ids = (seed: number) =>
      [...computeSolarLayout(STAGES, OBJECTIVES, seed).bodies.values()]
        .filter((x) => x.previewAtOverview).map((x) => x.id).sort().join(",");
    expect(ids(1)).not.toBe(ids(999));
  });

  it("CANNOT move a single radius or angle — the whole boundary in one test", () => {
    // The cosmetic seed reaches exactly one rendering hint and nothing else.
    // If it ever leaks into geometry, two students get different maps, and the
    // line between "unique game" and "unique exam paper" has been crossed in
    // the direction that matters.
    const a = computeSolarLayout(STAGES, OBJECTIVES, 1);
    const b = computeSolarLayout(STAGES, OBJECTIVES, 999);

    expect(a.ringRadii).toEqual(b.ringRadii);
    expect(a.ringOccupancy).toEqual(b.ringOccupancy);
    for (const [id, body] of a.bodies) {
      const other = b.bodies.get(id)!;
      expect(other.ring, `${id} ring moved`).toBe(body.ring);
      expect(other.radius, `${id} radius moved`).toBe(body.radius);
      expect(other.angle, `${id} angle moved`).toBe(body.angle);
      expect([other.x, other.y, other.z], `${id} position moved`).toEqual([body.x, body.y, body.z]);
    }
  });
});

/* ------------------------------------------------------------------- F-3 */

describe("F-3 — angle sweeps ~300°, leaving a visible gap", () => {
  it("puts the largest angular gap between the last stage and the first", () => {
    // A chain with no forks and no return must not be drawn as a closed ring.
    const ordered = [...STAGES].sort((a, b) => a.ordinal - b.ordinal);
    const angles = ordered.map((s) => LAYOUT.bodies.get(s.id)!.angle);

    const consecutive: number[] = [];
    for (let i = 1; i < angles.length; i += 1) consecutive.push(angles[i]! - angles[i - 1]!);
    const closingGap = 2 * Math.PI - (angles.at(-1)! - angles[0]!);

    expect(closingGap).toBeGreaterThan(Math.max(...consecutive));
  });

  it("sweeps 300°, not 360°", () => {
    const first = angleForOrdinal(0, 19);
    const last = angleForOrdinal(18, 19);
    expect(((last - first) * 180) / Math.PI).toBeCloseTo(300, 6);
  });

  it("advances monotonically with curriculum order", () => {
    const ordered = [...STAGES].sort((a, b) => a.ordinal - b.ordinal);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(LAYOUT.bodies.get(ordered[i]!.id)!.angle).toBeGreaterThan(
        LAYOUT.bodies.get(ordered[i - 1]!.id)!.angle,
      );
    }
  });

  it("survives degenerate inputs without dividing by zero", () => {
    expect(Number.isFinite(angleForOrdinal(0, 1))).toBe(true);
    expect(Number.isFinite(angleForOrdinal(0, 0))).toBe(true);
  });
});

/* ------------------------------------------------------------------- F-4 */

describe("F-4 — a stage about the hierarchy still says so", () => {
  it("flags stage 01, which declares all seven levels", () => {
    expect(LAYOUT.bodies.get("01")!.spansAllLevels).toBe(true);
  });

  it("flags ONLY stage 01 — the comment naming 06 and 11 is stale", () => {
    // Those two spanned every level under the SUPERSEDED 17-chapter curriculum.
    // Under the real seed, 06 declares {3} and 11 declares {2}.
    const spanning = planets().filter((p) => p.spansAllLevels).map((p) => p.id);
    expect(spanning).toEqual(["01"]);
  });

  it("keeps stage 01 placed as well as flagged, so the renderer has both facts", () => {
    // Its objectives are all level 6, so mean-of-moons alone would collapse it
    // to an ordinary point on the outermost ring and lose the span entirely.
    const p = LAYOUT.bodies.get("01")!;
    expect(p.ring).toBe(6);
    expect(Number.isFinite(p.radius)).toBe(true);
  });
});

/* ------------------------------------------------------- shape and moons */

describe("the shape the data actually makes", () => {
  it("keeps moons with their planet, not at their own distance from the sun", () => {
    // A moon's `ring` records its objective's real level -- that is what the
    // flat map and the screen-reader list read. But since a stage's objectives
    // all sit at the stage's own level, placing a moon at that radius from the
    // sun would drop it exactly on top of its parent. Moons orbit planets.
    for (const m of moons()) {
      const parent = LAYOUT.bodies.get(m.parentId!)!;
      const d = Math.hypot(m.x - parent.x, m.z - parent.z);
      expect(d, `${m.id} is not near ${m.parentId}`).toBeGreaterThan(0);
      expect(d).toBeLessThan(2);
    }
  });

  it("gives stage 03 its eleven moons — the most crowded planet", () => {
    expect(moons().filter((m) => m.parentId === "03")).toHaveLength(11);
  });

  it("gives stage 00 none, and does not crash doing it", () => {
    expect(moons().filter((m) => m.parentId === "00")).toHaveLength(0);
  });

  it("never places two bodies at exactly the same point", () => {
    const seen = new Set(
      [...LAYOUT.bodies.values()].map((b) => `${b.x.toFixed(6)},${b.z.toFixed(6)}`),
    );
    expect(seen.size).toBe(LAYOUT.bodies.size);
  });

  it("records the honest ring sequence: 12 crossings, 9 reversals", () => {
    // SOLAR-SYSTEM-SPEC.md §1.3 originally claimed 13 crossings and opened the
    // sequence 6,6,... by assuming a stage 00 value the rule never defined.
    // This is the corrected count, asserted so the doc cannot drift from it.
    const path = flightPath(LAYOUT, STAGES);
    const rings = path.map((b) => b.ring);

    let crossings = 0;
    const directions: number[] = [];
    for (let i = 1; i < rings.length; i += 1) {
      const delta = rings[i]! - rings[i - 1]!;
      if (delta !== 0) {
        crossings += 1;
        directions.push(Math.sign(delta));
      }
    }
    let reversals = 0;
    for (let i = 1; i < directions.length; i += 1) {
      if (directions[i] !== directions[i - 1]) reversals += 1;
    }

    expect(crossings).toBe(12);
    expect(reversals).toBe(9);
  });

  it("records that stages 12-16 run flat along L1 — the last third does not corkscrew", () => {
    // The awkward shape fact. F-2's spacing is what has to make this legible;
    // the fix is never to nudge one of these off its ring.
    for (const id of ["12", "13", "14", "15", "16"]) {
      expect(LAYOUT.bodies.get(id)!.ring, `stage ${id}`).toBe(1);
    }
  });

  it("walks the flight path in curriculum order, all 19 stages", () => {
    const path = flightPath(LAYOUT, STAGES);
    expect(path).toHaveLength(19);
    expect(path[0]!.id).toBe("00");
    expect(path.at(-1)!.id).toBe("18");
  });
});

describe("level naming", () => {
  it("names all seven levels, L0 innermost", () => {
    expect(LEVELS).toHaveLength(7);
    for (const l of LEVELS) expect(LEVEL_NAMES[l], `L${l} has no name`).toBeTruthy();
    expect(LEVELS[0]).toBe(0);
    expect(LEVELS.at(-1)).toBe(6);
    expect(LEVEL_NAMES[0]).toBe("Digital Logic");
    expect(LEVEL_NAMES[6]).toBe("User");
  });
});
