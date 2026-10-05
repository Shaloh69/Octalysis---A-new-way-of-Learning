import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type StageDetail } from "../lib/api";
import { parseInline, sectionsOf } from "../lib/markdown";
import { useDelayed } from "../lib/useDelayed";
import { WarpLink } from "../shell/RealmWarp";
import { InlineText, ReaderBlocks, sectionId } from "./ReaderBlocks";
import { byObjectiveId } from "../map/useSelection";
import { toast } from "../lib/toast";
import { useShellData } from "../shell/ShellData";

/**
 * `/app/stage/:id`, the reader, REMADE under ruling 2 (30 Sep 2026;
 * WEB-REMAKE.md §3; design/templates/web/stage/SPEC.md). Inside the planet, so
 * the biome shell holds the page: its sprite nav bar above, the planet's scene
 * behind. This route adds, from Stardew Valley's journal and letter:
 *
 *   a sprite SIDE BAR   "In this stage": the sections, where you are, and what
 *                       you should be able to do (a sheet behind a sprite
 *                       Contents button at 380)
 *   the LETTER          the reading on the biome's paper, in a sprite frame
 *
 * Behaviour carried from the 29 Sep reader, unchanged: the parser, the resume
 * per device, the lock card with the server's reason, the check at the end,
 * the arrival skeleton. Content comes from the database, never a bundle (hard
 * rule 5); the lock, the state and the threshold come from the API (hard rule
 * 4); this file computes none of them. Leaving goes back to the map with this
 * planet selected, through the shell's warp.
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
  onStartCheck,
}: {
  stageId: string;
  onBack?: () => void;
  onProgressChanged?: () => void;
  /** Opens the attempt runner. Absent on surfaces that cannot sit a check. */
  onStartCheck?: (assessmentId: string, title: string) => void;
}): JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

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
              err instanceof ApiError ? err.message : "The stage could not be reached. Check your connection, then try again.",
          });
      });
    return () => {
      live = false;
    };
  }, [stageId, attempt]);

  const toMap = `/app?stage=${encodeURIComponent(stageId)}`;
  const page = (state: string, children: JSX.Element, busy = false) => (
    <div className="rd" data-reader={state} aria-busy={busy || undefined}>
      {children}
    </div>
  );

  if (load.kind === "loading") return page("loading", <Arriving stageId={stageId} />, true);

  if (load.kind === "missing" || load.kind === "error") {
    const missing = load.kind === "missing";
    return page(
      missing ? "missing" : "error",
      <section className="rd-letter rd-single sprite-panel rd-state" aria-labelledby="rd-state-title">
        <h1 id="rd-state-title">
          {missing ? "No such stage" : <>Stage <span className="mono">{stageId}</span> did not load</>}
        </h1>
        <p role="alert">{load.message}</p>
        <div className="rd-row">
          {!missing && (
            <button type="button" className="sprite-button button-primary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
          <WarpLink to={toMap} className="sprite-button">
            Back to the map
          </WarpLink>
        </div>
      </section>,
    );
  }

  const stage = load.stage;
  return page(
    stage.locked ? "locked" : stage.blocks.length === 0 ? "empty" : "reading",
    stage.locked ? (
      <LockCard stage={stage} toMap={toMap} />
    ) : (
      <Reading stage={stage} toMap={toMap} onStartCheck={onStartCheck} />
    ),
  );
}

/* ------------------------------------------------------------ arriving */

/**
 * ARRIVAL, not a spinner (BIOME-AND-LOADING-SPEC.md §4.2): the planet's biome is
 * already there (the shell's), and the reading follows the loading rule: nothing
 * under 400ms, a skeleton shaped like the side bar and the letter after, and a
 * sentence after 3s (Render's free tier can take ~50s to wake).
 */
function Arriving({ stageId }: { stageId: string }): JSX.Element {
  const show = useDelayed(true, 400);
  const slow = useDelayed(true, 3_000);
  return (
    <>
      <span className="sr-only">Arriving at stage {stageId}</span>
      {show && (
        <div className="rd-frame" data-skeleton="" aria-hidden="true">
          <div className="rd-side sprite-panel rd-skel-side" data-skel-block="">
            <span className="skel skel-line rd-skel" data-skel="" style={{ width: "60%" }} />
            <span className="skel skel-line rd-skel" data-skel="" />
            <span className="skel skel-line rd-skel" data-skel="" style={{ width: "80%" }} />
          </div>
          <div className="rd-letter sprite-panel" data-skel-block="" data-skel-surface="">
            {slow && <p className="rd-slow">Still arriving. The server may be waking up, which can take up to a minute.</p>}
            <span className="skel skel-line rd-skel" data-skel="" style={{ width: "20%" }} />
            <span className="skel rd-skel rd-skel-title" data-skel="" />
            <span className="skel skel-line rd-skel" data-skel="" />
            <span className="skel skel-line rd-skel" data-skel="" style={{ width: "92%" }} />
            <span className="skel skel-line rd-skel" data-skel="" style={{ width: "86%" }} />
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
  toMap,
  onStartCheck,
}: {
  stage: StageDetail;
  toMap: string;
  onStartCheck?: ((assessmentId: string, title: string) => void) | undefined;
}): JSX.Element {
  /*
   * The side bar's sections: Brief, every `##`, Check. Those are the beats
   * every archetype declares and the data holds; no beat the blocks lack is
   * shown (apps/web/CLAUDE.md, INV-27).
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
   * Where you are, from the scroll alone: the last section whose heading has
   * passed 40% of the viewport, and the last section at the page's end (a short
   * final section can never reach the line). A section chosen in the side bar
   * holds until the scroll settles.
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
      <aside className="rd-side sprite-panel" data-rail="" aria-labelledby="rd-rail-title">
        <SideContents
          titleId="rd-rail-title"
          stage={stage}
          sections={sections}
          current={current}
          count={count}
          onPick={goTo}
        />
      </aside>

      <article className="rd-letter sprite-panel rd-enter" aria-labelledby="rd-title">
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
            <button type="button" className="sprite-button" onClick={() => goTo(resume.index)}>
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

        {stage.assessment && <CheckCard assessment={stage.assessment} onStart={onStartCheck} />}

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
          {!stage.gradeable && <ReadToTheEnd stage={stage} />}
          <WarpLink to={toMap} className="sprite-button">
            Back to the map
          </WarpLink>
        </footer>
      </article>

      {/* 380: the side bar is a sheet behind a sprite button. */}
      <button
        ref={pill}
        type="button"
        className="rd-pill sprite-button"
        aria-expanded={sheet}
        aria-controls="rd-sheet"
        onClick={() => (sheet ? closeSheet() : setSheet(true))}
      >
        Contents{count && <> · <span className="mono">{count}</span></>}
      </button>
      <div id="rd-sheet" className="rd-sheet sprite-panel" data-sheet="" role="region" aria-labelledby="rd-sheet-title" hidden={!sheet}>
        <SideContents
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
        <button type="button" className="sprite-button rd-sheet-close" onClick={closeSheet}>
          Close
        </button>
      </div>
    </div>
  );
}

/** Seconds before a finished Orientation carries the student on. */
const CARRY_S = 5;

/**
 * The end of an UNGRADED stage (instructor, 5 Oct 2026: "if orientation is
 * done reading, automatically mark it as mastered then move to the next
 * stage"). Reaching the end of the letter records it with the server (which
 * decides; this never does), confirms it, and carries the student to the next
 * stage after CARRY_S seconds, with Go now and Stay here. Only the FIRST
 * finish carries: a stage already mastered just offers the way on, so a
 * re-read is never hijacked. A countdown, not motion: it runs under reduced
 * motion too, and every step is in words.
 */
function ReadToTheEnd({ stage }: { stage: StageDetail }): JSX.Element {
  const navigate = useNavigate();
  const { reload, map } = useShellData();
  // On a revisit, the stage after this one in curriculum order (the server named it on the first finish).
  const after = map ? ([...map.nodes].sort((a, b) => a.ordinal - b.ordinal).find((n) => n.ordinal > (map.nodes.find((x) => x.id === stage.id)?.ordinal ?? Infinity))?.id ?? null) : null;
  const already = stage.state === "mastered";
  const [phase, setPhase] = useState<"reading" | "saving" | "done" | "failed" | "staying">(already ? "done" : "reading");
  const [named, setNext] = useState<string | null>(null);
  const next = named ?? (already ? after : null);
  const [left, setLeft] = useState<number | null>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const sent = useRef(false);

  const finish = async () => {
    if (sent.current) return;
    sent.current = true;
    setPhase("saving");
    try {
      const r = await api.readStage(stage.id);
      setNext(r.next);
      setPhase("done");
      setLeft(r.next ? CARRY_S : null);
      toast.success(`Stage ${stage.id} · ${stage.title} mastered`, r.next ? `Stage ${r.next} is next.` : undefined);
      void reload();
    } catch (err) {
      sent.current = false;
      setPhase("failed");
      toast.error(`Stage ${stage.id} was not recorded`, err instanceof ApiError ? err.message : "Check your connection, then try again.");
    }
  };

  // The end of the letter in view is the end of the reading.
  useEffect(() => {
    if (already || !mark.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void finish();
    });
    io.observe(mark.current);
    return () => io.disconnect();
  }, [already]);

  useEffect(() => {
    if (left === null || phase !== "done" || !next) return;
    if (left <= 0) {
      navigate(`/app/stage/${next}`);
      return;
    }
    const t = window.setTimeout(() => setLeft(left - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, phase, next, navigate]);

  return (
    <div className="rd-finish" data-finish={phase}>
      <span ref={mark} aria-hidden="true" />
      <p role="status">
        {phase === "reading" && "Read to the end to finish this stage."}
        {phase === "saving" && "Recording that you have read it."}
        {phase === "done" && (
          <>
            Stage <span className="mono">{stage.id}</span> is mastered.
            {next && left !== null && left > 0 && (
              <>
                {" "}Taking you to Stage <span className="mono">{next}</span> in <span className="mono">{left}</span>s.
              </>
            )}
          </>
        )}
        {phase === "staying" && "Staying here. The next stage is open whenever you are."}
        {phase === "failed" && "That was not recorded. Nothing was lost; try again."}
      </p>
      <div className="rd-row">
        {phase === "failed" && (
          <button type="button" className="sprite-button button-primary" onClick={() => void finish()}>
            Try again
          </button>
        )}
        {(phase === "done" || phase === "staying") && next && (
          <Link to={`/app/stage/${next}`} className="sprite-button button-primary">
            {left !== null && left > 0 ? "Go now" : <>Go to Stage <span className="mono">{next}</span></>}
          </Link>
        )}
        {phase === "done" && left !== null && left > 0 && (
          <button
            type="button"
            className="sprite-button"
            onClick={() => {
              setLeft(null);
              setPhase("staying");
            }}
          >
            Stay here
          </button>
        )}
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

function SideContents({
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
      <h2 id={titleId} ref={headRef} tabIndex={-1} className="rd-side-title">
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
                    <span className="rd-sections-mark" aria-hidden="true" />
                    <span>
                      <Words text={s.label} />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </>
      )}
      <h3 className="rd-side-sub">What you should be able to do</h3>
      <ul className="rd-objectives">
        {[...stage.objectives].sort(byObjectiveId).map((o) => (
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
 * has met the material. It states its cost before it is pressed. The runner
 * shows its start prompt first (ruling 3); Start begins or resumes the attempt.
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
      <p className="rd-check-tab" aria-hidden="true">
        Check
      </p>
      <h2 id="rd-check-title">
        <Words text={assessment.title} />
      </h2>
      <p>
        Your questions are generated for you: the numbers differ from everyone else&apos;s. Going to it shows the
        rules first; the attempt starts only when you press Start, in full screen, with no way back until you submit.
      </p>
      <p className="rd-check-count">
        <span className="mono">
          {assessment.attemptsUsed} of {assessment.attemptsAllowed}
        </span>{" "}
        attempts used
      </p>
      {notOpen && <p className="rd-check-note">This check opens {when(assessment.opensAt!)}.</p>}
      {closed && <p className="rd-check-note">This check closed {when(assessment.closesAt!)}.</p>}
      {exhausted && !closed && <p className="rd-check-note">You have used every attempt. Your instructor can grant another.</p>}
      {onStart && (
        <button
          type="button"
          className="sprite-button button-primary"
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
 * The lock card (PAGE-SPECS): the server's reason, verbatim, with the distance;
 * a way to the prerequisite; what the stage covers, as a preview.
 */
function LockCard({ stage, toMap }: { stage: StageDetail; toMap: string }): JSX.Element {
  const reason = stage.lockReason;
  return (
    <div className="rd-frame rd-frame-single">
      <section className="rd-letter sprite-panel rd-enter rd-lock" aria-labelledby="rd-title">
        <header className="rd-head">
          <p className="rd-eyebrow">
            Stage <span className="mono">{stage.id}</span>
          </p>
          <h1 id="rd-title">{stage.title}</h1>
        </header>

        <div className="rd-lock-card">
          <h2>
            <svg className="glyph" aria-hidden="true" viewBox="0 0 16 16">
              <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="2.5" y="7" width="11" height="7.5" rx="1" fill="currentColor" />
            </svg>{" "}
            Not open yet
          </h2>
          <p className="rd-reason" data-reason="">
            {reason ? <Words text={reason.message} /> : "This stage is not open to you yet."}
          </p>
          {reason?.kind === "prereq" && (
            <>
              <p className="rd-quiet">Your instructor can also open it for you.</p>
              <div className="rd-row">
                {reason.blockingStages.map((id) => (
                  <WarpLink key={id} to={`/app/stage/${id}`} className="sprite-button button-primary">
                    Go to Stage <span className="mono">{id}</span>
                  </WarpLink>
                ))}
                <WarpLink to={toMap} className="sprite-button">
                  Back to the map
                </WarpLink>
              </div>
            </>
          )}
        </div>

        <h2 className="rd-lock-sub">What you should be able to do</h2>
        <ul className="rd-objectives">
          {[...stage.objectives].sort(byObjectiveId).map((o) => (
            <li key={o.id}>
              <span className="mono rd-obj-id">{o.id}</span> <Words text={o.description} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
