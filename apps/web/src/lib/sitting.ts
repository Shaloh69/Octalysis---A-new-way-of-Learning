import { useSyncExternalStore } from "react";

/**
 * Is a paper being sat right now? (Instructor ruling 3, 30 Sep 2026;
 * `docs/redesign/WEB-REMAKE.md` §4a.)
 *
 * From Start to Submit a check or exam has no way back: the shell hides Leave
 * planet and the Reading tab and drops their shortcuts, and the runner holds
 * the browser's Back. The runner is the only writer; the shell reads it. It is
 * mirrored to `<html data-sitting>` so a stylesheet can see it too.
 */
let sitting = false;
const listeners = new Set<() => void>();

export function setSitting(on: boolean): void {
  if (sitting === on) return;
  sitting = on;
  if (on) document.documentElement.setAttribute("data-sitting", "");
  else document.documentElement.removeAttribute("data-sitting");
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSitting(): boolean {
  return useSyncExternalStore(subscribe, () => sitting, () => false);
}

/** Can this device put the page in full screen? An iPhone cannot. */
export function fullscreenSupported(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true && !!document.documentElement.requestFullscreen;
}

export function inFullscreen(): boolean {
  return typeof document !== "undefined" && !!document.fullscreenElement;
}

/** Ask for full screen. Must run inside the click that asked for it. */
export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported()) return false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function leaveFullscreen(): Promise<void> {
  if (inFullscreen()) await document.exitFullscreen().catch(() => {});
}
