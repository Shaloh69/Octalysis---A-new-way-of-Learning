import { useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

/**
 * The flag.
 *
 * A student who thinks a question is broken has, until now, had nowhere to say
 * so. The routes to receive it were built and tested; nothing called them.
 *
 * THE ONE THING THAT MAKES THIS USEFUL: when it is opened during an attempt, it
 * sends the attempt id and the ordinal, and **the server** reconstructs the
 * exact resolved variant from the student's seed. "Question 7 is wrong" is
 * unactionable when every student got different numbers; "question 7 with
 * f = 2400 MHz" is a bug report. The client is not trusted to send the variant
 * and could not be believed if it did.
 *
 * It is deliberately small and always in the corner. A report button a student
 * has to hunt for is a report that never arrives.
 */

const CATEGORIES = [
  { id: "broken", label: "Something is broken", hint: "A wrong answer key, a question that will not load" },
  { id: "confusing", label: "This is confusing", hint: "The wording, not the difficulty" },
  { id: "slow", label: "It is slow", hint: "Pages or saving taking too long" },
  { id: "idea", label: "I have an idea", hint: "Anything that would make this better" },
] as const;

export function FeedbackWidget(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("broken");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ variantAttached: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  const loc = useLocation();
  const params = useParams();
  const [search] = useSearchParams();

  // Only on the check route does an attempt exist to attach.
  const attemptId = search.get("attempt");
  const ordinal = Number(search.get("q"));

  async function send() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await api.sendFeedback({
        channel: attemptId ? "content_report" : "flag",
        category,
        body: body.trim(),
        route: loc.pathname,
        context: {
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          stage: params.id ?? null,
        },
        ...(attemptId && Number.isFinite(ordinal) && ordinal > 0
          ? { attemptId, ordinal }
          : {}),
      });
      setSent({ variantAttached: res.variantAttached });
      setBody("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="fb-tab" onClick={() => setOpen(true)}>
        Report a problem
      </button>
    );
  }

  return (
    <div className="fb-panel" role="dialog" aria-modal="false" aria-labelledby="fb-title">
      <div className="fb-head">
        <h2 id="fb-title">Report a problem</h2>
        <button type="button" className="fb-close" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      {sent ? (
        <div className="fb-sent" role="status">
          <p>Sent. Thank you.</p>
          {sent.variantAttached && (
            <p className="fb-note">
              The exact version of the question you saw was attached, so your instructor can see
              precisely what you did.
            </p>
          )}
          <button type="button" onClick={() => { setSent(null); setOpen(false); }}>
            Close
          </button>
        </div>
      ) : (
        <>
          <fieldset className="fb-cats">
            <legend className="sr-only">What kind of problem?</legend>
            {CATEGORIES.map((c) => (
              <label key={c.id} className={"fb-cat" + (category === c.id ? " is-on" : "")}>
                <input
                  type="radio"
                  name="fb-cat"
                  value={c.id}
                  checked={category === c.id}
                  onChange={() => setCategory(c.id)}
                />
                <span className="fb-cat-label">{c.label}</span>
                <span className="fb-cat-hint">{c.hint}</span>
              </label>
            ))}
          </fieldset>

          <label htmlFor="fb-body" className="fb-label">
            What happened?
          </label>
          <textarea
            id="fb-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="As much or as little as you like."
          />

          {attemptId && (
            <p className="fb-note">
              This will include the exact question you are looking at, with your numbers.
            </p>
          )}

          {failed && (
            <p className="fb-fail" role="alert">
              That did not send. Check your connection and try again.
            </p>
          )}

          <button type="button" className="btn-primary" onClick={() => void send()} disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </button>
        </>
      )}
    </div>
  );
}
