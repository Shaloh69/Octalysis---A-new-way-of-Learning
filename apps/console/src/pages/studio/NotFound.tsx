import { Link } from "react-router-dom";

/** An unknown subject or chapter: a sentence and a way back, never a blank (SPEC.md, States). */
export function NotFound({ what }: { what: string }) {
  return (
    <div className="ct" data-not-found>
      <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Not found</h1>
      <p className="text-sm text-ink">{what}</p>
      <p>
        <Link className="ct-link" to="/studio">Back to the Overview</Link>
      </p>
    </div>
  );
}
