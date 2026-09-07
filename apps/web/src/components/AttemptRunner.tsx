import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

/**
 * Sitting an assessment.
 *
 * This is what the question engine was built for, and every rule below exists
 * because of something the rest of the system already guarantees.
 *
 * **THE BROWSER NEVER KNOWS THE ANSWER.** The paper arrives with stems and
 * options and no key. Each answer is POSTed and the server decides. When the
 * assessment withholds its verdict — an exam — the server says
 * `verdictWithheld` and this component shows *recorded*, not *correct*. There
 * is no branch here that could reveal a key, because there is no key here to
 * reveal.
 *
 * **EVERY ANSWER IS SAVED THE MOMENT IT IS GIVEN.** Not on submit. A student
 * whose laptop dies in week 12 has lost the current question, not the paper.
 * `responses` is append-only, so a re-answer is a new row and the history stays
 * intact.
 *
 * **INCORRECT IS NEUTRAL.** No red, no buzzer, no shake — `CLAUDE.md`, and it
 * is a teaching decision rather than a styling one. A student who is wrong
 * needs to know *why*, and a colour cannot carry that.
 *
 * **KEYBOARD FIRST.** Options are radios in a fieldset, so arrow keys move
 * between them and the browser does the work. Nothing here is a div pretending
 * to be a control.
 */

interface PaperItem {
  ordinal: number;
  type: string;
  stem: string;
  options: string[];
  points: number;
  unit?: string;
}

interface Verdict {
  recorded: boolean;
  verdictWithheld?: boolean;
  isCorrect?: boolean;
  correctValue?: string;
  rationale?: string;
}

interface Props {
  assessmentId: string;
  title: string;
  onFinished: () => void;
  onLeave: () => void;
}

type Phase = "loading" | "sitting" | "submitting" | "done" | "error";

export function AttemptRunner({ assessmentId, title, onFinished, onLeave }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>("loading");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [items, setItems] = useState<PaperItem[]>([]);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.submit>> | null>(null);
  const [resumed, setResumed] = useState(false);

  // Time per item is a real signal for the item bank -- an item everyone gets
  // right in four seconds is not testing anything. Measured from when the item
  // is SHOWN, reset on navigation.
  const shownAt = useRef<number>(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [at]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const started = await api.startAttempt(assessmentId);
        if (!live) return;
        setAttemptId(started.attemptId);
        setItems(started.items);
        setResumed(started.resumed);
        setPhase("sitting");
      } catch (err) {
        if (!live) return;
        setError(
          err instanceof ApiError ? err.message : "That assessment could not be started.",
        );
        setPhase("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [assessmentId]);

  const item = items[at];

  /**
   * Send an answer.
   *
   * `raw` is the SHAPE the engine grades, not the text on screen. `AnswerBody`
   * in `routes/attempts.ts` accepts `{index}`, `{value}` or `{order}` and
   * nothing else, and this used to send the bare option string — so every
   * multiple-choice answer came back **400 "That answer could not be read."**
   * and never reached `responses`.
   *
   * It failed silently in the worst way: the answer is written to local state
   * first, so the option stayed selected and the paper looked answered. Only
   * the network tab said otherwise.
   *
   * `display` is what the student sees selected, kept separate because for an
   * option the wire value is its INDEX. Index rather than text on purpose:
   * `gradeResponse` will match text against the options as a fallback, but two
   * options that render the same string would be ambiguous, and a paper with a
   * repeated distractor is a real thing.
   */
  const answer = useCallback(
    async (raw: { index: number } | { value: string }, display: string) => {
      if (!attemptId || !item) return;
      setAnswers((a) => ({ ...a, [item.ordinal]: display }));
      setSaving(true);
      setError(null);
      try {
        const v = await api.answer(attemptId, item.ordinal, raw, Date.now() - shownAt.current);
        setVerdicts((prev) => ({ ...prev, [item.ordinal]: v }));
      } catch (err) {
        // The answer is in local state either way, so the student is not
        // stranded -- but say so plainly rather than pretending it saved.
        setError(
          err instanceof ApiError
            ? err.message
            : "That answer did not save. Check your connection; it will send when you reconnect.",
        );
      } finally {
        setSaving(false);
      }
    },
    [attemptId, item],
  );

  async function submit() {
    if (!attemptId) return;
    setPhase("submitting");
    try {
      const r = await api.submit(attemptId);
      setResult(r);
      setPhase("done");
      onFinished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That submission did not go through.");
      setPhase("sitting");
    }
  }

  /* ------------------------------------------------------------- states */

  if (phase === "loading") {
    return (
      <div className="state state-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Preparing your paper</span>
        <div className="skel skel-title" />
        <div className="skel skel-para" />
        <div className="skel skel-para" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="state state-error" role="alert">
        <h2>That did not start</h2>
        <p>{error}</p>
        <button type="button" onClick={onLeave}>
          Back to the stage
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return <Result result={result} title={title} onLeave={onLeave} />;
  }

  if (!item) return <div className="state">This paper has no questions yet.</div>;

  const answered = Object.keys(answers).length;
  const verdict = verdicts[item.ordinal];
  const chosen = answers[item.ordinal];

  return (
    <section className="runner" aria-labelledby="runner-title">
      <header className="runner-head">
        <p className="reader-eyebrow">Assessment</p>
        <h1 id="runner-title">{title}</h1>

        {resumed && (
          <p className="runner-resumed" role="status">
            Picking up where you left off. Everything you had already answered is saved.
          </p>
        )}

        {/*
         * Progress is "how many of these have I answered", not a timer.
         * Nothing in this system is timed, and a countdown would add pressure
         * that measures composure rather than understanding.
         */}
        <div className="runner-progress">
          <div
            className="runner-bar"
            role="img"
            aria-label={`${answered} of ${items.length} answered`}
          >
            <span style={{ width: `${(answered / items.length) * 100}%` }} />
          </div>
          <p className="mono runner-count">
            {answered} / {items.length} answered
          </p>
        </div>
      </header>

      <nav className="runner-jump" aria-label="Questions">
        {items.map((it, i) => (
          <button
            key={it.ordinal}
            type="button"
            className={
              "runner-pip" +
              (i === at ? " runner-pip-at" : "") +
              (answers[it.ordinal] !== undefined ? " runner-pip-done" : "")
            }
            aria-label={
              `Question ${it.ordinal}` +
              (answers[it.ordinal] !== undefined ? ", answered" : ", not answered") +
              (i === at ? ", current" : "")
            }
            aria-current={i === at ? "true" : undefined}
            onClick={() => setAt(i)}
          >
            <span className="mono">{it.ordinal}</span>
          </button>
        ))}
      </nav>

      <article className="runner-item">
        <p className="mono runner-ordinal">
          Question {item.ordinal} of {items.length}
          {item.points !== 1 && <> · {item.points} points</>}
        </p>

        <p className="runner-stem">{item.stem}</p>

        {item.options.length > 0 ? (
          <fieldset className="runner-options">
            <legend className="sr-only">Choose one answer</legend>
            {item.options.map((opt, k) => (
              <label
                key={k}
                className={"runner-option" + (chosen === opt ? " runner-option-chosen" : "")}
              >
                <input
                  type="radio"
                  name={`q-${item.ordinal}`}
                  value={opt}
                  checked={chosen === opt}
                  onChange={() => void answer({ index: k }, opt)}
                />
                <span className="mono runner-letter">{String.fromCharCode(65 + k)}</span>
                <span className="runner-option-text">{opt}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <FreeEntry
            unit={item.unit}
            value={chosen ?? ""}
            onCommit={(v) => void answer({ value: v }, v)}
          />
        )}

        {/*
         * aria-live so a screen reader hears the verdict without hunting for
         * it. `polite`, not `assertive` -- it is information, not an alarm.
         */}
        <div className="runner-verdict" aria-live="polite">
          {saving && <p className="runner-saving">Saving…</p>}

          {!saving && verdict?.verdictWithheld && (
            <p className="runner-recorded">
              Answer recorded. This assessment shows its results after you submit.
            </p>
          )}

          {!saving && verdict && !verdict.verdictWithheld && verdict.isCorrect === true && (
            <p className="runner-right">Correct.</p>
          )}

          {!saving && verdict && !verdict.verdictWithheld && verdict.isCorrect === false && (
            /*
             * NEUTRAL. No red, no cross, no shake. The rationale is the
             * teaching; the verdict is just the label on it.
             */
            <div className="runner-wrong">
              <p>
                Not this one. The answer is{" "}
                <strong className="mono">{verdict.correctValue}</strong>.
              </p>
              {verdict.rationale && <p className="runner-why">{verdict.rationale}</p>}
            </div>
          )}
        </div>

        {error && (
          <p className="runner-error" role="alert">
            {error}
          </p>
        )}
      </article>

      <footer className="runner-foot">
        <button type="button" onClick={() => setAt((i) => Math.max(0, i - 1))} disabled={at === 0}>
          Previous
        </button>
        <button
          type="button"
          onClick={() => setAt((i) => Math.min(items.length - 1, i + 1))}
          disabled={at === items.length - 1}
        >
          Next
        </button>

        <button
          type="button"
          className="runner-submit"
          onClick={() => void submit()}
          disabled={phase === "submitting"}
        >
          {phase === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </footer>

      {answered < items.length && (
        <p className="runner-unanswered">
          {items.length - answered} question{items.length - answered === 1 ? "" : "s"} still
          unanswered. You can submit anyway — unanswered questions score zero.
        </p>
      )}
    </section>
  );
}

/**
 * Free numeric entry, for parameterized items.
 *
 * Committed on blur and on Enter rather than on every keystroke: sending a
 * request per character would put "4", "42", "420" into `responses` as three
 * answers, and that table is append-only so they would all stay there.
 */
function FreeEntry({
  unit,
  value,
  onCommit,
}: {
  unit?: string | undefined;
  value: string;
  onCommit: (v: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== value) onCommit(t);
  };

  return (
    <div className="runner-entry">
      <label htmlFor="free-entry" className="sr-only">
        Your answer{unit ? ` in ${unit}` : ""}
      </label>
      <input
        id="free-entry"
        className="mono"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Your answer"
      />
      {unit && <span className="mono runner-unit">{unit}</span>}
      <p className="runner-entry-hint">Press Enter to save.</p>
    </div>
  );
}

/**
 * The result.
 *
 * Per-objective, not one number. A student who scores 60% needs to know *which
 * 40%* — a single percentage tells them they did badly and nothing about what
 * to do next, which is the opposite of useful.
 */
function Result({
  result,
  title,
  onLeave,
}: {
  result: NonNullable<Awaited<ReturnType<typeof api.submit>>>;
  title: string;
  onLeave: () => void;
}): JSX.Element {
  const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const missed = result.review.filter((r) => !r.isCorrect);

  return (
    <section className="runner runner-result" aria-labelledby="result-title">
      <p className="reader-eyebrow">Submitted</p>
      <h1 id="result-title">{title}</h1>

      <p className="result-score mono">
        {result.score} / {result.maxScore}
        <span className="result-pct"> · {pct}%</span>
      </p>

      <h2>By objective</h2>
      <p className="result-sub">
        This is the part worth reading. A score tells you how you did; this tells you what to do.
      </p>
      <ul className="result-objectives">
        {Object.entries(result.byObjective).map(([obj, v]) => (
          <li key={obj}>
            <span className="mono obj-id">{obj}</span>
            <div className="result-bar" role="img" aria-label={`${v.correct} of ${v.total} correct`}>
              <span style={{ width: `${(v.correct / Math.max(1, v.total)) * 100}%` }} />
            </div>
            <span className="mono result-frac">
              {v.correct}/{v.total}
            </span>
          </li>
        ))}
      </ul>

      {missed.length > 0 && (
        <>
          <h2>What you missed</h2>
          <ol className="result-review">
            {missed.map((r) => (
              <li key={r.ordinal}>
                <p className="mono runner-ordinal">Question {r.ordinal}</p>
                <p>
                  The answer is <strong className="mono">{r.correctValue}</strong>.
                </p>
                {r.rationale && <p className="runner-why">{r.rationale}</p>}
              </li>
            ))}
          </ol>
        </>
      )}

      <button type="button" onClick={onLeave}>
        Back to the stage
      </button>
    </section>
  );
}
