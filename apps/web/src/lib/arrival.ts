import { useSyncExternalStore } from "react";

/**
 * Which planet or moon a student has just TRAVELLED to (instructor, 2 Oct
 * 2026: after the warp, an arrival screen). `RealmWarp` marks it when the realm
 * changes from the star system to a biome, the same moment it warps (or would,
 * under reduced motion); a deep link or a reload marks nothing, because nothing
 * was travelled. `BiomeShell` shows the screen while the mark matches the path,
 * and clears it when the student dismisses it or it clears itself.
 *
 * A module-level value, not context: the warp sits above the signed-in shell
 * that has the stage data, and this is the one fact the two share.
 */
let arrived: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function markArrival(pathname: string): void {
  arrived = pathname;
  emit();
}

export function clearArrival(): void {
  if (arrived === null) return;
  arrived = null;
  emit();
}

export function useArrival(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => arrived,
    () => null,
  );
}
