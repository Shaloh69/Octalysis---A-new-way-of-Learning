import { useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * The System Usability Scale, ten questions, once.
 *
 * **THE GATE IS SERVER-SIDE AND THAT IS THE WHOLE DESIGN.** `PAGE-SPECS.md` §4:
 * never before three sessions AND one completed assessment, and it stops asking
 * after two dismissals. Those counts live in the database, so clearing the
 * browser does not reset them and a student cannot be nagged by accident.
 *
 * This component asks the server whether it may appear and renders nothing
 * unless told yes. It has no opinion of its own.
 *
 * The ten statements are the standard SUS wording (Brooke, 1996), which matters:
 * a SUS score is only comparable to the published benchmark of 68 if the
 * instrument is unmodified. Scoring happens in the database via `sus_score()`;
 * there is deliberately no arithmetic in this file.
 */

const STATEMENTS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
];

export function SusSurvey(): JSX.Element | null {
  const [show, setShow] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void api
      .feedbackPrompt()
      .then((r) => {
        if (live) setShow(r.show);
      })
      .catch(() => {
        /* if we cannot ask, we do not show. Silence beats a wrong prompt. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;

  const complete = STATEMENTS.every((_, i) => answers[i + 1] !== undefined);

  async function submit() {
    setBusy(true);
    try {
      const r = await api.submitSus(STATEMENTS.map((_, i) => answers[i + 1]!));
      setDone(r.score);
    } catch {
      setShow(false);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setShow(false);
    await api.dismissPrompt().catch(() => {});
  }

  if (done !== null) {
    return (
      <div className="sus" role="status">
        <h2>Thank you.</h2>
        <p>
          That is the last you will hear of this survey. It helps show whether the system is
          actually usable rather than just finished.
        </p>
        <button type="button" onClick={() => setShow(false)}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="sus" role="dialog" aria-modal="false" aria-labelledby="sus-title">
      <h2 id="sus-title">Ten quick questions</h2>
      <p className="sus-sub">
        About the system, not the course. It takes about a minute and you will only be asked once.
      </p>

      <ol className="sus-list">
        {STATEMENTS.map((s, i) => {
          const q = i + 1;
          return (
            <li key={q}>
              <p className="sus-statement">{s}</p>
              <fieldset className="sus-scale">
                <legend className="sr-only">{s}</legend>
                <span className="sus-anchor">Disagree</span>
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v} className={answers[q] === v ? "is-on" : ""}>
                    <input
                      type="radio"
                      name={`sus-${q}`}
                      value={v}
                      checked={answers[q] === v}
                      onChange={() => setAnswers((a) => ({ ...a, [q]: v }))}
                    />
                    <span className="mono">{v}</span>
                  </label>
                ))}
                <span className="sus-anchor">Agree</span>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="sus-foot">
        <button type="button" onClick={() => void dismiss()}>
          Not now
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void submit()}
          disabled={!complete || busy}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {!complete && <p className="sus-note">Answer all ten to send.</p>}
    </div>
  );
}
