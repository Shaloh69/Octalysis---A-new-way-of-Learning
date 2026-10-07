import data from "@/generated/changelog.json";

/**
 * The console's /changelog data, written at build time by
 * `scripts/changelog.mjs` (git log, the written highlights, the phase files,
 * the roadmap). `design/templates/console/changelog/SPEC.md`.
 */

export interface Commit { hash: string; type: string; scope: string | null; subject: string }
export interface Update { date: string; title: string; highlights: string[]; commits: Commit[] }
export interface RedesignPhase { id: string; label: string; done: number; todo: number }
export interface BuildPhase { id: string; label: string; status: string }
export interface NextStep { id: string; title: string; what: string; plan: string; state: string }
export interface Changelog {
  madeAt: { commit: string; date: string };
  updates: Update[];
  phases: { redesign: RedesignPhase[]; build: BuildPhase[]; done: number; total: number; pct: number };
  roadmap: { next: NextStep[]; owed: string[] };
}

export const CHANGELOG = data as Changelog;

/** A commit's kind, in a word a teacher reads (SPEC: never the bare prefix). */
export const KIND: Record<string, string> = { feat: "New", fix: "Fix", perf: "Faster", content: "Content" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));

/** `2026-10-07` -> `7 Oct 2026`; read as a calendar date, never through a time zone. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${SHORT[(m ?? 1) - 1]} ${y}`;
}

/** `2026-10-07` -> `7 October 2026`. */
export function longDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Updates grouped by month, newest first (the input is newest first already). */
export function byMonth(updates: readonly Update[]): Array<{ key: string; label: string; updates: Update[] }> {
  const out: Array<{ key: string; label: string; updates: Update[] }> = [];
  for (const u of updates) {
    const key = monthKey(u.date);
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = { key, label: monthLabel(key), updates: [] };
      out.push(g);
    }
    g.updates.push(u);
  }
  return out;
}

export function phaseState(p: RedesignPhase): "done" | "live" | "not started" {
  return p.todo === 0 ? "done" : p.done === 0 ? "not started" : "live";
}
