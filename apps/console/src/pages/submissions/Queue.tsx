import { Clock } from "lucide-react";
import type { Submission } from "@/lib/api";
import { dayDate } from "@/lib/record-view";
import { STATUS_TONE, STATUS_WORD, lateWords, markText } from "@/lib/submissions-view";
import { Badge } from "@/components/ui/badge";

/**
 * The queue. At 62rem of the page's own width and up, five columns in
 * `table-layout: fixed`, never wider than the card; below it, a list. Both
 * carry the same facts, and **Late is on every row** (`TEMPLATE-LINKS.md`,
 * `DESIGN-REVIEW-01` D-4), in words, not only on the late ones.
 *
 * The student's name is the row's button. At 1440 the whole row also takes a
 * click, as a convenience for the mouse; the button is the keyboard's way in.
 */

export interface QueueProps {
  rows: Submission[];
  openId: string | null;
  onOpen: (s: Submission, from: HTMLElement | null) => void;
}

export function Late({ s }: { s: Submission }) {
  const late = s.isLate && s.status !== "draft";
  return (
    <span className="subs-late" data-late="" data-is-late={late ? "" : undefined}>
      {late ? <Clock className="h-3 w-3" aria-hidden="true" /> : null}
      {lateWords(s)}
    </span>
  );
}

function Mark({ s }: { s: Submission }) {
  const mark = s.status === "graded" ? markText(s) : null;
  return mark ? (
    <span className="num">{mark}</span>
  ) : (
    <Badge tone={STATUS_TONE[s.status]} className="whitespace-nowrap" data-state-word="">
      {STATUS_WORD[s.status]}
    </Badge>
  );
}

function Handed({ s }: { s: Submission }) {
  const day = dayDate(s.submittedAt);
  return day ? (
    <span className="num" data-date="">
      {day}
    </span>
  ) : (
    <span className="subs-cell-xs">not yet</span>
  );
}

export function QueueTable({ rows, openId, onOpen }: QueueProps) {
  return (
    <table className="subs-table">
      <colgroup>
        <col className="c-student" />
        <col className="c-deliverable" />
        <col className="c-handed" />
        <col className="c-late" />
        <col className="c-mark" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Student</th>
          <th scope="col">Deliverable</th>
          <th scope="col">Handed in</th>
          <th scope="col">Late</th>
          <th scope="col">Mark</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr
            key={s.id}
            data-submission={s.id}
            data-status={s.status}
            aria-current={s.id === openId ? "true" : undefined}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              onOpen(s, e.currentTarget.querySelector<HTMLElement>("[data-open]"));
            }}
          >
            <td>
              <button type="button" className="subs-name" data-open="" onClick={(e) => onOpen(s, e.currentTarget)}>
                <span className="subs-student" data-student-name="">
                  {s.studentName}
                </span>
              </button>
              <span className="num subs-id">{s.studentId}</span>
            </td>
            <td>
              <span className="num subs-cell-xs" data-slug="">
                {s.slug}
              </span>
            </td>
            <td className="subs-cell-xs">
              <Handed s={s} />
            </td>
            <td>
              <Late s={s} />
            </td>
            <td>
              <Mark s={s} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QueueList({ rows, openId, onOpen }: QueueProps) {
  return (
    <ul className="subs-list">
      {rows.map((s) => (
        <li key={s.id} data-submission={s.id} data-status={s.status}>
          <button
            type="button"
            className="subs-item"
            data-open=""
            aria-current={s.id === openId ? "true" : undefined}
            onClick={(e) => onOpen(s, e.currentTarget)}
          >
            <span className="subs-item-head">
              <span className="subs-student" data-student-name="">
                {s.studentName}
              </span>
              <Mark s={s} />
            </span>
            <span className="subs-meta">
              <span className="num" data-slug="">
                {s.slug}
              </span>
              <span className="num">{s.studentId}</span>
              <Handed s={s} />
              <Late s={s} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The queue's shape before the queue: same row height, same columns. */
export function QueueSkeleton({ wide, slow }: { wide: boolean; slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading the submissions" className="subs-card min-h-[32rem]">
      {slow ? (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="py-2">
        {Array.from({ length: 10 }, (_, r) => (
          <div key={r} className={wide ? "subs-skel-row" : "subs-skel-row subs-skel-narrow"}>
            {wide
              ? Array.from({ length: 5 }, (_, col) => <span key={col} className="skeleton-bar" />)
              : <span className="skeleton-bar" />}
          </div>
        ))}
      </div>
    </div>
  );
}
