import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A page that fails to render says so, and the rest of the console stays.
 *
 * Until 8 Oct 2026 nothing caught a render error, so one bad value on one page
 * unmounted the whole app: a teacher opening a real attempt (an answer the page
 * could not draw) saw a blank dark screen with no menu, no message and no way
 * back. React unmounts the entire tree on an uncaught render error; an error
 * boundary is the only thing that stops it.
 *
 * It wraps the page area (the sidebar and account menu stay), resets when the
 * route changes (`resetKey`), and offers Reload and the way back. The error is
 * logged for the console, never shown as a stack trace (CLAUDE.md: never a
 * stack trace to the user).
 */
export class PageBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The browser's console, for whoever opens it; not the page.
    console.error("page failed to render:", error, info.componentStack);
  }

  override componentDidUpdate(prev: { resetKey: string }): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-12 max-w-xl rounded-md border border-line bg-surface-1 p-6" data-page-error="">
        <h1 className="font-display text-xl text-ink">This page hit a problem</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Nothing was changed. The rest of the console still works: use the menu, or reload this page. If it
          happens again, tell the instructor which page it was.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-line-strong px-4 text-sm text-ink hover:bg-surface-2"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-line px-4 text-sm text-ink-muted hover:bg-surface-2"
            onClick={() => window.history.back()}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }
}
