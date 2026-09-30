import { describe, it, expect } from "vitest";
import { nextStage } from "../src/lib/next-stage";
import type { StageNode } from "../src/lib/api";

/**
 * The map card's choice. Every state is the server's; this only orders them.
 * Shapes follow `232129006` on the seed: 00 open, 01-04 locked, 05 mastered,
 * 06 in progress.
 */

const node = (id: string, ordinal: number, state: StageNode["state"]): StageNode => ({
  id,
  act: 1,
  ordinal,
  title: `Stage ${id}`,
  summary: null,
  estMinutes: 30,
  archetype: "A",
  levels: [6],
  gradeable: true,
  published: true,
  prereq: [],
  blockCount: 1,
  objectives: [],
  moons: { mastered: 0, total: 0 },
  state,
  mastery: state === "in_progress" ? 0.4 : 0,
  lockReason: null,
});

describe("nextStage", () => {
  it("a stage in progress comes first, even after an open one", () => {
    const n = nextStage([node("00", 0, "available"), node("05", 5, "mastered"), node("06", 6, "in_progress")]);
    expect(n).toMatchObject({ kind: "resume", node: { id: "06" } });
  });

  it("the first in progress, in curriculum order, not array order", () => {
    const n = nextStage([node("09", 9, "in_progress"), node("03", 3, "in_progress")]);
    expect(n).toMatchObject({ kind: "resume", node: { id: "03" } });
  });

  it("nothing in progress: the first open stage", () => {
    const n = nextStage([node("02", 2, "available"), node("00", 0, "mastered"), node("01", 1, "available")]);
    expect(n).toMatchObject({ kind: "start", node: { id: "01" } });
  });

  it("nothing open: the first lock, so the card can print its reason", () => {
    const n = nextStage([node("01", 1, "locked"), node("00", 0, "mastered"), node("02", 2, "locked")]);
    expect(n).toMatchObject({ kind: "blocked", node: { id: "01" } });
  });

  it("everything mastered, and nothing published, are different answers", () => {
    expect(nextStage([node("00", 0, "mastered")])).toEqual({ kind: "done" });
    expect(nextStage([])).toEqual({ kind: "none" });
  });
});
