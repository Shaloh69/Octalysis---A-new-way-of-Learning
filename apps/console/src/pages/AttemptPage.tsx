import { Sitting } from "./record/Sitting";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiError, type AttemptDetail } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { sequence, showsKey, STATUS_WORD, TYPE_WORD, duration, verdict, type AttemptStatus, type PaperItem } from "@/lib/record-view";
import { indexLabel, indexMark, MARK_GLYPH, paperFacts, paramsLine, statusNote } from "@/lib/paper-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * `/attempts/:attemptId`: one paper, as the student sat it, on its own page.
 * Rebuilt 29 Sep 2026 against `design/templates/console/attempts-detail/SPEC.md`;
 * gated by `design/specs/console-attempts-detail.spec.ts`.
 *
 * Regenerated, not stored: from `attempts.seed` and `engine_version` the server
 * replays the exact variant (same numbers, same options, same order), which
 * `services/api/test/console.spec.ts` asserts byte for byte.
 *
 * IT CAN SHOW THE ANSWER KEY (hard rule 1). Allowed because the reader is staff
 * (`requireStaff()`, a student is refused 403 before the paper is looked up),
 * this is the console's bundle and never the student's (`scripts/scan-bundle.mjs`
 * forbids `correctValue` in apps/web), and `ai_after_submit` grants staff the
 * same read in the database. The key, verdicts and rationales are shown only
 * for a paper that was handed in: `showsKey()`, the record's own rule
 * (instructor, 27 and 29 Sep 2026), decided on render, not in the payload.
 * This file must never be imported by `apps/web`.
 */

type Read = { paper: AttemptDetail } | { missing: string };

export function AttemptPage() {
  const { attemptId = "" } = useParams();
  const read = useAsync<Read>(
    () =>
      api.attempt(attemptId).then(
        (paper) => ({ paper }),
        (e: unknown) => {
          // No such paper: trying again cannot help, so this is a state, not an error.
          if (e instanceof ApiError && e.status === 404) return { missing: e.message };
          throw e;
        },
      ),
    [attemptId],
  );
  const firstLoad = read.loading && !read.data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  if (read.error && !read.data) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ink">
          This paper could not be loaded. <span className="text-ink-muted">{read.error}</span>
        </p>
        <Button size="sm" variant="outline" onClick={read.reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (firstLoad || !read.data) {
    return showSkeleton ? <PaperSkeleton slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />;
  }
  if ("missing" in read.data) {
    return (
      <div className="pp-missing" data-missing="">
        <h1 className="font-display text-2xl text-ink">{read.data.missing}</h1>
        <p className="text-sm text-ink-muted">
          The address may be mistyped, or the paper may belong to another course. Papers are opened from a
          student&apos;s record: find them on <Link to="/students" className="pp-link">Students</Link>.
        </p>
      </div>
    );
  }
  return <PaperDocument paper={read.data.paper} />;
}

function PaperDocument({ paper }: { paper: AttemptDetail }) {
  const keyed = showsKey(paper.status);
  const facts = paperFacts(paper, keyed);
  const note = statusNote(paper.status);
  const { student } = paper;
  const word = STATUS_WORD[paper.status as AttemptStatus] ?? paper.status;

  return (
    <div className="pp" data-paper="">
      <header className="pp-head">
        <Link to={`/students/${student.userId}`} className="record-back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {student.fullName}&apos;s record
        </Link>
        <h1 className="font-display text-2xl text-ink">{paper.assessmentTitle}</h1>
        <p className="record-facts" data-paper-facts="">
          <Badge tone={paper.status === "submitted" ? "success" : paper.status === "in_progress" ? "info" : "neutral"}>
            {word}
          </Badge>
          <span className="text-ink">{student.fullName}</span>
          <span aria-hidden="true">·</span>
          <span className="num text-ink">{student.studentId}</span>
          <span aria-hidden="true">·</span>
          <span>
            attempt <span className="num text-ink">{paper.attemptNo}</span>
          </span>
        </p>
        {note ? (
          <p className="pp-note" data-status-note="">
            {note}
          </p>
        ) : null}
        <p className="pp-provenance">
          Regenerated from this student&apos;s stored seed with engine{" "}
          <span className="num">{paper.engineVersion}</span>: the exact numbers, options and order they saw, not a
          fresh draw.
        </p>
      </header>

      <div className="pp-body">
        <aside className="pp-aside" aria-label="About this paper">
          <section className="pp-card" aria-labelledby="pp-facts-h" data-facts="">
            <h2 id="pp-facts-h" className="pp-h2">This attempt</h2>
            <dl className="pp-facts">
              <dt>Score</dt>
              <dd>
                {facts.score ? (
                  <>
                    <span className="num">{facts.score.got}</span> of <span className="num">{facts.score.of}</span>
                  </>
                ) : keyed ? (
                  "Not recorded"
                ) : (
                  "Not handed in"
                )}
              </dd>
              <dt>Answered</dt>
              <dd>
                <span className="num">{facts.answered.got}</span> of <span className="num">{facts.answered.of}</span>
              </dd>
              <dt>Started</dt>
              <dd>{facts.startedAt ? <span className="num">{facts.startedAt}</span> : "Not recorded"}</dd>
              <dt>Handed in</dt>
              <dd>{facts.handedInAt ? <span className="num">{facts.handedInAt}</span> : "Not handed in"}</dd>
              <dt>Time taken</dt>
              <dd>{facts.timeTaken ? <span className="num">{facts.timeTaken}</span> : "Not handed in"}</dd>
              <dt>On questions</dt>
              <dd>
                <span className="num">{facts.onQuestions}</span>
              </dd>
              <dt>Engine</dt>
              <dd>
                <span className="num">{paper.engineVersion}</span>
              </dd>
            </dl>
            <Link to={`/audit?q=${encodeURIComponent(student.studentId)}`} className="pp-link pp-audit">
              This student in the audit log
            </Link>
          </section>

          <section className="pp-card" aria-labelledby="pp-sitting-h">
            <h2 id="pp-sitting-h" className="pp-h2">The sitting</h2>
            <Sitting events={paper.events ?? []} />
          </section>

          <nav className="pp-card" aria-labelledby="pp-index-h" data-index="">
            <h2 id="pp-index-h" className="pp-h2">Questions</h2>
            <ol className="pp-index">
              {paper.items.map((i) => {
                const mark = indexMark(i, keyed);
                return (
                  <li key={i.ordinal}>
                    <a href={`#q-${i.ordinal}`} aria-label={indexLabel(i.ordinal, mark)} data-mark={mark}>
                      <span className="num">{i.ordinal}</span>
                      <span aria-hidden="true" className="pp-glyph">{MARK_GLYPH[mark]}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="pp-legend" aria-hidden="true">
              {keyed ? "✓ correct · – not correct · ○ not answered" : "● answered · ○ not answered"}
            </p>
          </nav>
        </aside>

        <ol className="pp-questions">
          {paper.items.map((item) => (
            <Question key={item.ordinal} item={item} keyed={keyed} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function Question({ item, keyed }: { item: PaperItem; keyed: boolean }) {
  const ordering = item.type === "G";
  const machine = item.type === "P";
  const theirs = ordering ? sequence(item.studentAnswer) : [];
  // A computed answer typed rather than picked is not among the options.
  const offList = !ordering && item.studentAnswer !== null && !item.options.includes(item.studentAnswer);
  const drawn = machine ? paramsLine(item.resolvedParams) : null;

  return (
    <li id={`q-${item.ordinal}`} data-question={item.ordinal} className="pp-q">
      <div className="pp-q-head">
        <h2 className="pp-q-title">
          Question <span className="num">{item.ordinal}</span>
        </h2>
        {keyed ? (
          <span className="pp-verdict" data-verdict="" data-correct={item.isCorrect === true ? "" : undefined}>
            {verdict(item)}
          </span>
        ) : null}
      </div>
      <p className="pp-q-meta">
        <span>{TYPE_WORD[item.type]}</span>
        {item.objectiveId ? <span className="num">{item.objectiveId}</span> : null}
        {item.timeMs !== null ? (
          <span>
            <span className="sr-only">Time on item </span>
            <span className="num" data-time="">{duration(item.timeMs)}</span>
          </span>
        ) : null}
      </p>

      <p className="pp-stem">{item.stem}</p>

      {drawn ? (
        <p className="pp-sub">
          Drawn for this variant: <span className="num pp-params" data-params="">{drawn}</span>
        </p>
      ) : null}

      <p className="pp-sub">{ordering ? "Shown in this order" : "Options, in the order they saw"}</p>
      <ol className="pp-options">
        {item.options.map((o) => {
          const picked = !ordering && o === item.studentAnswer;
          const key = keyed && !ordering && o === item.correctValue;
          return (
            <li key={o} data-option="" data-picked={picked ? "" : undefined}>
              <span className="paper-option-text" data-machine={machine ? "" : undefined}>{o}</span>
              {picked ? <span className="pp-mark" data-answered="">Their answer</span> : null}
              {key ? <span className="pp-mark pp-mark-key" data-key="">Key</span> : null}
            </li>
          );
        })}
      </ol>

      {offList ? (
        <p className="pp-sub" data-answered="">
          Their answer <span className="num text-ink">{item.studentAnswer}</span>
        </p>
      ) : null}

      {ordering && (theirs.length > 0 || keyed) ? (
        <div className="pp-seqs">
          {theirs.length > 0 ? (
            <div data-answered="">
              <p className="pp-sub">Their order</p>
              <ol className="pp-seq" data-their-sequence="">
                {theirs.map((s, n) => <li key={n}>{s}</li>)}
              </ol>
            </div>
          ) : null}
          {keyed ? (
            <div>
              <p className="pp-sub">Keyed order</p>
              <ol className="pp-seq" data-key-sequence="">
                {sequence(item.correctValue).map((s, n) => <li key={n}>{s}</li>)}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {!keyed && item.studentAnswer === null ? <p className="pp-sub">Not answered yet.</p> : null}

      {keyed && item.rationale ? (
        <div className="pp-rationale" data-rationale="">
          <p className="pp-sub">Shown to the student</p>
          <p className="text-sm text-ink">{item.rationale}</p>
        </div>
      ) : null}
    </li>
  );
}

/** The page's shape before the page: a header, the facts, and three questions. Words after 3s, at the top. */
function PaperSkeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading this paper" className="pp min-h-[32rem]">
      {slow ? (
        <p role="status" data-slow="" className="mb-3 text-sm text-ink-muted">
          Still regenerating this paper. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="pp-head">
        <span className="skeleton-bar record-skel-back" />
        <span className="skeleton-bar record-skel-title" />
        <span className="skeleton-bar record-skel-facts" />
      </div>
      <div className="pp-body">
        <div className="pp-aside">
          <div className="pp-card">
            {Array.from({ length: 6 }, (_, r) => (
              <div key={r} className="record-skel-row"><span className="skeleton-bar" /></div>
            ))}
          </div>
        </div>
        <div className="pp-questions">
          {Array.from({ length: 3 }, (_, q) => (
            <div key={q} className="pp-q pp-q-skel">
              <span className="skeleton-bar record-skel-back" />
              <span className="skeleton-bar" />
              <span className="skeleton-bar" />
              <span className="skeleton-bar record-skel-facts" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
