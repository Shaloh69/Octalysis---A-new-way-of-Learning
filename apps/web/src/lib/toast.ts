/**
 * Toasts for the student app: the confirmation that a server-side change
 * happened, or did not.
 *
 * apps/web had none (`.claude/rules/design.md`, measured 25 Sep 2026). This is
 * the console's `components/ui/toast.tsx` ported as a module store with no
 * library and no Tailwind (29 Sep 2026, the `/app/stage/:id/check` revamp,
 * instructor-approved): the same rules, the same API, so the two apps behave
 * alike.
 *
 * - **What happened to what.** "Stage 02 Check submitted: 5 of 8", never "Success".
 * - **Successes leave after ~4s; failures stay until dismissed**, and say the
 *   next move.
 * - `role="status"` for success, `role="alert"` for failure.
 * - **Never used to tell a student they were wrong.** A wrong answer is a
 *   neutral verdict beside the question, not a toast and never red.
 */

export type ToastTone = "success" | "error";

export interface Toast {
  id: number;
  tone: ToastTone;
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

function push(tone: ToastTone, title: string, body?: string): number {
  const id = ++seq;
  toasts = [...toasts, { id, tone, title, body }].slice(-MAX_SHOWN);
  emit();
  if (tone === "success") window.setTimeout(() => dismissToast(id), SUCCESS_MS);
  return id;
}

export function dismissToast(id: number): void {
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

export function subscribeToasts(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function currentToasts(): Toast[] {
  return toasts;
}
