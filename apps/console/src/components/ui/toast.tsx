import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toasts — the console's confirmation that a server-side change happened.
 *
 * `.claude/rules/design.md`: there was NO toast system. `AppShell` reserved a
 * `z-toast` layer that nothing rendered into. This is that component, built
 * first for `/items` and mounted once, in `App.tsx` at the app root, so every
 * route shares it -- including `/signin` and the two gate screens, which render
 * outside `AppShell`. (It lived in the shell until the `/signin` rebuild.)
 *
 * The rules it enforces rather than asks for:
 *
 * - **What happened to what.** `toast.success("01-arch-definition approved")`,
 *   never "Success". The API takes a sentence, not a status.
 * - **Successes leave after ~4s; failures stay until dismissed.** A failure
 *   states the next move, and a message that vanishes on a timer takes the
 *   next move with it.
 * - **`role="status"` for success, `role="alert"` for failure**, per toast.
 * - **Bottom-right at desktop, full-width bottom at 380**, above the fold, and
 *   never over the control that triggered it (pages with a bottom-anchored
 *   control keep it clear; `/items` lifts its dialogs at 380 for this).
 *
 * `danger` is for failed STAFF actions only. This component is never used to
 * tell a student they were wrong.
 *
 * A module store rather than a React context: a toast is raised from event
 * handlers all over the app, and a provider would have to wrap every one.
 */

type Tone = "success" | "error";

export interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string | undefined;
}

const SUCCESS_MS = 4_000;
const MAX_SHOWN = 4;

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function push(tone: Tone, title: string, body?: string): number {
  const id = ++seq;
  toasts = [...toasts, { id, tone, title, body }].slice(-MAX_SHOWN);
  emit();
  if (tone === "success") window.setTimeout(() => dismiss(id), SUCCESS_MS);
  return id;
}

export function dismiss(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export const toast = {
  /** A change that happened. Leaves by itself. */
  success: (title: string, body?: string) => push("success", title, body),
  /** A change that did not happen, and what to do next. Stays until dismissed. */
  error: (title: string, body?: string) => push("error", title, body),
};

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster(): JSX.Element {
  const list = useSyncExternalStore(subscribe, () => toasts);

  return (
    <div
      data-toaster=""
      aria-label="Notifications"
      className="toaster pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-stretch gap-2 p-3 sm:inset-x-auto sm:right-0 sm:w-96 sm:p-4"
    >
      {list.map((t) => {
        const Icon = t.tone === "error" ? CircleAlert : CircleCheck;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "toast pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface-2 p-3 shadow-2",
              t.tone === "error" ? "border-danger" : "border-line-strong",
            )}
          >
            <Icon
              className={cn("mt-0.5 h-4 w-4 shrink-0", t.tone === "error" ? "text-danger" : "text-success")}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-xs text-ink-muted">{t.body}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded-sm p-1 text-ink-muted hover:bg-surface-3 hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
