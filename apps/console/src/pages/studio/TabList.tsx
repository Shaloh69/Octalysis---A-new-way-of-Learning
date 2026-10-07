import { useRef } from "react";

/**
 * A tablist after the WAI-ARIA pattern: the selected tab is the one Tab stop,
 * arrows move between tabs (and select), Home and End go to the ends. The
 * Studio's right sidebar uses it for Outline and AI Assistant.
 */
export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A word beside the label when something there needs reading ("to review"). */
  note?: string | undefined;
}

export function TabList<T extends string>({ tabs, tab, onTab, label, prefix }: {
  tabs: readonly TabItem<T>[];
  tab: T;
  onTab: (t: T) => void;
  label: string;
  /** Ids are `${prefix}-tab-${id}` and `${prefix}-panel-${id}`. */
  prefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: React.KeyboardEvent, i: number) {
    const to = e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = tabs[to]!;
    onTab(next.id);
    refs.current[next.id]?.focus();
  }
  return (
    <div className="st-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          type="button"
          role="tab"
          id={`${prefix}-tab-${t.id}`}
          aria-selected={t.id === tab}
          aria-controls={`${prefix}-panel-${t.id}`}
          tabIndex={t.id === tab ? 0 : -1}
          className="st-tab"
          data-tab={t.id}
          onClick={() => onTab(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.note ? <span className="st-tab-note">{t.note}</span> : null}
        </button>
      ))}
    </div>
  );
}
