import { useSyncExternalStore } from "react";
import { currentToasts, dismissToast, subscribeToasts } from "../lib/toast";

/**
 * Where toasts render: bottom-right at 1440, full width at the foot at 380.
 * Mounted once, in `App.tsx` at the app root, so every route shares it.
 */
export function Toaster(): JSX.Element {
  const list = useSyncExternalStore(subscribeToasts, currentToasts);

  return (
    <div data-toaster="" className="toaster" aria-label="Notifications">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`toast toast-${t.tone}`}
        >
          <span className="toast-mark" aria-hidden="true">
            {t.tone === "error" ? "!" : "✓"}
          </span>
          <div className="toast-text">
            <p className="toast-title">{t.title}</p>
            {t.body ? <p className="toast-body">{t.body}</p> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
