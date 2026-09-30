import type { ComponentType } from "react";

/**
 * Which moon carries which encounter (WEB-REVAMP 3.6; approved by the
 * instructor, 30 Sep 2026). A minigame belongs to the subtopic it exercises,
 * and every other moon's journey is its practice alone.
 *
 * Each entry names the game (the moon panel prints it, 3.2 item 3) and LOADS
 * it lazily: no encounter's code reaches the initial bundle or the map, only
 * the journey of the moon that carries it (GAME-DESIGN.md §10.2).
 */
export interface MoonEncounter {
  /** The game's name, as the moon panel and the journey say it. */
  name: string;
  /** The archetype beat it is (GAME-DESIGN.md §10.3). */
  kind: "Sort" | "Drill" | "Cache drill" | "Bus wiring";
  load: () => Promise<{ default: ComponentType }>;
}

export const MOON_ENCOUNTERS: Record<string, MoonEncounter> = {
  "01.2": { name: "Two Columns", kind: "Sort", load: () => import("./TwoColumns") },
  "02.8": { name: "Clock Bench", kind: "Drill", load: () => import("./ClockBench") },
  "04.5": { name: "Cache Tuner", kind: "Cache drill", load: () => import("./CacheTuner") },
};

export function encounterForMoon(objectiveId: string): MoonEncounter | null {
  return MOON_ENCOUNTERS[objectiveId] ?? null;
}
