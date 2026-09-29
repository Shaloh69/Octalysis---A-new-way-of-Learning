import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * The key-hint bar's model (WEB-REMAKE.md §2): every hint is a REAL keyboard
 * shortcut and a REAL button that does the same thing. A hint that does nothing
 * fails the mandate's consequence test and is not registered.
 *
 * Shortcuts are single characters, which WCAG 2.1.4 (Character Key Shortcuts)
 * allows only if the student can turn them off: `/app/settings` does, and when
 * they are off the buttons remain and the keys do nothing. They never fire
 * while typing in a field, or with a modifier held (so the browser's and the
 * screen reader's own keys are never taken).
 */
export interface KeyHint {
  /** The key as `KeyboardEvent.key`, compared case-insensitively. */
  readonly key: string;
  /** What the key says on its cap. */
  readonly cap: string;
  readonly label: string;
  readonly run: () => void;
}

const STORAGE = "octa:shortcuts";

/** Are single-key shortcuts on? A per-browser convenience, nothing gradeable. */
export function shortcutsOn(): boolean {
  try {
    return localStorage.getItem(STORAGE) !== "off";
  } catch {
    return true;
  }
}

export function setShortcutsOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(STORAGE);
    else localStorage.setItem(STORAGE, "off");
  } catch {
    /* private window: the setting lasts this page only */
  }
  window.dispatchEvent(new Event(STORAGE));
}

interface HintRegistry {
  hints: KeyHint[];
  register: (id: string, hints: KeyHint[]) => void;
  unregister: (id: string) => void;
}

const Ctx = createContext<HintRegistry>({ hints: [], register: () => {}, unregister: () => {} });

export function KeyHintProvider({ children }: { children: ReactNode }): JSX.Element {
  const [byOwner, setByOwner] = useState<Record<string, KeyHint[]>>({});
  const register = useCallback((id: string, hints: KeyHint[]) => {
    setByOwner((prev) => ({ ...prev, [id]: hints }));
  }, []);
  const unregister = useCallback((id: string) => {
    setByOwner((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  // The page's own hints first, the shell's after them, as Starfield orders them.
  const hints = useMemo(
    () => Object.entries(byOwner).sort(([a], [b]) => (a === "shell" ? 1 : b === "shell" ? -1 : 0)).flatMap(([, h]) => h),
    [byOwner],
  );

  const latest = useRef(hints);
  latest.current = hints;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Never while typing: a text field, a text area, a select, an editable.
      // A radio or a checkbox takes no text, so the map's row of planets keeps
      // Enter journey and Close.
      const typing =
        !!t &&
        (t.isContentEditable ||
          /^(TEXTAREA|SELECT)$/.test(t.tagName) ||
          (t instanceof HTMLInputElement && !/^(radio|checkbox|button|submit|reset)$/.test(t.type)));
      if (typing) return;
      if (t?.closest("[role=dialog], [role=radiogroup]")) return;
      const single = e.key.length === 1;
      if (single && !shortcutsOn()) return;
      const hit = latest.current.find((h) => h.key.toLowerCase() === e.key.toLowerCase());
      if (!hit) return;
      // Enter and Escape belong to whatever has focus when it is a control.
      if ((e.key === "Enter" || e.key === " ") && t && t.closest("a, button, [role=button]")) return;
      e.preventDefault();
      hit.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <Ctx.Provider value={{ hints, register, unregister }}>{children}</Ctx.Provider>;
}

/** Register this component's hints for as long as it is mounted. */
export function useKeyHints(owner: string, hints: KeyHint[]): void {
  const { register, unregister } = useContext(Ctx);
  const signature = hints.map((h) => `${h.key}:${h.label}`).join("|");
  const latest = useRef(hints);
  latest.current = hints;
  useEffect(() => {
    // Wrap `run` so the registry never holds a stale closure.
    register(
      owner,
      latest.current.map((h, i) => ({ ...h, run: () => latest.current[i]?.run() })),
    );
    return () => unregister(owner);
  }, [owner, signature, register, unregister]);
}

export function useAllKeyHints(): KeyHint[] {
  return useContext(Ctx).hints;
}

/** Re-render when the shortcuts setting changes. */
export function useShortcutsOn(): boolean {
  const [on, setOn] = useState(shortcutsOn);
  useEffect(() => {
    const f = () => setOn(shortcutsOn());
    window.addEventListener(STORAGE, f);
    return () => window.removeEventListener(STORAGE, f);
  }, []);
  return on;
}
