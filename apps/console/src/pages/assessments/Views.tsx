import type { Assessment } from "@/lib/api";
import { windowState } from "@/lib/assessments-view";
import { BankCell } from "./Bank";
import { Actions, Salt, Scope, StatusBadge, Window, type RowActions } from "./Row";

/**
 * At 64rem of the page's own width and up: ten columns in `table-layout:
 * fixed`, exactly as wide as the card. It never scrolls sideways. The old
 * page's header ran Window · (Set window) · Submitted while its cells ran
 * Window · Submitted · Set window, so one list drives both here.
 */
const COLUMNS: Array<[key: string, label: string, numeric?: boolean]> = [
  ["status", "Status"],
  ["assessment", "Assessment"],
  ["scope", "Scope"],
  ["items", "Items", true],
  ["bank", "Bank"],
  ["attempts", "Attempts", true],
  ["section", "Section"],
  ["window", "Window"],
  ["submitted", "Submitted", true],
];

export function AssessTable({ rows, on }: { rows: Assessment[]; on: RowActions }) {
  return (
    <table className="assess-table">
      <colgroup>
        {COLUMNS.map(([key]) => (
          <col key={key} className={`c-${key}`} />
        ))}
        <col className="c-actions" />
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map(([key, label, numeric]) => (
            <th key={key} scope="col" className={numeric ? "num-col" : undefined}>
              {label}
            </th>
          ))}
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} data-assessment={a.id} data-state={windowState(a)}>
            <td>
              <StatusBadge a={a} />
            </td>
            <td>
              <span className="assess-title">{a.title}</span>
              <span className="assess-sub">
                {a.blueprintName !== a.title ? <>{a.blueprintName} · </> : null}
                <Salt a={a} />
              </span>
            </td>
            <td>
              <Scope a={a} />
            </td>
            <td className="num num-col">{a.totalItems}</td>
            <td>
              <BankCell bank={a.bank} />
            </td>
            <td className="num num-col">{a.attemptsAllowed}</td>
            <td className={a.sectionCode ? "text-ink" : "text-ink-muted"}>{a.sectionCode ?? "every section"}</td>
            <td>
              <Window a={a} />
            </td>
            <td className="num-col">
              <span className="num">
                {a.submitted}/{a.attempts}
              </span>
              <span className="sr-only"> handed in of started</span>
            </td>
            <td className="c-actions-cell">
              <Actions a={a} on={on} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Below 64rem: one assessment per item, every fact as a line. */
export function AssessList({ rows, on }: { rows: Assessment[]; on: RowActions }) {
  return (
    <ul className="assess-list">
      {rows.map((a) => (
        <li key={a.id} data-assessment={a.id} data-state={windowState(a)}>
          <div className="assess-list-head">
            <span className="assess-title">{a.title}</span>
            <StatusBadge a={a} />
          </div>
          <p className="assess-list-meta">
            <Scope a={a} />
            <span>
              <span className="num">{a.totalItems}</span> questions
            </span>
            <span>
              <span className="num">{a.attemptsAllowed}</span> attempts
            </span>
            <span>{a.sectionCode ?? "every section"}</span>
          </p>
          <p className="assess-list-meta">
            <Window a={a} />
          </p>
          <p className="assess-list-meta">
            <BankCell bank={a.bank} />
            <span>
              <span className="num">{a.submitted}</span> of <span className="num">{a.attempts}</span> handed in
            </span>
          </p>
          <p className="assess-list-meta">
            <Salt a={a} />
          </p>
          <Actions a={a} on={on} />
        </li>
      ))}
    </ul>
  );
}
