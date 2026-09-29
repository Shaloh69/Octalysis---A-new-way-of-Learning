import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type StageDetail } from "../lib/api";
import { parseInline, sectionsOf } from "../lib/markdown";
import { useDelayed } from "../lib/useDelayed";
import { InlineText, ReaderBlocks, sectionId } from "./ReaderBlocks";

/**
 * `/app/stage/:id`, the stage reader. Rebuilt 29 Sep 2026 against
 * `design/templates/web/stage/` (SPEC.md there, MDN's article page as the
 * reference): one reading column over the student's biome, a rail that says
 * what the stage is for and where you are, a bottom sheet at 380.
 *
 * Content comes from the database, never from a bundle (hard rule 5), and is
 * rendered, never edited. The lock, the state and the threshold come from the
 * API (hard rule 4); this file computes none of them.
 *
 * Instructor decisions, 29 Sep 2026: leave only (no Finish button; the end says
 * what finishes a stage); resume per device; the lock reason from the server;
 * a rail of what has data (no glossary, no notebook: neither exists).
 */

const CHECK_ID = "rd-check";
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* The reading position, per device. Never gradeable, and the page is whole without it. */
const storeKey = (stageId: string) => `octa:reader:${stageId}`;
export function readPosition(stageId: string): { index: number; label: string } | null {
  try {
    const raw = localStorage.getItem(storeKey(stageId));
    if (!raw) return null;
    const v = JSON.parse(raw) as { index?: unknown; label?: unknown };
    return typeof v.index === "number" && typeof v.label === "string" ? { index: v.index, label: v.label } : null;
  } catch {
    return null;
  }
}
function writePosition(stageId: string, index: number, label: string): void {
  try {
    localStorage.setItem(storeKey(stageId), JSON.stringify({ index, label }));
  } catch {
    /* storage refused: resume is a convenience, never a requirement */
  }
}

/** A sentence with its numbers in mono and its words in prose. */
const Words = ({ text }: { text: string }) => <InlineText c={parseInline(text)} />;

type Load =
  | { kind: "loading" }
  | { kind: "ready"; stage: StageDetail }
  | { kind: "error"; message: string }
  | { kind: "missing"; message: string };

export function StageReader({
  stageId,
  onBack,
  onStartCheck,
}: {
  stageId: string;
  onBack: () => void;
  onProgressChanged?: () => void;
  /** Opens the attempt runner. Absent on surfaces that cannot sit a check. */
  onStartCheck?: (assessmentId: string, title: string) => void;
}): JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    api
      .stage(stageId)
      .then((stage) => live && setLoad({ kind: "ready", stage }))
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setLoad({ kind: "missing", message: err.message });
        else
          setLoad({
            kind: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "The stage could not be reached. Check your connection, then try again.",
          });
      });
    return () => {
      live = false;
    };
  }, [stageId, attempt]);

  /*
   * The reverse travel transition (`.claude/rules/design.md`): the reading
   * recedes, then the map. Under reduced motion it is a cut. A modified click
   * (new tab, new window) is the browser's, untouched.
   */
  const leave = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const go = () => {
        if (leftRef.current) return;
        leftRef.current = true;
        onBack();
      };
      if (reduced()) return go();
      setLeaving(true);
      window.setTimeout(go, 400); // if animationend never arrives
    },
    [onBack],
  );
  const onAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === "reader-leave" && !leftRef.current) {
      leftRef.current = true;
      onBack();
    }
  };

  /*
   * The page: the biome and a token scrim behind, then the route's own
   * surfaces (`[data-reader]`). The scene sits OUTSIDE `[data-reader]` so the
   * gate measures the reader, not the weather; the leave fade is on the whole
   * page and is opacity only, because a transform here would break the
   * biome's `position: fixed`.
   */
  const page = (state: string, children: JSX.Element, busy = false) => (
    <div className={`rd-page${leaving ? " rd-leaving" : ""}`} onAnimationEnd={onAnimationEnd}>
      <div className="rd" data-reader={state} aria-busy={busy || undefined}>
        {children}
      </div>
    </div>
  );

  if (load.kind === "loading") return page("loading", <Arriving stageId={stageId} />, true);

  if (load.kind === "missing" || load.kind === "error") {
    const missing = load.kind === "missing";
    return page(
      missing ? "missing" : "error",
      <div className="rd-frame rd-frame-single">
        <section className="rd-column rd-state" aria-labelledby="rd-state-title">
          <h1 id="rd-state-title">{missing ? "No such stage" : <>Stage <span className="mono">{stageId}</span> did not load</>}</h1>
          <p role="alert">{load.message}</p>
          <div className="rd-row">
            {!missing && (
              <button type="button" className="rd-btn rd-btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            )}
            <Link to="/app" className="rd-btn" onClick={leave}>
              Back to the map
            </Link>
          </div>
        </section>
      </div>,
    );
  }

  const stage = load.stage;
  return page(
    stage.locked ? "locked" : stage.blocks.length === 0 ? "empty" : "reading",
    stage.locked ? (
      <LockCard stage={stage} onLeave={leave} />
    ) : (
      <Reading stage={stage} onLeave={leave} onStartCheck={onStartCheck} />
    ),
  );
}

/* ------------------------------------------------------------ arriving */

/**
 * ARRIVAL, not a spinner (`BIOME-AND-LOADING-SPEC.md` §4.2): the biome is there
 * at once, because it is the destination; everything else follows the loading
 * rule. Nothing under 400ms, a skeleton shaped like the reader after, and a
 * sentence at its top after 3s (Render's free tier can take ~50s to wake).
 */
function Arriving({ stageId }: { stageId: string }): JSX.Element {
  const show = useDelayed(true, 400);
  const slow = useDelayed(true, 3_000);
  return (
    <>
      <span className="sr-only">Arriving at stage {stageId}</span>
      {show && (
        <div className="rd-frame" data-skeleton="" aria-hidden="true">
          <div className="rd-column rd-skel-column">
            {slow && (
              <p className="rd-slow">Still arriving. The server may be waking up, which can take up to a minute.</p>
            )}
            <div className="rd-skel rd-skel-eyebrow" />
            <div className="rd-skel rd-skel-title" />
            <div className="rd-skel rd-skel-line" style={{ width: "40%" }} />
            <div className="rd-skel-block">
              <div className="rd-skel rd-skel-line" />
              <div className="rd-skel rd-skel-line" style={{ width: "92%" }} />
              <div className="rd-skel rd-skel-line" style={{ width: "86%" }} />
            </div>
            <div className="rd-skel-block">
              <div className="rd-skel rd-skel-head" />
              <div className="rd-skel rd-skel-line" />
              <div className="rd-skel rd-skel-line" style={{ width: "95%" }} />
              <div className="rd-skel rd-skel-line" style={{ width: "70%" }} />
            </div>
          </div>
          <div className="rd-rail rd-skel-rail">
            <div className="rd-skel rd-skel-line" style={{ width: "60%" }} />
            <div className="rd-skel rd-skel-line" />
            <div className="rd-skel rd-skel-line" style={{ width: "80%" }} />
            <div className="rd-skel rd-skel-line" style={{ width: "70%" }} />
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ the reading */

interface Section {
  id: string;
  label: string;
}

function Reading({
  stage,
  onLeave,
  onStartCheck,
}: {
  stage: StageDetail;
  onLeave: (e: MouseEvent<HTMLAnchorElement>) => void;
  onStartCheck?: ((assessmentId: string, title: string) => void) | undefined;
}): JSX.Element {
  /*
   * The rail's sections: Brief, every `##`, Check. Those are the beats every
   * archetype declares and the data holds; no beat the blocks lack is shown
   * (apps/web/CLAUDE.md, INV-27).
   */
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (stage.blocks.some((b) => b.kind === "brief")) out.push({ id: sectionId(0), label: "Brief" });
    for (const s of sectionsOf(stage.blocks)) out.push({ id: sectionId(s.section), label: s.label });
    if (stage.assessment) out.push({ id: CHECK_ID, label: "Check" });
    return out;
  }, [stage]);

  const [current, setCurrent] = useState(0);
  const [resume] = useState(() => {
    const p = readPosition(stage.id);
    return p && p.index > 0 && sections[p.index]?.label === p.label ? p : null;
  });
  const [sheet, setSheet] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const sheetHead = useRef<HTMLHeadingElement>(null);
  const pinned = useRef<number | null>(null);
  // Nothing is saved until the student moves: arriving must not erase the
  // position a previous visit left.
  const moved = useRef(false);

  /*
   * Section progress from the scroll position alone: the current section is the
   * last whose heading has passed 40% of the viewport, and the last section
   * once the page is at its end (a short final section can never reach the
   * line). A section chosen from the rail holds until the scroll settles.
   */
  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let idx = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      });
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4 && window.scrollY > 0) idx = sections.length - 1;
      if (pinned.current !== null) {
        const target = document.getElementById(sections[pinned.current]!.id);
        const top = target?.getBoundingClientRect().top ?? 0;
        if (Math.abs(top) > 24 && idx !== pinned.current && !(window.innerHeight + window.scrollY >= doc.scrollHeight - 4)) return;
        idx = pinned.current;
        pinned.current = null;
      }
      setCurrent(idx);
    };
    const onScroll = () => {
      moved.current = true;
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  useEffect(() => {
    const s = sections[current];
    if (s && moved.current) writePosition(stage.id, current, s.label);
  }, [current, sections, stage.id]);

  const goTo = (i: number) => {
    const s = sections[i];
    const el = s && document.getElementById(s.id);
    if (!el) return;
    pinned.current = i;
    moved.current = true;
    setCurrent(i);
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!sheet) return;
    sheetHead.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const closeSheet = () => {
    setSheet(false);
    pill.current?.focus();
  };

  const count = sections.length > 0 ? `${current + 1} of ${sections.length}` : null;

  return (
    <div className="rd-frame">
      <article className="rd-column rd-enter" aria-labelledby="rd-title">
        <Link to="/app" className="rd-back" onClick={onLeave}>
          <span aria-hidden="true">&larr; </span>Back to the map
        </Link>

        <header className="rd-head">
          <p className="rd-eyebrow">
            Stage <span className="mono">{stage.id}</span>
          </p>
          <h1 id="rd-title">{stage.title}</h1>
          <p className="rd-meta">
            <span className="mono">{stage.estMinutes}</span> minutes
            {stage.levels.length > 0 && (
              <>
                {" · "}
                <span className="mono">{stage.levels.map((l) => `L${l}`).join(" ")}</span>
              </>
            )}
          </p>
          <p className="rd-stateline" data-state="">
            <StateWords stage={stage} />
          </p>
        </header>

        {resume && (
          <p className="rd-resume" data-resume="">
            <span>You were reading: {resume.label}</span>
            <button type="button" className="rd-btn" onClick={() => goTo(resume.index)}>
              Resume
            </button>
          </p>
        )}

        {stage.blocks.length === 0 ? (
          <p className="rd-empty">
            The reading for this stage has not been published yet. What it covers is listed under{" "}
            <em>What you should be able to do</em>.
          </p>
        ) : (
          <div className="rd-reading" data-reading="">
            <ReaderBlocks blocks={stage.blocks} stageId={stage.id} />
          </div>
        )}

        {stage.assessment && (
          <CheckCard assessment={stage.assessment} onStart={onStartCheck} />
        )}

        <footer className="rd-end" data-end="">
          <p className="rd-end-title">End of the reading.</p>
          <p>
            {stage.assessment ? (
              <>
                This stage is mastered when your best check reaches{" "}
                <span className="mono">{Math.round(stage.masteryThreshold * 100)}%</span>.
              </>
            ) : stage.gradeable ? (
              "This stage has no check yet."
            ) : (
              "This stage has no check. Nothing in it is graded."
            )}
          </p>
          <Link to="/app" className="rd-btn" onClick={onLeave}>
            Back to the map
          </Link>
        </footer>
      </article>

      <aside className="rd-rail" data-rail="" aria-labelledby="rd-rail-title">
        <RailContents
          titleId="rd-rail-title"
          stage={stage}
          sections={sections}
          current={current}
          count={count}
          onPick={goTo}
        />
      </aside>

      {/* 380: a pill bottom-LEFT, opposite the shell's Report a problem. */}
      <button
        ref={pill}
        type="button"
        className="rd-pill"
        aria-expanded={sheet}
        aria-controls="rd-sheet"
        onClick={() => (sheet ? closeSheet() : setSheet(true))}
      >
        Contents{count && <> · <span className="mono">{count}</span></>}
      </button>
      <div id="rd-sheet" className="rd-sheet" data-sheet="" role="region" aria-labelledby="rd-sheet-title" hidden={!sheet}>
        <RailContents
          titleId="rd-sheet-title"
          headRef={sheetHead}
          stage={stage}
          sections={sections}
          current={current}
          count={count}
          onPick={(i) => {
            setSheet(false);
            pill.current?.focus({ preventScroll: true });
            goTo(i);
          }}
        />
        <button type="button" className="rd-btn rd-sheet-close" onClick={closeSheet}>
          Close
        </button>
      </div>
    </div>
  );
}

function StateWords({ stage }: { stage: StageDetail }): JSX.Element {
  const pct = <span className="mono">{Math.round((stage.mastery ?? 0) * 100)}%</span>;
  if (!stage.gradeable) return <>Not graded</>;
  switch (stage.state) {
    case "mastered":
      return <>Mastered: your best check is {pct}</>;
    case "in_progress":
      return <>In progress: your best check is {pct}</>;
    case "locked":
      return <>Closed to students; open to you as staff</>;
    default:
      return <>Not started</>;
  }
}

function RailContents({
  titleId,
  headRef,
  stage,
  sections,
  current,
  count,
  onPick,
}: {
  titleId: string;
  headRef?: React.Ref<HTMLHeadingElement>;
  stage: StageDetail;
  sections: Section[];
  current: number;
  count: string | null;
  onPick: (i: number) => void;
}): JSX.Element {
  return (
    <>
      <h2 id={titleId} ref={headRef} tabIndex={-1} className="rd-rail-title">
        In this stage
      </h2>
      {sections.length > 0 && (
        <>
          <p className="rd-progress" data-progress="">
            Section <span className="mono">{count}</span>
          </p>
          <nav aria-label="Sections">
            <ol className="rd-sections">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={i === current ? "location" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      onPick(i);
                    }}
                  >
                    <Words text={s.label} />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </>
      )}
      <h3 className="rd-rail-sub">What you should be able to do</h3>
      <ul className="rd-objectives">
        {stage.objectives.map((o) => (
          <li key={o.id}>
            <span className="mono rd-obj-id">{o.id}</span> <Words text={o.description} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The stage check, at the END of the reading: a student who has read this far
 * has met the material. It states its cost before it is pressed, because the
 * runner starts an attempt on arrival (or reopens the one left open).
 */
function CheckCard({
  assessment,
  onStart,
}: {
  assessment: NonNullable<StageDetail["assessment"]>;
  onStart?: ((assessmentId: string, title: string) => void) | undefined;
}): JSX.Element {
  const now = new Date();
  const notOpen = assessment.opensAt ? new Date(assessment.opensAt) > now : false;
  const closed = assessment.closesAt ? new Date(assessment.closesAt) < now : false;
  const exhausted = assessment.attemptsUsed >= assessment.attemptsAllowed;
  const when = (iso: string) => <span className="mono">{new Date(iso).toLocaleString()}</span>;

  return (
    <section className="rd-check" id={CHECK_ID} tabIndex={-1} data-check="" aria-labelledby="rd-check-title">
      <h2 id="rd-check-title">
        <Words text={assessment.title} />
      </h2>
      <p>
        Your questions are generated for you: the numbers differ from everyone else&apos;s. Going to it starts an
        attempt, or reopens one you left open.
      </p>
      <p className="rd-check-count">
        <span className="mono">
          {assessment.attemptsUsed} of {assessment.attemptsAllowed}
        </span>{" "}
        attempts used
      </p>
      {notOpen && <p className="rd-check-note">This check opens {when(assessment.opensAt!)}.</p>}
      {closed && <p className="rd-check-note">This check closed {when(assessment.closesAt!)}.</p>}
      {exhausted && !closed && (
        <p className="rd-check-note">You have used every attempt. Your instructor can grant another.</p>
      )}
      {onStart && (
        <button
          type="button"
          className="rd-btn rd-btn-primary"
          disabled={notOpen || closed || exhausted}
          onClick={() => onStart(assessment.id, assessment.title)}
        >
          Go to <Words text={assessment.title} />
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ locked */

/**
 * The full-page lock card (PAGE-SPECS): the server's reason, verbatim, with
 * the distance; a way to the prerequisite; what the stage covers, as a
 * preview (Petal 6: scarcity that still respects autonomy).
 */
function LockCard({
  stage,
  onLeave,
}: {
  stage: StageDetail;
  onLeave: (e: MouseEvent<HTMLAnchorElement>) => void;
}): JSX.Element {
  const reason = stage.lockReason;
  return (
    <div className="rd-frame rd-frame-single">
      <section className="rd-column rd-enter rd-lock" aria-labelledby="rd-title">
        <Link to="/app" className="rd-back" onClick={onLeave}>
          <span aria-hidden="true">&larr; </span>Back to the map
        </Link>
        <header className="rd-head">
          <p className="rd-eyebrow">
            Stage <span className="mono">{stage.id}</span>
          </p>
          <h1 id="rd-title">{stage.title}</h1>
        </header>

        <div className="rd-lock-card">
          <h2>Not open yet</h2>
          <p className="rd-reason" data-reason="">
            {reason ? <Words text={reason.message} /> : "This stage is not open to you yet."}
          </p>
          {reason?.kind === "prereq" && (
            <>
              <p className="rd-quiet">Your instructor can also open it for you.</p>
              <div className="rd-row">
                {reason.blockingStages.map((id) => (
                  <Link key={id} to={`/app/stage/${id}`} className="rd-btn rd-btn-primary">
                    Go to Stage <span className="mono">{id}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <h2 className="rd-lock-sub">What you should be able to do</h2>
        <ul className="rd-objectives">
          {stage.objectives.map((o) => (
            <li key={o.id}>
              <span className="mono rd-obj-id">{o.id}</span> <Words text={o.description} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
