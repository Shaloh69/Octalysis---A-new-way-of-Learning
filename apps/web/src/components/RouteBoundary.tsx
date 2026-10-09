import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A page that fails to render says so, and the app stays (8 Oct 2026).
 *
 * Nothing caught a render error in either app, so one bad value unmounted the
 * whole tree: the console went blank on opening a real attempt that day. A
 * student is worse placed than a teacher, who can at least be told to reload:
 * a blank screen mid-sitting looks like the paper was lost. The boundary wraps
 * each shell's page area (the strip, tabs and the paper's own guard are outside
 * it), resets when the route changes (`resetKey`), and offers Reload and the way
 * back. The error goes to the browser's console, never to the page.
 */
export class RouteBoundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("page failed to render:", error, info.componentStack);
  }

  override componentDidUpdate(prev: { resetKey: string }): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="hud-panel route-error" role="alert" data-page-error="">
        <h2 className="hud-caption">This page hit a problem</h2>
        <div className="set-body">
          <p className="set-note">
            Nothing you did was lost: answers are saved as you record them. Reload the page, or go back. If it
            happens again, tell your instructor which page it was.
          </p>
          <div className="route-error-actions">
            <button type="button" className="hud-button button-primary" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button type="button" className="hud-button" onClick={() => window.history.back()}>
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }
}
