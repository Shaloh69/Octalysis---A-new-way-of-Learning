import { describe, it, expect } from "vitest";
import { classifyKey, isTyping, makeDebounce, narrowed, type KeyLike } from "../src/lib/sitting-guards";

const k = (key: string, o: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...o });

describe("the keys a paper watches for (docs/ANTI-CHEAT.md)", () => {
  it("the Windows and Command keys, alone or in a chord, are a system key", () => {
    expect(classifyKey(k("Meta"), false)?.kind).toBe("system_key");
    expect(classifyKey(k("OS"), false)?.kind).toBe("system_key");
    expect(classifyKey(k("ArrowLeft", { metaKey: true, ctrlKey: true }), false)?.kind).toBe("system_key"); // Ctrl+Win+Left: desktops
    expect(classifyKey(k("d", { metaKey: true }), false)?.kind).toBe("system_key");
  });

  it("Alt+Tab and Alt+Esc are a system key; Tab on its own is not (it is how a keyboard student moves)", () => {
    expect(classifyKey(k("Tab", { altKey: true }), false)?.kind).toBe("system_key");
    expect(classifyKey(k("Escape", { altKey: true }), false)?.kind).toBe("system_key");
    expect(classifyKey(k("Tab"), false), "plain Tab is accessibility").toBeNull();
    expect(classifyKey(k("Tab", { shiftKey: true }), false)).toBeNull();
  });

  it("desktop-switching chords: Ctrl+Alt+Arrow always; Ctrl+Arrow only outside a text field", () => {
    expect(classifyKey(k("ArrowRight", { ctrlKey: true, altKey: true }), true)?.kind).toBe("system_key");
    expect(classifyKey(k("ArrowRight", { ctrlKey: true }), false)?.kind).toBe("system_key");
    expect(classifyKey(k("ArrowRight", { ctrlKey: true }), true), "a word jump in an answer field").toBeNull();
    expect(classifyKey(k("ArrowRight"), false), "plain arrows move through options").toBeNull();
  });

  it("PrintScreen is a system key", () => {
    expect(classifyKey(k("PrintScreen"), false)?.kind).toBe("system_key");
  });

  it("copy, cut, paste, print, save, view source, the developer tools and the context menu are refused and recorded", () => {
    for (const e of [
      k("c", { ctrlKey: true }), k("x", { ctrlKey: true }), k("v", { ctrlKey: true }),
      k("p", { ctrlKey: true }), k("s", { ctrlKey: true }), k("u", { ctrlKey: true }),
      k("F12"), k("I", { ctrlKey: true, shiftKey: true }), k("J", { ctrlKey: true, shiftKey: true }),
      k("ContextMenu"),
    ]) {
      const v = classifyKey(e, false);
      expect(v?.kind, e.key).toBe("blocked_action");
      expect(v && "block" in v && v.block, e.key).toBe(true);
    }
  });

  it("ordinary typing, digits and Enter are never touched", () => {
    for (const key of ["a", "7", "Enter", " ", "Backspace", "Shift", "Control", "Alt"]) {
      expect(classifyKey(k(key), true), key).toBeNull();
    }
  });
});

describe("a narrowed window and a repeated report", () => {
  it("a split screen narrows the window; a few pixels do not", () => {
    expect(narrowed(1440, 700)).toBe(true);
    expect(narrowed(1440, 1400)).toBe(false);
    expect(narrowed(0, 100), "no starting width, no claim").toBe(false);
  });

  it("the same report inside the window is one fact; another kind, or later, is another", () => {
    let t = 0;
    const once = makeDebounce(1000, () => t);
    expect(once("system_key")).toBe(true);
    t = 500;
    expect(once("system_key")).toBe(false);
    expect(once("lost_focus")).toBe(true);
    t = 1600;
    expect(once("system_key")).toBe(true);
  });
});

describe("what counts as typing", () => {
  // The suite runs without a DOM, so these are the few properties isTyping reads.
  const el = (tagName: string, type?: string) => ({ tagName, type, isContentEditable: false }) as unknown as Element;
  it("a text input and a textarea do; a button, a checkbox and nothing do not", () => {
    expect(isTyping(el("INPUT", "text"))).toBe(true);
    expect(isTyping(el("TEXTAREA"))).toBe(true);
    expect(isTyping(el("INPUT", "checkbox"))).toBe(false);
    expect(isTyping(el("INPUT", "radio"))).toBe(false);
    expect(isTyping(el("BUTTON"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
