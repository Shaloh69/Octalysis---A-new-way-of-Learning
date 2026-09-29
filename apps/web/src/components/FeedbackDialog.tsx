import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Report a problem: the flag, as a dialog the shells open.
 *
 * It was a floating widget with its own trigger, which on 29 Sep turned out to
 * render as a full-width bar at the end of every page (NEXT-SESSION §0q.1). Now
 * the trigger is the shell's (a key hint in the star HUD, a sprite button in a
 * biome) and this is only the dialog.
 *
 * THE ONE THING THAT MAKES IT USEFUL, unchanged: opened during an attempt, it
 * sends the attempt id and the ordinal, and THE SERVER reconstructs the exact
 * variant the student saw from their seed. The client is not trusted to send
 * the variant and could not be believed if it did.
 */
const CATEGORIES = [
  { id: "broken", label: "Something is broken", hint: "A wrong answer key, a question that will not load" },
  { id: "confusing", label: "This is confusing", hint: "The wording, not the difficulty" },
  { id: "slow", label: "It is slow", hint: "Pages or saving taking too long" },
  { id: "idea", label: "I have an idea", hint: "Anything that would make this better" },
] as const;

export function FeedbackDialog({
  onClose,
  framed,
}: {
  onClose: () => void;
  /** The panel class: `hud-panel` in the star system, `sprite-panel` in a biome. */
  framed: string;
}): JSX.Element {
  const [category, setCategory] = useState<string>("broken");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ variantAttached: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const loc = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  const attemptId = search.get("attempt");
  const ordinal = Number(search.get("q"));

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, [onClose]);

  async function send() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await api.sendFeedback({
        channel: attemptId ? "content_report" : "flag",
        category,
        body: body.trim(),
        route: loc.pathname,
        context: { viewport: `${window.innerWidth}x${window.innerHeight}`, stage: params.id ?? null },
        ...(attemptId && Number.isFinite(ordinal) && ordinal > 0 ? { attemptId, ordinal } : {}),
      });
      setSent({ variantAttached: res.variantAttached });
      setBody("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" data-shell>
      <div className={`dialog feedback ${framed}`} role="dialog" aria-modal="true" aria-labelledby="fb-title">
        <div className="dialog-head">
          <h2 id="fb-title" ref={heading} tabIndex={-1}>
            Report a problem
          </h2>
          <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {sent ? (
          <div className="feedback-sent" role="status">
            <p>Sent. Thank you.</p>
            {sent.variantAttached && (
              <p className="note">
                The exact version of the question you saw was attached, so your instructor can see precisely what
                you did.
              </p>
            )}
            <button type="button" className="button button-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <fieldset className="feedback-cats">
              <legend className="sr-only">What kind of problem?</legend>
              {CATEGORIES.map((c) => (
                <label key={c.id} className={"feedback-cat" + (category === c.id ? " is-on" : "")}>
                  <input
                    type="radio"
                    name="fb-cat"
                    value={c.id}
                    checked={category === c.id}
                    onChange={() => setCategory(c.id)}
                  />
                  <span className="feedback-cat-label">{c.label}</span>
                  <span className="feedback-cat-hint">{c.hint}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor="fb-body" className="field-label">
              What happened?
            </label>
            <textarea
              id="fb-body"
              className="field"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="As much or as little as you like."
            />
            {attemptId && <p className="note">This will include the exact question you are looking at, with your numbers.</p>}
            {failed && (
              <p className="note note-fail" role="alert">
                That did not send. Check your connection and try again.
              </p>
            )}
            <button type="button" className="button button-primary" onClick={() => void send()} disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
