import { Link } from "react-router-dom";
import type { AttemptDetail } from "@/lib/api";
import { useDelayed } from "@/lib/useDelayed";
import {
  duration, paperSummary, sequence, showsKey, TYPE_WORD, verdict, type PaperItem,
} from "@/lib/record-view";

/**
 * One attempt's paper, regenerated from the student's stored seed, opened in
 * place under its row.
 *
 * IT CAN SHOW THE ANSWER KEY. Allowed here, and only because: the reader is
 * staff (`requireStaff()` on both endpoints, a student gets 403, tested in
 * `services/api/test/console.spec.ts`); this is the console's bundle, never
 * the student's (`scripts/scan-bundle.mjs`, two profiles); and the page shows
 * it only for a paper that was handed in (`showsKey`, instructor 27 Sep 2026).
 * This file must never be imported by `apps/web`.
 */
export function PaperBody({
  attemptId, status, paper, loading, error,
}: {
  attemptId: string;
  status: string;
  paper: AttemptDetail | undefined;
  loading: boolean;
  error: string | null;
}) {
  const slow = useDelayed(loading, 400);
  if (error) {
    return (
      <p role="alert" className="record-paper-note">
        {error}
      </p>
    );
  }
  if (!paper) {
    return (
      <p className="record-paper-note" aria-busy="true">
        {slow ? "Regenerating this paper from the stored seed…" : " "}
      </p>
    );
  }

  const keyed = showsKey(status);
  return (
    <div className="record-paper">
      <div className="record-paper-head">
        <p className="text-sm text-ink">
          {paperSummary(paper, keyed)}
          <span className="text-ink-muted"> · engine <span className="num">{paper.engineVersion}</span></span>
        </p>
        <Link to={`/attempts/${attemptId}`} className="record-link">
          Open paper on its own page
        </Link>
      </div>
      {status === "voided" ? (
        <p className="record-paper-note">Voided. Kept for the record; it no longer counts toward a grade.</p>
      ) : status === "in_progress" ? (
        <p className="record-paper-note">
          In progress. Their answers so far are below. The key appears here once the attempt is submitted.
        </p>
      ) : status === "abandoned" ? (
        <p className="record-paper-note">
          Abandoned before it was handed in. The key appears here once an attempt is submitted, and this
          one never was.
        </p>
      ) : null}
      <ol className="record-items">
        {paper.items.map((item) => (
          <Question key={item.ordinal} item={item} keyed={keyed} />
        ))}
      </ol>
    </div>
  );
}

function Question({ item, keyed }: { item: PaperItem; keyed: boolean }) {
  const ordering = item.type === "G";
  const theirs = ordering ? sequence(item.studentAnswer) : [];
  // A computed answer typed rather than picked is not among the options.
  const offList = !ordering && item.studentAnswer !== null && !item.options.includes(item.studentAnswer);

  return (
    <li data-item={item.ordinal} className="record-item">
      <div className="record-item-meta">
        <span className="num text-ink">{item.ordinal}</span>
        <span>{TYPE_WORD[item.type]}</span>
        {item.objectiveId ? <span className="num">{item.objectiveId}</span> : null}
        {item.timeMs !== null ? (
          <span>
            <span className="sr-only">Time on item </span>
            <span className="num" data-time="">{duration(item.timeMs)}</span>
          </span>
        ) : null}
        {keyed ? (
          <span className="record-verdict" data-verdict="" data-correct={item.isCorrect === true ? "" : undefined}>
            {verdict(item)}
          </span>
        ) : null}
      </div>
      <p className="record-stem">{item.stem}</p>

      <p className="record-sub">{ordering ? "Shown in this order" : "Options, in the order they saw"}</p>
      <ol className="record-options" type="A">
        {item.options.map((o) => {
          const picked = !ordering && o === item.studentAnswer;
          const key = keyed && !ordering && o === item.correctValue;
          return (
            <li key={o} data-option={o} data-picked={picked ? "" : undefined}>
              {/* A computed item's options are values the machine produced: mono. */}
              <span className="record-option-text" data-machine={item.type === "P" ? "" : undefined}>{o}</span>
              {picked ? <span className="record-mark" data-answered="">Their answer</span> : null}
              {key ? <span className="record-mark record-mark-key" data-key="">Key</span> : null}
            </li>
          );
        })}
      </ol>

      {offList ? (
        <p className="record-sub" data-answered="">
          Their answer <span className="num text-ink">{item.studentAnswer}</span>
        </p>
      ) : null}

      {ordering && (theirs.length > 0 || keyed) ? (
        <div className="record-sequences">
          {theirs.length > 0 ? (
            <div data-answered="">
              <p className="record-sub">Their order</p>
              <ol className="record-seq">{theirs.map((s, n) => <li key={n}>{s}</li>)}</ol>
            </div>
          ) : null}
          {keyed ? (
            <div>
              <p className="record-sub">Keyed order</p>
              <ol className="record-seq" data-key-sequence="">
                {sequence(item.correctValue).map((s, n) => <li key={n}>{s}</li>)}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {!keyed && item.studentAnswer === null ? <p className="record-sub">Not answered yet.</p> : null}

      {keyed && item.rationale ? (
        <div className="record-rationale" data-rationale="">
          <p className="record-sub">Shown to the student</p>
          <p className="text-sm text-ink">{item.rationale}</p>
        </div>
      ) : null}
    </li>
  );
}
