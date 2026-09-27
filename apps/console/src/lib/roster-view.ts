import type { RosterImportPlan, RosterPlanRow, RosterRow } from "./api";

/**
 * `/students`' words. Pure, so they are tested (`test/console.spec.ts`) rather
 * than trusted: every one of these is a sentence a teacher acts on.
 */

export type RosterState = "registered" | "not-registered" | "deactivated";

/** Deactivated wins: a deactivated student is not "registered" in any sense they can use. */
export function rosterState(r: RosterRow): RosterState {
  if (r.deactivated) return "deactivated";
  return r.status === "claimed" ? "registered" : "not-registered";
}

export const STATE_WORDS: Record<RosterState, string> = {
  registered: "Registered",
  "not-registered": "Not registered",
  deactivated: "Deactivated",
};

export function rosterCounts(rows: readonly RosterRow[]): Record<RosterState | "all", number> {
  const c = { all: rows.length, registered: 0, "not-registered": 0, deactivated: 0 };
  for (const r of rows) c[rosterState(r)] += 1;
  return c;
}

/** "Osmeña" is found by "osmena": a teacher types what the keyboard has. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function rosterMatches(r: RosterRow, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [r.fullName, r.studentId, r.sectionCode ?? ""].some((f) => fold(f).includes(q));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------ the import */

export function needsLook(p: RosterPlanRow): boolean {
  return p.action === "update" || p.action === "conflict";
}

/** One row of the preview, in words: never a colour alone. */
export function planOutcome(p: RosterPlanRow): { label: string; detail: string | null } {
  switch (p.action) {
    case "insert":
      return { label: "New", detail: null };
    case "unchanged":
      return { label: "Unchanged", detail: null };
    case "update": {
      const c = p.current;
      const parts: string[] = [];
      if (c && c.fullName !== p.fullName) parts.push(`Name: ${c.fullName} → ${p.fullName}`);
      if (c && c.sectionCode !== p.sectionCode) parts.push(`Section: ${c.sectionCode ?? "none"} → ${p.sectionCode}`);
      return { label: "Will change", detail: parts.join(" · ") || null };
    }
    case "conflict":
      return {
        label: "Not imported",
        detail:
          p.why === "registered"
            ? `Already registered as ${p.current?.fullName ?? "someone"}, in ${p.current?.sectionCode ?? "no section"}. A registered row is never overwritten; use Move to section to change their section.`
            : p.why === "duplicate"
              ? "This ID appears twice in what you pasted. Neither line is imported; keep the right one."
              : `No section called ${p.sectionCode}. Pick it above, or fix the code.`,
      };
  }
}

export function importToast(s: RosterImportPlan["summary"], section: string): string {
  if (s.insert > 0 && s.update > 0) return `${s.insert} added and ${s.update} updated in ${section}`;
  if (s.insert > 0) return `${plural(s.insert, "student")} added to ${section}`;
  return `${plural(s.update, "student")} updated in ${section}`;
}
