/**
 * Deterministic layout for the stage map.
 *
 * SKILL-TREE-3D.md §3 argues against a force-directed graph library here, and
 * this file is the alternative: 18 nodes, positions computed once from data that
 * already exists, pure and unit-testable.
 *
 * A force simulation would rearrange the map between sessions, which destroys
 * the spatial memory that makes a map worth having, and it cannot honour the
 * axis meanings below because the simulation decides positions, not semantics.
 *
 * The spatial grammar (SKILL-TREE-3D.md §2) is the whole reason this passes the
 * design mandate's teaching test rather than being decoration:
 *
 *   Y  the Computer Level Hierarchy, L6 at the top down to L0
 *   X  progress along the critical path, derived from ordinal
 *   Z  the act, which becomes a spiral arm in the 3D layer
 *
 * Descending the map and descending the abstraction hierarchy are the same
 * motion. That is the point.
 */

export interface LayoutInput {
  readonly id: string;
  readonly act: number;
  readonly ordinal: number;
  readonly levels: number[];
}

export interface NodePosition {
  readonly id: string;
  /** 2D, in an abstract unit grid. The SVG scales these. */
  readonly x: number;
  readonly y: number;
  /** 3D, for the galaxy layer. */
  readonly x3: number;
  readonly y3: number;
  readonly z3: number;
  /** The level this node sits at, or null when it spans all seven. */
  readonly level: number | null;
  /** True for stages that are ABOUT the hierarchy rather than sitting in it. */
  readonly spansAllLevels: boolean;
}

/** Levels 0..6; L6 (user level) renders at the top, L0 (gates) at the bottom. */
export const LEVELS = [6, 5, 4, 3, 2, 1, 0] as const;

export const LEVEL_NAMES: Record<number, string> = {
  6: "User",
  5: "High-Level Language",
  4: "Assembly Language",
  3: "System Software",
  2: "Machine / ISA",
  1: "Control",
  0: "Digital Logic",
};

const ROW_HEIGHT = 90;
const COL_WIDTH = 128;

/**
 * A stage that declares every level is not AT a level -- it is about the
 * hierarchy itself. Stages 06 and 11 are the two, and they render as columns
 * crossing every stratum rather than as points.
 */
function representativeLevel(levels: number[]): { level: number | null; spans: boolean } {
  if (levels.length >= 7) return { level: null, spans: true };
  if (levels.length === 0) return { level: 6, spans: false };
  // The DEEPEST level the stage touches. A stage that reaches L0 belongs at L0
  // on a map whose vertical axis means depth.
  return { level: Math.min(...levels), spans: false };
}

export function computeLayout(stages: readonly LayoutInput[]): Map<string, NodePosition> {
  const sorted = [...stages].sort((a, b) => a.ordinal - b.ordinal);
  const out = new Map<string, NodePosition>();

  // Stages that land on the same level would otherwise overlap, so each level
  // keeps its own column cursor.
  const usedPerRow = new Map<number, number>();

  for (const s of sorted) {
    const { level, spans } = representativeLevel(s.levels);
    const rowKey = level ?? 99;
    const row = LEVELS.indexOf((level ?? 6) as (typeof LEVELS)[number]);

    // X follows the ordinal so the critical path reads left to right, but nudged
    // so two stages on the same level never collide.
    const lastCol = usedPerRow.get(rowKey);
    let col = s.ordinal;
    if (lastCol !== undefined && col <= lastCol) col = lastCol + 1;
    usedPerRow.set(rowKey, col);

    const x = col * COL_WIDTH;
    const y = (spans ? 3 : row) * ROW_HEIGHT;

    // 3D: the act becomes an angle, so the four acts read as four arms.
    const armAngle = ((s.act - 1) / 4) * Math.PI * 2;
    const radius = 6 + s.ordinal * 1.6;

    out.set(s.id, {
      id: s.id,
      x,
      y,
      x3: Math.cos(armAngle) * radius,
      // Y in 3D is depth: L6 high, L0 low. Negative so "down" is deeper.
      y3: ((level ?? 3) - 3) * 3.2,
      z3: Math.sin(armAngle) * radius,
      level,
      spansAllLevels: spans,
    });
  }

  return out;
}

/** Bounding box of a layout, for sizing an SVG viewBox. */
export function layoutBounds(positions: Map<string, NodePosition>): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  const values = [...positions.values()];
  if (values.length === 0) return { width: 0, height: 0, minX: 0, minY: 0 };
  const xs = values.map((p) => p.x);
  const ys = values.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}
