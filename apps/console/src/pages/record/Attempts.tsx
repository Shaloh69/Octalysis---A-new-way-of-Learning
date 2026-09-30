import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type { AttemptDetail, StudentDetail } from "@/lib/api";
import { shortDate } from "@/lib/utils";
import { STATUS_WORD, timeTaken, type AttemptStatus } from "@/lib/record-view";
import { Badge } from "@/components/ui/badge";
import { PaperBody } from "./Paper";

type Attempt = StudentDetail["attempts"][number];

export interface PaperState {
  open: string | null;
  papers: Record<string, AttemptDetail>;
  loading: string | null;
  error: string | null;
  toggle: (attemptId: string) => void;
}

/** Status in a word. `danger` is for destructive staff actions only, so Voided is neutral. */
const TONE: Record<AttemptStatus, "success" | "info" | "neutral"> = {
  submitted: "success",
  in_progress: "info",
  voided: "neutral",
  abandoned: "neutral",
};

function Status({ status }: { status: AttemptStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_WORD[status]}</Badge>;
}

function Score({ a }: { a: Attempt }) {
  return <span className="num">{a.score === null ? "—" : `${a.score}/${a.maxScore ?? "?"}`}</span>;
}

/**
 * The toggle IS the assessment's name (SPEC.md: TanStack's leading toggle, but
 * a labelled one). `aria-controls` names the paper it opens.
 */
function Toggle({ a, p }: { a: Attempt; p: PaperState }) {
  const open = p.open === a.attemptId;
  return (
    <button
      type="button"
      className="record-toggle"
      aria-expanded={open}
      aria-controls={`paper-${a.attemptId}`}
      onClick={() => p.toggle(a.attemptId)}
    >
      <ChevronRight className="record-chevron h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{a.assessmentTitle}</span>
    </button>
  );
}

function Body({ a, p }: { a: Attempt; p: PaperState }) {
  return (
    <PaperBody
      attemptId={a.attemptId}
      status={a.status}
      paper={p.papers[a.attemptId]}
      loading={p.loading === a.attemptId}
      error={p.open === a.attemptId ? p.error : null}
    />
  );
}

const COLS = 7;

/** Times the student left the paper (ruling 3). A number, never a colour: it is a fact, not a verdict. */
function Leaves({ a }: { a: Attempt }) {
  return <span className="num">{a.leaves}</span>;
}

/** Its own width 40rem and up: seven columns, and the open paper spans all seven. */
export function AttemptTable({ attempts, p }: { attempts: Attempt[]; p: PaperState }) {
  return (
    <table className="record-table">
      <colgroup>
        <col />
        <col className="c-no" />
        <col className="c-score" />
        <col className="c-status" />
        <col className="c-when" />
        <col className="c-took" />
        <col className="c-left" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Assessment</th>
          <th scope="col" className="num-col">#</th>
          <th scope="col" className="num-col">Score</th>
          <th scope="col">Status</th>
          <th scope="col">Submitted</th>
          <th scope="col" className="num-col">Time taken</th>
          <th scope="col" className="num-col">Left the paper</th>
        </tr>
      </thead>
      <tbody>
        {attempts.map((a) => (
          <Fragment key={a.attemptId}>
            <tr data-attempt={a.attemptId} data-open={p.open === a.attemptId ? "" : undefined}>
              <td><Toggle a={a} p={p} /></td>
              <td className="num-col"><span className="num">{a.attemptNo}</span></td>
              <td className="num-col"><Score a={a} /></td>
              <td><Status status={a.status} /></td>
              <td className="text-xs text-ink-muted">{shortDate(a.submittedAt)}</td>
              <td className="num-col"><span className="num text-xs">{timeTaken(a.startedAt, a.submittedAt)}</span></td>
              <td className="num-col"><Leaves a={a} /></td>
            </tr>
            {p.open === a.attemptId ? (
              <tr id={`paper-${a.attemptId}`} className="record-paper-row">
                {/* One attempt's detail, not another row of the same shape. */}
                <td colSpan={COLS}>
                  <Body a={a} p={p} />
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/** Below 40rem of its own width: one attempt per item, the paper opening under it. */
export function AttemptList({ attempts, p }: { attempts: Attempt[]; p: PaperState }) {
  return (
    <ul className="record-list">
      {attempts.map((a) => (
        <li key={a.attemptId} data-attempt={a.attemptId} data-open={p.open === a.attemptId ? "" : undefined}>
          <Toggle a={a} p={p} />
          <p className="record-list-meta">
            <Status status={a.status} />
            <span>
              Attempt <span className="num text-ink">{a.attemptNo}</span>
            </span>
            <span>
              Score <Score a={a} />
            </span>
            {a.submittedAt ? <span>{shortDate(a.submittedAt)}</span> : null}
            {a.submittedAt ? (
              <span>
                took <span className="num">{timeTaken(a.startedAt, a.submittedAt)}</span>
              </span>
            ) : null}
            <span>
              left the paper <Leaves a={a} />
            </span>
          </p>
          {p.open === a.attemptId ? (
            <div id={`paper-${a.attemptId}`} className="record-paper-row">
              <Body a={a} p={p} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
