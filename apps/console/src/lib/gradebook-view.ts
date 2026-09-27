import type { GradeComponent } from "@octa/contracts";

/**
 * `/gradebook`'s words. The arithmetic is the server's
 * (`services/api/src/gradebook/compute.ts`); this file only says what its
 * numbers are, and is tested in `test/gradebook-view.spec.ts`.
 */

/** A component in the 380 list, where "Laboratory exercises 10%" wraps its own weight. */
export const SHORT_LABEL: Record<GradeComponent, string> = {
  project: "Project",
  quizzes: "Quizzes",
  exams: "Exams",
  labs: "Labs",
  participation: "Participation",
};

/** A stage check in a cell: "not sat" is never 0 (instructor, 28 Sep 2026). */
export const checkText = (v: number | null): string => (v === null ? "not sat" : String(Math.round(v)));

/** A component or a final, one decimal as the CSV writes it; nothing to count is a dash. */
export const pctText = (v: number | null): string => (v === null ? "–" : (Math.round(v * 10) / 10).toFixed(1));

/** ["01".."07"] -> "01–07"; gaps listed. */
export function stageRange(ids: readonly string[]): string {
  const runs: string[] = [];
  let i = 0;
  while (i < ids.length) {
    let j = i;
    while (j + 1 < ids.length && Number(ids[j + 1]) === Number(ids[j]) + 1) j++;
    runs.push(j === i ? ids[i]! : `${ids[i]}–${ids[j]}`);
    i = j + 1;
  }
  return runs.join(", ");
}

const NOUN: Record<GradeComponent, [string, string]> = {
  quizzes: ["stage check", "stage checks"],
  exams: ["exam", "exams"],
  labs: ["lab", "labs"],
  project: ["project", "projects"],
  participation: ["entry", "entries"],
};

/** What a component is made of so far: "7 stage checks", or "no marks yet". */
export function countedWords(c: { key: GradeComponent; covered: boolean; counted: readonly unknown[] }): string {
  if (!c.covered || c.counted.length === 0) return "no marks yet";
  const [one, many] = NOUN[c.key];
  return `${c.counted.length} ${c.counted.length === 1 ? one : many}`;
}

/** "Quizzes and Laboratory exercises have marks", or "nothing marked yet". */
export function coveredWords(components: ReadonlyArray<{ label: string; covered: boolean }>): string {
  const names = components.filter((c) => c.covered).map((c) => c.label);
  if (names.length === 0) return "nothing marked yet";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? "has" : "have"} marks`;
}

/** The filter: any part of the name, or of the student ID. */
export function matches(s: { fullName: string; studentId: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
}

/** The export's toast: what went into the file. */
export function exportedWords(students: number, coverage: number): string {
  const who = `${students} ${students === 1 ? "student" : "students"}`;
  return coverage === 0 ? `${who}, nothing marked yet` : `${who}, ${coverage}% of the grade covered`;
}
