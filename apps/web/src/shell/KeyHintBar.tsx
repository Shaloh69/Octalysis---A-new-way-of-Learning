import { useAllKeyHints, useShortcutsOn } from "./keyHints";

/**
 * The key-hint bar (WEB-REMAKE.md §2, Starfield's): bottom-right at 1440, one
 * button per hint, its key on a cap beside the words. Pressing the button and
 * pressing the key are the same action. Hidden on a phone, where there are no
 * keys and the bottom of the screen is the nav's. When the student has turned
 * single-key shortcuts off (Settings), the caps go and the buttons stay.
 */
export function KeyHintBar({ dress }: { dress: "hud" | "sprite" }): JSX.Element | null {
  const hints = useAllKeyHints();
  const on = useShortcutsOn();
  if (hints.length === 0) return null;
  return (
    <div
      className={`keyhints keyhints-${dress}${dress === "sprite" ? " sprite-bar" : ""}`}
      role="group"
      aria-label="Shortcuts"
    >
      {hints.map((h) => (
        <button
          key={`${h.key}-${h.label}`}
          type="button"
          className="keyhint"
          onClick={h.run}
          aria-keyshortcuts={on || h.key.length > 1 ? h.key : undefined}
        >
          <span className="keyhint-label">{h.label}</span>
          {(on || h.key.length > 1) && (
            <kbd className="keyhint-cap" aria-hidden="true">
              {h.cap}
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
}
