import type { ReactNode } from "react";

/**
 * The empty state.
 *
 * An empty console page must say WHY it is empty and what to do about it. A
 * blank table reads as a broken page, and a teacher who thinks the roster is
 * broken will not import one.
 */
export function Empty({
  title, hint, action,
}: {
  title: string;
  // `| undefined` explicitly: exactOptionalPropertyTypes is on, so `hint?:
  // string` would REJECT an explicitly-passed undefined. Callers legitimately
  // pass `cond ? "..." : undefined`.
  hint?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      {hint ? <p className="max-w-md text-sm text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <div role="status" className="px-1 py-8 text-sm text-ink-muted">
      Loading {what}…
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
