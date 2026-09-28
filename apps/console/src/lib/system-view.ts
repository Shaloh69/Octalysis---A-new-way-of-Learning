import {
  INVARIANT_AREA_LABELS,
  InvariantArea,
  type InvariantResult,
  type InvariantRun,
} from "@octa/contracts";

/**
 * `/system`'s words, kept out of the JSX so they can be tested. See
 * `design/templates/console/system/SPEC.md`.
 */

export type CheckState = "failing" | "warning" | "notice" | "passing";

/** A check with nothing to report is passing, whatever severity it would carry. */
export function stateOf(r: Pick<InvariantResult, "severity" | "offendingCount">): CheckState {
  if (r.offendingCount === 0) return "passing";
  return r.severity === "fail" ? "failing" : r.severity === "warn" ? "warning" : "notice";
}

export const STATE_WORD: Readonly<Record<CheckState, string>> = {
  failing: "Failing",
  warning: "Warning",
  notice: "Notice",
  passing: "Passing",
};

const RANK: Readonly<Record<CheckState, number>> = { failing: 0, warning: 1, notice: 2, passing: 3 };

const idNumber = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Every check that is not passing: failing first, then warnings, then notices; by id within each. */
export function attention(results: InvariantResult[]): InvariantResult[] {
  return results
    .filter((r) => stateOf(r) !== "passing")
    .sort((a, b) => RANK[stateOf(a)] - RANK[stateOf(b)] || idNumber(a.id) - idNumber(b.id));
}

export interface Counts {
  failing: number;
  warning: number;
  notice: number;
  passing: number;
}

export function counts(results: InvariantResult[]): Counts {
  const c: Counts = { failing: 0, warning: 0, notice: 0, passing: 0 };
  for (const r of results) c[stateOf(r)]++;
  return c;
}

/** "1 failing", "2 warnings", "0 notices": every state named, zero included. */
export function countWords(c: Counts): Array<{ n: number; word: string }> {
  return [
    { n: c.failing, word: "failing" },
    { n: c.warning, word: c.warning === 1 ? "warning" : "warnings" },
    { n: c.notice, word: c.notice === 1 ? "notice" : "notices" },
    { n: c.passing, word: "passing" },
  ];
}

export const rows = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "row" : "rows"}`;

/** The areas of `addendum-audit.sql`, in its order, each with its checks by id. */
export function byArea(results: InvariantResult[]): Array<{ area: InvariantArea; label: string; checks: InvariantResult[] }> {
  return InvariantArea.options
    .map((area) => ({
      area,
      label: INVARIANT_AREA_LABELS[area],
      checks: results.filter((r) => r.area === area).sort((a, b) => idNumber(a.id) - idNumber(b.id)),
    }))
    .filter((g) => g.checks.length > 0);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** "16:40:12", local. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** "28 Sep 2026, 16:40:12", local, built by hand: ICU writes "Sept" (NEXT-SESSION.md §0e.5). */
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${clock(iso)}`;
}

/**
 * The columns of a sample, across every row, in the order the rows carry them.
 * That is jsonb's order, not the function's: `run_invariants()` builds the
 * sample with `jsonb_agg`, and jsonb stores an object's keys by length.
 */
export function sampleColumns(sample: Array<Record<string, unknown>>): string[] {
  const cols: string[] = [];
  for (const row of sample) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  return cols;
}

/** A sample value as the database would print it. */
export function cell(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** What ran a nightly record, in words. */
export function trigger(t: string): string {
  if (t === "cron") return "Nightly";
  if (t === "deploy") return "On deploy";
  return "By a staff member";
}

/** "1 failing: INV-15 · 4 warnings: INV-18, INV-25" or "Nothing failing". */
export function runWords(run: Pick<InvariantRun, "failing" | "warning">): string {
  const parts: string[] = [];
  if (run.failing.length) parts.push(`${run.failing.length} failing: ${run.failing.join(", ")}`);
  else parts.push("Nothing failing");
  if (run.warning.length) {
    parts.push(`${run.warning.length} ${run.warning.length === 1 ? "warning" : "warnings"}: ${run.warning.join(", ")}`);
  }
  return parts.join(" · ");
}

/** The one toast after Run again. */
export function rerunToast(ranAt: string, c: Counts): string {
  return `Checked again at ${clock(ranAt)}: ${c.failing} failing, ${c.warning} ${c.warning === 1 ? "warning" : "warnings"}`;
}
