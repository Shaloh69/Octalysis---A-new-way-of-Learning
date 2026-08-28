/**
 * The animated backdrop.
 *
 * All of the drawing lives in `@octa/tokens/backdrop.css`, shared with
 * `apps/web` so the two apps cannot drift into looking like different products.
 * This file is the four `div`s that stylesheet expects and nothing else — no
 * state, no effect, no props.
 *
 * `aria-hidden` is not optional. Four empty elements depicting bus traffic are
 * meaningless to a screen reader, and announcing them would put four blank
 * nodes ahead of the page's real content.
 */
export function Backdrop(): JSX.Element {
  return (
    <div className="octa-backdrop" aria-hidden="true">
      <i className="octa-trace" />
      <i className="octa-trace" />
      <i className="octa-trace" />
      <i className="octa-trace" />
    </div>
  );
}
