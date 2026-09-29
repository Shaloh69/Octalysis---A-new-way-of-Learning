import type { StageNode } from "./api";

/**
 * What the map's card names: "what do I do next" (`WEB-REVAMP.md` §2).
 *
 * The SERVER decides every state here (hard rule 4); this only chooses which
 * of the server's answers to put first, in curriculum order:
 *
 *   1. the first stage in progress: "Pick up where you left off"
 *   2. else the first open one not started: "Next up"
 *   3. else, if nothing is open and something is locked: the first lock, whose
 *      reason the card prints verbatim
 *   4. else everything is mastered (or nothing is published)
 *
 * Instructor ruling, 29 Sep 2026: the server chooses the stage, and the device
 * adds only where the reader was (`octa:reader:<id>`), never which stage.
 */
export type Next =
  | { kind: "resume"; node: StageNode }
  | { kind: "start"; node: StageNode }
  | { kind: "blocked"; node: StageNode }
  | { kind: "done" }
  | { kind: "none" };

export function nextStage(nodes: readonly StageNode[]): Next {
  if (nodes.length === 0) return { kind: "none" };
  const ordered = [...nodes].sort((a, b) => a.ordinal - b.ordinal);
  const going = ordered.find((n) => n.state === "in_progress");
  if (going) return { kind: "resume", node: going };
  const open = ordered.find((n) => n.state === "available");
  if (open) return { kind: "start", node: open };
  const shut = ordered.find((n) => n.state === "locked");
  if (shut) return { kind: "blocked", node: shut };
  return { kind: "done" };
}
