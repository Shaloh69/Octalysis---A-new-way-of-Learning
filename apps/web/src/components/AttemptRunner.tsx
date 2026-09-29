import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ApiError,
  type PaperItem,
  type StudentAnswer,
  type SubmitResult,
  type Verdict,
} from "../lib/api";
import { useRegister } from "../lib/registers";
import { toast } from "../lib/toast";
import { useDelayed } from "../lib/useDelayed";

/**
 * Sitting a paper: `/app/stage/:id/check`.
 *
 * Rebuilt 29 Sep 2026 against `design/templates/web/stage-check/` (a Professor
 * Layton puzzle screen: a status strip above one puzzle, and an explicit
 * Submit). `SPEC.md` there is the contract; these are the rules it keeps.
 *
 * **THE BROWSER NEVER KNOWS AN ANSWER IT HAS NOT RECORDED.** The paper arrives
 * with stems and options and no key. A verdict, and on a stage check the key
 * and rationale inside it, arrives only for a question the student recorded;
 * on a final not even then, until the paper is handed in.
 *
 * **CHOOSE, THEN RECORD** (instructor, 29 Sep 2026). `responses` keeps the
 * first answer for a question and nothing overwrites it. So choosing (a click,
 * a tap, an arrow key) only selects, and **Record answer** commits. It used to
 * record on the radio's change event, and an arrow key changes a radio, so a
 * keyboard user browsing the options recorded the first one they landed on.
 *
 * **A RESUMED PAPER IS THE PAPER AS LEFT.** The server returns the student's
 * own recorded answers (and, on a stage check, the verdicts already shown);
 * they come back read-only, and the paper opens on the first unrecorded
 * question.
 *
 * **INCORRECT IS NEUTRAL.** The words, the key and the why. No red, no
 * buzzer, no shake: a student who is wrong needs to know why, and a colour
 * cannot carry that.
 */

type Phase = "loading" | "error" | "sitting" | "done";

/** What the student has chosen for a question and not yet recorded. */
type Draft = { index: number } | { value: string } | { order: string[] };

interface Recorded {
  answer: StudentAnswer | null;
  verdict: Verdict | null;
  withheld: boolean;
}

interface Props {
  stageId: string;
  assessmentId: string;
  title: string;
  onLeave: () => void;
}

const FLAGS = (attemptId: string) => `octa:flags:${attemptId}`;

/**
 * Flags live on this device, under the attempt: they change no mark and never
 * reach the server, so `localStorage` is allowed (`apps/web/CLAUDE.md` bans it
 * only for anything gradeable). Every read and write can throw in a private
 * window; the paper is whole without them.
 */
function readFlags(attemptId: string): number[] {
  try {
    const raw = window.localStorage.getItem(FLAGS(attemptId));
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}
function writeFlags(attemptId: string, flags: number[]): void {
  try {
    window.localStorage.setItem(FLAGS(attemptId), JSON.stringify(flags));
  } catch {
    /* a flag is a convenience; losing it costs nothing graded */
  }
}

const letter = (k: number) => String.fromCharCode(65 + k);

/**
 * Mono is for what the machine sees: numbers, hex, register values, a
 * computed answer (`.claude/rules/design.md`). A key that is a sentence
 * ("It designs architectures and licenses them") is prose and reads as prose.
 */
function valueClass(v: string): string {
  const t = v.trim();
  const machine = (/\d/.test(t) && t.split(/\s+/).length <= 3) || /^(0x)?[0-9a-f]+h?$/i.test(t);
  return machine ? "mono" : "check-value";
}

/** The recorded answer, in words, for the question it belongs to. */
function answerText(item: PaperItem, a: StudentAnswer | null): string {
  if (!a) return "(not readable)";
  if ("index" in a) return item.options[a.index] ?? "(not readable)";
  if ("order" in a) return a.order.join(" | ");
  return String(a.value);
}

export function AttemptRunner({ stageId, assessmentId, title, onLeave }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>("loading");
  const [startError, setStartError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [items, setItems] = useState<PaperItem[]>([]);
  const [resumed, setResumed] = useState(false);
  const [at, setAt] = useState(0);

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [recorded, setRecorded] = useState<Record<number, Recorded>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState<Record<number, string>>({});
  const [flags, setFlags] = useState<number[]>([]);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [objectives, setObjectives] = useState<Record<string, string>>({});

  const submitRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  /* ---------------------------------------------------------------- start */

  useEffect(() => {
    let live = true;
    setPhase("loading");
    setStartError(null);
    void (async () => {
      try {
        const started = await api.startAttempt(assessmentId);
        if (!live) return;
        const rec: Record<number, Recorded> = {};
        for (const a of started.answered ?? []) {
          rec[a.ordinal] = { answer: a.answer, verdict: a.verdict ?? null, withheld: !a.verdict };
        }
        const firstOpen = started.items.findIndex((it) => !rec[it.ordinal]);
        setAttemptId(started.attemptId);
        setItems(started.items);
        setRecorded(rec);
        setResumed(started.resumed);
        setAt(firstOpen === -1 ? 0 : firstOpen);
        setFlags(readFlags(started.attemptId).filter((n) => !rec[n]));
        setPhase("sitting");
      } catch (err) {
        if (!live) return;
        setStartError(
          err instanceof ApiError
            ? err.message
            : "The server could not be reached. Check your connection and try again.",
        );
        setPhase("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [assessmentId, tries]);

  // The syllabus's own words for each objective, for the result. The stage
  // read is the same one the reader makes; a failure only costs the words.
  useEffect(() => {
    let live = true;
    api
      .stage(stageId)
      .then((s) => {
        if (live) setObjectives(Object.fromEntries(s.objectives.map((o) => [o.id, o.description])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stageId]);

  /* --------------------------------------------------------- time on item */

  // Time on item is a signal for the bank (an item everyone answers in four
  // seconds tests nothing). Summed across visits, sent with the Record.
  const spent = useRef<Record<number, number>>({});
  const shownAt = useRef(Date.now());
  const item = items[at];
  useEffect(() => {
    if (!item) return;
    shownAt.current = Date.now();
    const ord = item.ordinal;
    return () => {
      spent.current[ord] = (spent.current[ord] ?? 0) + (Date.now() - shownAt.current);
    };
  }, [item]);

  /* ------------------------------------------------------------- register */

  useRegister(
    "PC",
    phase === "sitting" && item
      ? { value: String(item.ordinal).padStart(2, "0"), spoken: `question ${item.ordinal} of ${items.length}` }
      : null,
  );

  /* --------------------------------------------------------------- record */

  const record = useCallback(
    async (ordinal: number, answer: Draft) => {
      if (!attemptId) return;
      setPending(ordinal);
      setFailed((f) => {
        const { [ordinal]: _gone, ...rest } = f;
        return rest;
      });
      const timeMs = (spent.current[ordinal] ?? 0) + (Date.now() - shownAt.current);
      try {
        const v = await api.answer(attemptId, ordinal, answer, timeMs);
        setRecorded((r) => ({
          ...r,
          [ordinal]: {
            // The answer that COUNTS, which after a repeat is not the one sent.
            answer: v.answer ?? (answer as StudentAnswer),
            verdict: v.verdictWithheld ? null : v,
            withheld: Boolean(v.verdictWithheld),
          },
        }));
        setFlags((fl) => {
          const next = fl.filter((n) => n !== ordinal);
          writeFlags(attemptId, next);
          return next;
        });
      } catch (err) {
        const why =
          err instanceof ApiError ? err.message : "The connection dropped before the server answered.";
        setFailed((f) => ({ ...f, [ordinal]: why }));
        toast.error(
          `Question ${ordinal} was not recorded`,
          `${why} Your choice is still selected: press Try again.`,
        );
      } finally {
        setPending(null);
      }
    },
    [attemptId],
  );

  // Back online: send what failed, once. The offline banner promises exactly this.
  useEffect(() => {
    const retry = () => {
      for (const [ord, _why] of Object.entries(failed)) {
        const d = drafts[Number(ord)];
        if (d) void record(Number(ord), d);
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failed, drafts, record]);

  /* --------------------------------------------------------------- submit */

  async function submit() {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const r = await api.submit(attemptId);
      setResult(r);
      setConfirming(false);
      setPhase("done");
      writeFlags(attemptId, []);
      toast.success(`${title} submitted: ${r.score} of ${r.maxScore}`);
    } catch (err) {
      setConfirming(false);
      toast.error(
        "The paper was not submitted",
        `${err instanceof ApiError ? err.message : "The connection dropped."} Your recorded answers are safe; submit again when you are ready.`,
      );
      window.setTimeout(() => submitRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------------------------------------ navigation */

  const go = (i: number) => {
    moved.current = true;
    setAt(Math.max(0, Math.min(items.length - 1, i)));
  };
  useEffect(() => {
    // Focus follows a deliberate move, never the first render.
    if (moved.current) questionRef.current?.focus();
  }, [at]);

  const toggleFlag = (ordinal: number) => {
    if (!attemptId) return;
    setFlags((fl) => {
      const next = fl.includes(ordinal) ? fl.filter((n) => n !== ordinal) : [...fl, ordinal];
      writeFlags(attemptId, next);
      return next;
    });
  };

  const counts = useMemo(() => {
    const done = items.filter((it) => recorded[it.ordinal]).length;
    return { done, open: items.length - done };
  }, [items, recorded]);

  /* ---------------------------------------------------------------- views */

  if (phase === "loading") return <Loading />;

  if (phase === "error") {
    return (
      <section className="check check-state" data-runner="error" data-paper="" aria-labelledby="check-title">
        <p className="check-eyebrow">{title}</p>
        <h1 id="check-title">Your paper did not open</h1>
        <p role="alert">{startError}</p>
        <p className="check-quiet">Nothing was recorded, and no attempt was used by this failure.</p>
        <div className="check-row">
          <button type="button" className="check-btn check-btn-primary" onClick={() => setTries((n) => n + 1)}>
            Try again
          </button>
          <button type="button" className="check-btn" onClick={onLeave}>
            Back to the stage
          </button>
        </div>
      </section>
    );
  }

  if (phase === "done" && result) {
    return <Result result={result} title={title} items={items} recorded={recorded} objectives={objectives} onLeave={onLeave} />;
  }

  if (!item) {
    return (
      <section className="check check-state" data-runner="empty" data-paper="" aria-labelledby="check-title">
        <h1 id="check-title">{title}</h1>
        <p>This paper has no questions. Tell your instructor; nothing has been recorded.</p>
        <button type="button" className="check-btn" onClick={onLeave}>
          Back to the stage
        </button>
      </section>
    );
  }

  const rec = recorded[item.ordinal];
  // An ordering item's arrangement on arrival is already an answer (the
  // engine's shuffle can land on the right order), so it can be recorded as is.
  const draft: Draft | undefined =
    drafts[item.ordinal] ?? (item.type === "G" ? { order: item.options } : undefined);
  const setDraft = (d: Draft) => setDrafts((all) => ({ ...all, [item.ordinal]: d }));
  const saving = pending === item.ordinal;
  const failure = failed[item.ordinal];
  const flagged = flags.includes(item.ordinal);

  return (
    <section className="check" data-runner="sitting" aria-labelledby="check-title">
      <div className="check-body">
        {/*
          The paper (WEB-REMAKE.md §4): the header, the question card, Record,
          every verdict and Submit sit on [data-paper], ONE neutral set identical
          for every student whatever planet surrounds it. The question list
          beside it is chrome, so it wears the planet's sprites.
        */}
        <nav className="check-palette sprite-panel" aria-label="Questions">
          <p className="check-count mono" data-recorded-count="">
            {counts.done} of {items.length} recorded
          </p>
          <ol className="check-pips">
            {items.map((it, i) => {
              const r = Boolean(recorded[it.ordinal]);
              const f = flags.includes(it.ordinal);
              const state = r ? "recorded" : "not answered";
              return (
                <li key={it.ordinal}>
                  <button
                    type="button"
                    className={`check-pip${i === at ? " is-current" : ""}${r ? " is-recorded" : ""}${f ? " is-flagged" : ""}`}
                    aria-label={`Question ${it.ordinal}, ${state}${f ? ", flagged" : ""}${i === at ? ", current" : ""}`}
                    aria-current={i === at ? "step" : undefined}
                    onClick={() => go(i)}
                  >
                    <span className="mono">{it.ordinal}</span>
                    <span className="check-pip-mark" aria-hidden="true">
                      {r ? "✓" : f ? "⚑" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="check-legend">
            <span aria-hidden="true">✓</span> recorded · <span aria-hidden="true">⚑</span> flagged
          </p>
        </nav>

        <div className="check-paper" data-paper="">
      <header className="check-head">
        <p className="check-eyebrow">Stage check</p>
        <h1 id="check-title">{title}</h1>
        <p className="check-rule">
          Work each answer out, then press <strong>Record answer</strong>. Your first recorded answer to
          each question is final.
        </p>
        {resumed && (
          <p className="check-resumed" role="status">
            Picking up where you left off. Your recorded answers are shown as you left them.
          </p>
        )}
      </header>

        <article className="check-question" key={item.ordinal} aria-labelledby="check-question-no">
          <div className="check-question-head">
            <h2 id="check-question-no" className="check-question-no" tabIndex={-1} ref={questionRef}>
              <span className="mono" data-question-no="">
                Question {item.ordinal} of {items.length}
              </span>
              {item.points !== 1 && <span className="check-worth mono"> · {item.points} marks</span>}
              {flagged && <span className="check-worth"> · flagged</span>}
            </h2>
            {!rec && (
              /* A toggle keeps its name; aria-pressed and the heading say its state. */
              <button
                type="button"
                className={`check-flag${flagged ? " is-on" : ""}`}
                aria-pressed={flagged}
                onClick={() => toggleFlag(item.ordinal)}
              >
                <span aria-hidden="true">⚑</span> Flag to come back to
              </button>
            )}
          </div>

          <p className="check-stem">{item.stem}</p>

          {item.type === "G" ? (
            <Ordering
              key={item.ordinal}
              options={item.options}
              recorded={rec?.answer && "order" in rec.answer ? rec.answer.order : null}
              draft={draft && "order" in draft ? draft.order : null}
              onChange={(order) => setDraft({ order })}
            />
          ) : item.options.length > 0 ? (
            <fieldset className="check-options" disabled={Boolean(rec) || saving}>
              <legend className="sr-only">Choose one answer, then press Record answer</legend>
              {item.options.map((opt, k) => {
                const chosen = rec
                  ? rec.answer !== null && "index" in rec.answer && rec.answer.index === k
                  : draft !== undefined && "index" in draft && draft.index === k;
                const isKey = rec?.verdict && !rec.verdict.isCorrect && rec.verdict.correctValue === opt;
                return (
                  <label key={k} className={`check-option${chosen ? " is-chosen" : ""}`}>
                    <input
                      type="radio"
                      name={`q-${item.ordinal}`}
                      checked={chosen}
                      onChange={() => setDraft({ index: k })}
                    />
                    <span className="check-letter mono" aria-hidden="true">
                      {letter(k)}
                    </span>
                    <span className="check-option-text">{opt}</span>
                    {rec && chosen && <span className="check-tag">Your answer</span>}
                    {isKey && <span className="check-tag">The answer</span>}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <FreeEntry
              key={item.ordinal}
              unit={item.unit}
              recorded={rec?.answer && "value" in rec.answer ? String(rec.answer.value) : null}
              draft={draft && "value" in draft ? draft.value : ""}
              disabled={saving}
              onChange={(value) => setDraft({ value })}
              onEnter={() => {
                if (draft && "value" in draft && draft.value.trim()) {
                  void record(item.ordinal, { value: draft.value.trim() });
                }
              }}
            />
          )}

          {!rec && !failure && (
            <div className="check-record">
              <button
                type="button"
                className="check-btn check-btn-primary"
                disabled={!draft || saving || ("value" in draft && !draft.value.trim())}
                onClick={() =>
                  draft && void record(item.ordinal, "value" in draft ? { value: draft.value.trim() } : draft)
                }
              >
                {saving ? "Recording…" : item.type === "G" ? "Record this order" : "Record answer"}
              </button>
              <p className="check-quiet">
                {item.type === "G"
                  ? "Arrange all of them first. Moving an item records nothing."
                  : draft
                    ? "Recording is final for this question."
                    : "Choose an answer, then record it."}
              </p>
            </div>
          )}

          {failure && !rec && (
            <div className="check-failed">
              <p>
                <strong>Not recorded.</strong> {failure} Your choice is still selected.
              </p>
              <button
                type="button"
                className="check-btn check-btn-primary"
                disabled={saving}
                onClick={() => draft && void record(item.ordinal, "value" in draft ? { value: draft.value.trim() } : draft)}
              >
                {saving ? "Recording…" : "Try again"}
              </button>
            </div>
          )}

          <div className="check-verdict" data-verdict="" aria-live="polite">
            {saving && <p className="check-quiet">Recording…</p>}
            {rec?.withheld && <p>Recorded. This paper shows its results after you submit.</p>}
            {rec?.verdict?.isCorrect === true && (
              <>
                <p className="check-verdict-word">Correct.</p>
                {rec.verdict.rationale && <p className="check-why">{rec.verdict.rationale}</p>}
              </>
            )}
            {rec?.verdict?.isCorrect === false && (
              <>
                {/* NEUTRAL. No red, no cross, no shake: the rationale is the teaching. */}
                <p className="check-verdict-word">
                  Not this one. The answer is <strong className={valueClass(rec.verdict.correctValue)}>{rec.verdict.correctValue}</strong>.
                </p>
                {rec.verdict.rationale && <p className="check-why">{rec.verdict.rationale}</p>}
              </>
            )}
          </div>

          <div className="check-step">
            <button type="button" className="check-btn" onClick={() => go(at - 1)} disabled={at === 0}>
              Previous question
            </button>
            <button type="button" className="check-btn" onClick={() => go(at + 1)} disabled={at === items.length - 1}>
              Next question
            </button>
          </div>
        </article>

        <div className="check-actions">
          <button
            type="button"
            ref={submitRef}
            className="check-btn check-btn-primary check-submit"
            onClick={() => setConfirming(true)}
          >
            Submit paper
          </button>
          <p className="check-quiet">
            {counts.open === 0
              ? "Every question is recorded."
              : `${counts.open} not answered. Unanswered questions score zero.`}
          </p>
          <button type="button" className="check-btn check-leave" onClick={onLeave}>
            Leave the paper
          </button>
          <p className="check-quiet">It stays open: recorded answers are kept, and Start resumes it.</p>
        </div>
        </div>
      </div>

      {confirming && (
        <ConfirmSubmit
          title={title}
          open={counts.open}
          flagged={flags.length}
          total={items.length}
          busy={submitting}
          onSubmit={() => void submit()}
          onCancel={() => {
            setConfirming(false);
            window.setTimeout(() => submitRef.current?.focus(), 0);
          }}
        />
      )}
    </section>
  );
}

/* ================================================================ loading */

function Loading(): JSX.Element {
  const show = useDelayed(true, 400);
  const slow = useDelayed(true, 3_000);
  if (!show) return <section className="check" data-runner="loading" data-paper="" aria-busy="true" />;
  return (
    <section className="check check-state" data-runner="loading" data-paper="" aria-busy="true" aria-labelledby="check-loading">
      <p id="check-loading" className={slow ? "check-slow" : "sr-only"} role="status">
        {slow
          ? "Still preparing your paper. The server may be waking up, which can take up to a minute."
          : "Preparing your paper"}
      </p>
      <div className="check-skeleton" data-skeleton="" aria-hidden="true">
        <div className="skel check-skel-title" />
        <div className="skel check-skel-line" />
        <div className="check-skel-body">
          <div className="check-skel-pips">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skel check-skel-pip" />
            ))}
          </div>
          <div className="check-skel-card">
            <div className="skel check-skel-line" />
            <div className="skel check-skel-stem" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skel check-skel-option" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ ordering */

/**
 * An ordering item: move up / move down, then Record this order.
 *
 * Buttons, not drag and drop: every surface works keyboard-only, and two
 * buttons per row ARE the keyboard path. Moving records nothing (da5831b: an
 * ordering item once rendered as radios and was graded wrong every time; and
 * committing on each move once stored the order after the FIRST click).
 */
function Ordering({
  options,
  recorded,
  draft,
  onChange,
}: {
  options: string[];
  recorded: string[] | null;
  draft: string[] | null;
  onChange: (order: string[]) => void;
}): JSX.Element {
  const order = recorded ?? draft ?? options;
  const locked = recorded !== null;

  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= order.length) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    onChange(next);
  };

  return (
    <div className="check-ordering">
      <p className="sr-only" id="ordering-help">
        Use the move up and move down buttons to put these in order, then press Record this order.
      </p>
      <ol className="check-ordering-list" aria-describedby="ordering-help">
        {order.map((opt, i) => (
          <li key={opt} className="check-ordering-row" data-order-row="">
            <span className="check-ordering-pos mono">{i + 1}</span>
            <span className="check-ordering-text">{opt}</span>
            {!locked && (
              <span className="check-ordering-moves">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move "${opt}" up, from position ${i + 1} to ${i}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move "${opt}" down, from position ${i + 1} to ${i + 2}`}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {locked && <p className="check-tag-line">Your recorded order.</p>}
    </div>
  );
}

/* ============================================================== free entry */

/**
 * A computed answer, typed. **Enter or Record commits; leaving the box does
 * not.** It used to record on blur, so pressing Next recorded whatever was
 * half typed, and the first recorded answer is final.
 */
function FreeEntry({
  unit,
  recorded,
  draft,
  disabled,
  onChange,
  onEnter,
}: {
  unit?: string | undefined;
  recorded: string | null;
  draft: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onEnter: () => void;
}): JSX.Element {
  return (
    <div className="check-entry">
      <label htmlFor="check-entry-box">Your answer{unit ? `, in ${unit}` : ""}</label>
      <div className="check-entry-row">
        <input
          id="check-entry-box"
          className="mono"
          inputMode="decimal"
          autoComplete="off"
          value={recorded ?? draft}
          readOnly={recorded !== null}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && recorded === null) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {unit && (
          <span className="check-unit mono" data-unit="">
            {unit}
          </span>
        )}
      </div>
      {recorded !== null && <p className="check-tag-line">Your recorded answer.</p>}
    </div>
  );
}

/* ================================================================ confirm */

/**
 * The one confirmation (`DESIGN-MANDATE.md` §1: "Submitting … asks once").
 * It names the cost in numbers; Keep working is the undo, and it is where focus
 * starts, so Enter on arrival does not hand the paper in.
 */
function ConfirmSubmit({
  title,
  open,
  flagged,
  total,
  busy,
  onSubmit,
  onCancel,
}: {
  title: string;
  open: number;
  flagged: number;
  total: number;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  const keep = useRef<HTMLButtonElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);

  return (
    <div className="check-scrim">
      <div
        className="check-dialog"
        data-paper=""
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onCancel();
          if (e.key === "Tab") {
            // Two controls: keep focus between them.
            e.preventDefault();
            (document.activeElement === keep.current ? go.current : keep.current)?.focus();
          }
        }}
      >
        <h2 id="confirm-title">Submit {title}?</h2>
        <div id="confirm-body">
          <p>
            {open === 0 ? (
              <>
                All <span className="mono">{total}</span> questions are recorded.
              </>
            ) : (
              <>
                <span className="mono">{open}</span> not answered score zero.
              </>
            )}
            {flagged > 0 && (
              <>
                {" "}
                <span className="mono">{flagged}</span> flagged to come back to.
              </>
            )}
          </p>
          <p>This cannot be undone.</p>
        </div>
        <div className="check-row">
          <button type="button" ref={go} className="check-btn check-btn-primary" disabled={busy} onClick={onSubmit}>
            {busy ? "Submitting…" : "Submit now"}
          </button>
          <button type="button" ref={keep} className="check-btn" disabled={busy} onClick={onCancel}>
            Keep working
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================= result */

/**
 * The result, per objective in the syllabus's words, then what was missed with
 * the question itself. A score says how it went; this says what to do next.
 */
function Result({
  result,
  title,
  items,
  recorded,
  objectives,
  onLeave,
}: {
  result: SubmitResult;
  title: string;
  items: PaperItem[];
  recorded: Record<number, Recorded>;
  objectives: Record<string, string>;
  onLeave: () => void;
}): JSX.Element {
  const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const missed = result.review.filter((r) => !r.isCorrect);
  const back = useRef<HTMLHeadingElement>(null);
  useEffect(() => back.current?.focus(), []);

  return (
    <section className="check check-result" data-runner="done" data-paper="" aria-labelledby="result-title">
      <p className="check-eyebrow">Submitted</p>
      <h1 id="result-title" tabIndex={-1} ref={back}>
        {title}
      </h1>
      <p className="check-score">
        <span className="mono" data-score="">
          {result.score} / {result.maxScore}
        </span>
        <span className="check-score-pct mono"> {pct}%</span>
      </p>

      <h2>By objective</h2>
      <ul className="check-objectives">
        {Object.entries(result.byObjective).map(([obj, v]) => (
          <li key={obj}>
            <span className="mono check-obj-id">{obj}</span>
            <span className="check-obj-text">{objectives[obj] ?? "Objective"}</span>
            <span className="check-obj-frac mono">
              {v.correct} of {v.total}
            </span>
          </li>
        ))}
      </ul>

      {missed.length > 0 && (
        <>
          <h2>What you missed</h2>
          <ol className="check-missed">
            {missed.map((r) => {
              const it = items.find((i) => i.ordinal === r.ordinal);
              const rec = recorded[r.ordinal];
              return (
                <li key={r.ordinal}>
                  <p className="mono check-quiet">Question {r.ordinal}</p>
                  {it && <p className="check-missed-stem">{it.stem}</p>}
                  <p>
                    {rec && it ? (
                      <>
                        You answered <span className={valueClass(answerText(it, rec.answer))}>{answerText(it, rec.answer)}</span>.{" "}
                      </>
                    ) : (
                      <>Not answered. </>
                    )}
                    The answer is <strong className={valueClass(r.correctValue)}>{r.correctValue}</strong>.
                  </p>
                  {r.rationale && <p className="check-why">{r.rationale}</p>}
                </li>
              );
            })}
          </ol>
        </>
      )}

      <button type="button" className="check-btn check-btn-primary" onClick={onLeave}>
        Back to the stage
      </button>
    </section>
  );
}
