import type { TeacherClass, TeacherRow, TeacherStatus } from "@octa/contracts";
import type { TeacherImportPlanRow } from "./api";

/**
 * `/teachers`' words and its roster parser (T1, 7 Oct 2026). Pure, so they
 * are tested (`test/teachers-view.spec.ts`) rather than trusted.
 */

export const STATUS_WORDS: Record<TeacherStatus, string> = {
  active: "Active",
  unclaimed: "Not yet claimed",
  disabled: "Disabled",
};

export const STATUS_TONE = { active: "success", unclaimed: "neutral", disabled: "locked" } as const;

export const ROLE_WORDS = { teacher: "Teacher", admin: "Admin" } as const;

export function teacherCounts(rows: readonly TeacherRow[]): Record<TeacherStatus | "all", number> {
  const c = { all: rows.length, active: 0, unclaimed: 0, disabled: 0 };
  for (const r of rows) c[r.status] += 1;
  return c;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function teacherMatches(r: TeacherRow, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [r.fullName, r.employeeId ?? "", r.email ?? ""].some((f) => fold(f).includes(q));
}

/** Holds a live class of that subject. */
export function teachesSubject(r: TeacherRow, subject: string): boolean {
  return subject === "all" || r.classes.some((c) => c.endedAt === null && c.subjectCode === subject);
}

/** "BSCPE-2A · CPE 412", the term kept for the detail page. */
export const classLabel = (c: Pick<TeacherClass, "sectionCode" | "subjectCode">) => `${c.sectionCode} · ${c.subjectCode}`;

/** What a confirmation must match: the employee ID, or the name for a staff account with none. */
export const confirmWord = (r: Pick<TeacherRow, "employeeId" | "fullName">) => r.employeeId ?? r.fullName;

/** Never offered for an admin (the API refuses it too), nor for yourself. */
export function canDisable(r: TeacherRow, me: string | null): boolean {
  return r.role !== "admin" && (r.userId === null || r.userId !== me);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------ the roster */

export interface TeacherLine {
  employeeId: string;
  fullName: string;
  email?: string;
  role: "teacher" | "admin";
}

const EMPLOYEE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/;
const ROLE = /^(teacher|admin)$/i;

/**
 * One teacher per line: the employee ID first, then the name, then optionally
 * an email and a role, separated by commas or tabs. A name may itself contain
 * commas ("Santos, Maria"): the email is recognised by its "@" and the role by
 * its word, wherever they sit, and every other field is the name. A line whose
 * first field is not an employee ID, or that has no name, is counted as bad.
 */
export function parseTeacherRoster(text: string): { rows: TeacherLine[]; bad: number } {
  const rows: TeacherLine[] = [];
  let bad = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const fields = line.split(/[,\t]/).map((f) => f.trim()).filter(Boolean);
    const id = fields.shift() ?? "";
    let email: string | undefined;
    let role: "teacher" | "admin" = "teacher";
    const name: string[] = [];
    for (const f of fields) {
      if (f.includes("@")) email = f;
      else if (ROLE.test(f)) role = f.toLowerCase() as "teacher" | "admin";
      else name.push(f);
    }
    if (!EMPLOYEE_ID.test(id) || name.length === 0) {
      bad += 1;
      continue;
    }
    rows.push({ employeeId: id, fullName: name.join(", "), ...(email ? { email } : {}), role });
  }
  return { rows, bad };
}

export function needsLook(p: TeacherImportPlanRow): boolean {
  return p.action === "update" || p.action === "conflict";
}

export function planOutcome(p: TeacherImportPlanRow): { label: string; detail: string | null } {
  switch (p.action) {
    case "insert":
      return { label: "New", detail: null };
    case "unchanged":
      return { label: "Unchanged", detail: null };
    case "update": {
      const c = p.current;
      const parts: string[] = [];
      if (c && c.fullName !== p.fullName) parts.push(`Name: ${c.fullName} → ${p.fullName}`);
      if (c && (c.email ?? null) !== p.email) parts.push(`Email: ${c.email ?? "none"} → ${p.email ?? "none"}`);
      if (c && c.role !== p.role) parts.push(`Role: ${c.role} → ${p.role}`);
      return { label: "Will change", detail: parts.join(" · ") || null };
    }
    case "conflict":
      return {
        label: "Not imported",
        detail:
          p.why === "claimed"
            ? `Already claimed by ${p.current?.fullName ?? "someone"}. A claimed row is never overwritten.`
            : "This employee ID appears twice in what you pasted. Neither line is imported; keep the right one.",
      };
  }
}

export function importToast(s: { insert: number; update: number }): string {
  if (s.insert > 0 && s.update > 0) return `${s.insert} added and ${s.update} updated on the teacher roster`;
  if (s.insert > 0) return `${plural(s.insert, "teacher")} added to the roster`;
  return `${plural(s.update, "teacher")} updated on the roster`;
}
