import type { AttemptEventKind } from "@octa/contracts";

/**
 * What the page can SEE of someone working around a paper (docs/ANTI-CHEAT.md, 15 Oct 2026; instructor: detect
 * the Windows key, Ctrl and the arrow keys, switching desktops). Pure functions, so each rule is a test.
 *
 * Honest limits, because a guard that claims more than it can do is worse than none:
 *   - A web page is never told that the OS switched virtual desktops. What it sees is its OWN window losing focus
 *     or being hidden (`blur`, `visibilitychange`), which AttemptRunner already covers and records; the keys here
 *     are the earlier warning, when the browser delivers them.
 *   - The Windows key and Alt+Tab are usually taken by the OS before the page. In full screen, Chrome and Edge
 *     can be asked to pass them on (the Keyboard Lock API, `lockKeys` below); elsewhere the page only learns
 *     afterwards that it lost focus.
 *   - A phone has no such keys. It has app switches (`visibilitychange`), split screen and floating windows
 *     (the window's width collapses), and a second tab: all of which are recorded.
 * Everything here is a FACT written to `attempt_events` for the instructor to read; none is a verdict.
 */

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type KeyVerdict =
  | { kind: "system_key"; why: string }
  | { kind: "blocked_action"; why: string; block: true }
  | null;

const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/**
 * Classify one keydown. `typing` is true when focus is in a field that takes text: Ctrl+Arrow is a word jump
 * there and means nothing else.
 */
export function classifyKey(e: KeyLike, typing: boolean): KeyVerdict {
  // The Windows key (Windows reports "Meta"; some browsers "OS") and the Command key.
  if (e.key === "Meta" || e.key === "OS") return { kind: "system_key", why: "the Windows or Command key" };
  if (e.metaKey) return { kind: "system_key", why: "a Windows or Command key chord" };
  // Alt+Tab, and Alt+Esc.
  if (e.altKey && (e.key === "Tab" || e.key === "Escape")) return { kind: "system_key", why: "Alt+Tab or Alt+Esc" };
  // Ctrl+Alt+Arrow: virtual desktops on some Linux and Windows set-ups. Ctrl+Arrow alone moves Spaces on a Mac,
  // and is a word jump in a text field.
  if (ARROWS.has(e.key) && e.ctrlKey && e.altKey) return { kind: "system_key", why: "a desktop-switching chord" };
  if (ARROWS.has(e.key) && e.ctrlKey && !typing) return { kind: "system_key", why: "Ctrl and an arrow (desktop switching)" };
  if (e.key === "PrintScreen" || e.code === "PrintScreen") return { kind: "system_key", why: "PrintScreen" };

  // Refused outright, and recorded.
  const k = e.key.toLowerCase();
  if (e.key === "F12") return { kind: "blocked_action", why: "the developer tools", block: true };
  if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
    return { kind: "blocked_action", why: "the developer tools", block: true };
  }
  if (e.ctrlKey && (k === "u" || k === "p" || k === "s")) {
    return { kind: "blocked_action", why: "view source, print or save", block: true };
  }
  if (e.ctrlKey && (k === "c" || k === "x" || k === "v")) {
    return { kind: "blocked_action", why: "copy, cut or paste", block: true };
  }
  if (e.key === "ContextMenu") return { kind: "blocked_action", why: "the context menu", block: true };
  return null;
}

/** Is focus in something that takes typed text? */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "TEXTAREA" || (tag === "INPUT" && !["button", "checkbox", "radio", "submit"].includes((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable === true;
}

/**
 * Has the window narrowed enough to be a split screen or a floating window? Width only: a phone's keyboard shrinks
 * the HEIGHT, and rotating it swaps the two, which the caller discounts by checking orientation too.
 */
export function narrowed(startWidth: number, nowWidth: number, ratio = 0.75): boolean {
  return startWidth > 0 && nowWidth < startWidth * ratio;
}

/** Does this browser report a second screen? (Chrome and Edge, no permission.) */
export function hasSecondScreen(): boolean {
  return typeof window !== "undefined" && (window.screen as Screen & { isExtended?: boolean }).isExtended === true;
}

/** The keys to ask the browser to pass to the page in full screen (Keyboard Lock; Chrome and Edge only). */
export const LOCK_KEYS = ["MetaLeft", "MetaRight", "AltLeft", "AltRight", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "ControlLeft", "ControlRight"] as const;

interface KeyboardWithLock {
  lock?: (codes?: readonly string[]) => Promise<void>;
  unlock?: () => void;
}

/** Best effort and silent where unsupported: returns whether the browser accepted the lock. */
export async function lockKeys(): Promise<boolean> {
  const kb = (typeof navigator !== "undefined" ? (navigator as Navigator & { keyboard?: KeyboardWithLock }).keyboard : undefined);
  if (!kb?.lock) return false;
  try {
    await kb.lock(LOCK_KEYS);
    return true;
  } catch {
    return false;
  }
}

export function unlockKeys(): void {
  const kb = (typeof navigator !== "undefined" ? (navigator as Navigator & { keyboard?: KeyboardWithLock }).keyboard : undefined);
  try {
    kb?.unlock?.();
  } catch {
    /* nothing to release */
  }
}

/** The same report twice in a moment is one fact: a held key repeats, a blur and a visibility change arrive together. */
export function makeDebounce(ms: number, now: () => number = Date.now): (kind: AttemptEventKind) => boolean {
  const last = new Map<AttemptEventKind, number>();
  return (kind) => {
    const t = now();
    const prev = last.get(kind);
    if (prev !== undefined && t - prev < ms) return false;
    last.set(kind, t);
    return true;
  };
}
