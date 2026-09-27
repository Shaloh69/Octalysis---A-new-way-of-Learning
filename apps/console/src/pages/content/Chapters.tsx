import { Link } from "react-router-dom";
import type { ContentStage } from "@/lib/api";
import {
  ACT_NAMES, AUTHORING_TONE, AUTHORING_WORD, SUMMARY_TONE, SUMMARY_WORD, archetypeName, levelsText,
} from "@/lib/content-view";
import { Badge } from "@/components/ui/badge";

/**
 * Every chapter and where it stands. The facts a teacher opens this for
 * (status, summary, blocks, live items) are `data-fact`s, and every one is on
 * screen at 380: the old table cut all four off there (`before-380.png`).
 */

function Status({ s }: { s: ContentStage }) {
  return <Badge tone={AUTHORING_TONE[s.authoring]} data-fact="status">{AUTHORING_WORD[s.authoring]}</Badge>;
}

function SummaryState({ s }: { s: ContentStage }) {
  const k = s.summaryStatus ?? "none";
  return <Badge tone={SUMMARY_TONE[k]} data-fact="summary">{SUMMARY_WORD[k]}</Badge>;
}

function Blocks({ s }: { s: ContentStage }) {
  return (
    <span data-fact="blocks">
      <span className="num">{s.blocks}</span>
      {s.consoleEdited > 0 ? (
        <span className="ct-faint"> · <span className="num">{s.consoleEdited}</span> edited, not in git</span>
      ) : null}
    </span>
  );
}

function Live({ s }: { s: ContentStage }) {
  return (
    <span data-fact="live">
      <span className={s.liveItems === 0 ? "num ct-faint" : "num"}>{s.liveItems}</span>
      {s.draftItems > 0 ? (
        <span className="ct-faint"> · <span className="num">{s.draftItems}</span> in review</span>
      ) : null}
    </span>
  );
}

function Title({ s }: { s: ContentStage }) {
  return (
    <>
      <Link className="ct-link ct-chapter-link" to={`/content/${s.id}`}>{s.title}</Link>
      {!s.gradeable ? <span className="ct-faint"> · not graded</span> : null}
    </>
  );
}

export function ChapterTable({ stages }: { stages: readonly ContentStage[] }) {
  return (
    <table className="ct-table">
      <caption className="sr-only">Authoring status for every stage</caption>
      <colgroup>
        <col className="c-id" />
        <col />
        <col className="c-period" />
        <col className="c-type" />
        <col className="c-state" />
        <col className="c-state" />
        <col className="c-num" />
        <col className="c-blocks" />
        <col className="c-live" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Chapter</th>
          <th scope="col">Period</th>
          <th scope="col">Type</th>
          <th scope="col">Status</th>
          <th scope="col">Summary</th>
          <th scope="col">Objectives</th>
          <th scope="col">Blocks</th>
          <th scope="col">Live items</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((s) => (
          <tr key={s.id} data-chapter={s.id}>
            <td><span className="num" data-fact="id">{s.id}</span></td>
            <th scope="row" className="ct-row-title"><Title s={s} /></th>
            <td className="ct-muted">{ACT_NAMES[s.act] ?? s.act}</td>
            <td>
              <span className="num" title={archetypeName(s.archetype)}>{s.archetype}</span>{" "}
              <span className="num ct-faint">{levelsText(s.levels)}</span>
            </td>
            <td><Status s={s} /></td>
            <td><SummaryState s={s} /></td>
            <td><span className="num">{s.objectives}</span></td>
            <td><Blocks s={s} /></td>
            <td><Live s={s} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChapterList({ stages }: { stages: readonly ContentStage[] }) {
  return (
    <ul className="ct-list" aria-label="Authoring status for every stage">
      {stages.map((s) => (
        <li key={s.id} className="ct-item" data-chapter={s.id}>
          <div className="ct-item-head">
            <span className="num ct-item-id" data-fact="id">{s.id}</span>
            <div className="min-w-0">
              <p className="ct-item-title"><Title s={s} /></p>
              <p className="ct-faint">
                {ACT_NAMES[s.act] ?? s.act} · <span className="num">{s.archetype}</span> {archetypeName(s.archetype)}
              </p>
            </div>
          </div>
          <div className="ct-item-badges">
            <Status s={s} />
            <SummaryState s={s} />
          </div>
          <dl className="ct-facts">
            <div className="ct-fact"><dt>Objectives</dt><dd><span className="num">{s.objectives}</span></dd></div>
            <div className="ct-fact"><dt>Blocks</dt><dd><Blocks s={s} /></dd></div>
            <div className="ct-fact"><dt>Live items</dt><dd><Live s={s} /></dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
