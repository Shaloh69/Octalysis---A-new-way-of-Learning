/**
 * Which ring a stage sits on: the mean of its own moons' levels (objectives
 * each carry exactly one level). F-1, the one case that is not that: a stage
 * with no objectives (Orientation) has no mean, so it takes the lowest level it
 * declares. Shared by the map's layout and the world a student enters
 * (`world.ts`), so the two can never place a planet differently.
 */
export function stageRing(levels: readonly number[], moonLevels: readonly number[]): number {
  if (moonLevels.length === 0) return Math.min(...levels);
  return moonLevels.reduce((sum, l) => sum + l, 0) / moonLevels.length;
}
