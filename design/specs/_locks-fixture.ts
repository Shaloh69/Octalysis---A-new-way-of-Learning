/**
 * The /locks fixture: the REAL local matrix, patched so it carries all three
 * override shapes, a course-wide override and a scheduled section override.
 *
 * Shared by `console-locks.spec.ts` and the `current.png` capture, so the
 * picture and the proof show the same data. Not a spec: the leading underscore
 * keeps Playwright from collecting it. Seeded fixture names only.
 */

export const WHO = "Demo Teacher";

export interface Cell {
  userId: string; stageId: string; unlocked: boolean; mastery: number;
  override: "locked" | "unlocked" | null; reason: string | null;
  setBy: string | null; setAt: string | null;
}
export interface Matrix {
  stages: Array<{ id: string; title: string }>;
  students: Array<{ userId: string; studentId: string; fullName: string; sectionId: string | null }>;
  cells: Cell[];
  sections: Array<{ id: string; code: string; term: string }>;
  scopeLocks: Array<Record<string, unknown>>;
}

/** The three override shapes, on the first three students. */
export const FIX = {
  opened: { student: 0, stage: "03", reason: "Makeup for the missed lab on 12 September" },
  closed: { student: 1, stage: "02", reason: "Closed until the lab safety briefing is done" },
  /** Opened by a person, CLOSED by the database: the window has not started. */
  disagree: { student: 2, stage: "05", reason: "Opens with the review window" },
  global: { stage: "04", reason: "Prelim week: practice is closed for everyone" },
  section: { stage: "06", reason: "Lab week for the section" },
};

export function patch(m: Matrix): Matrix {
  const at = "2026-09-24T01:30:00.000Z";
  const set = (i: number, stage: string, c: Partial<Cell>) => {
    const u = m.students[i]!.userId;
    const cell = m.cells.find((x) => x.userId === u && x.stageId === stage)!;
    Object.assign(cell, { setBy: WHO, setAt: at }, c);
  };
  set(FIX.opened.student, FIX.opened.stage, { override: "unlocked", unlocked: true, reason: FIX.opened.reason });
  set(FIX.closed.student, FIX.closed.stage, { override: "locked", unlocked: false, reason: FIX.closed.reason });
  set(FIX.disagree.student, FIX.disagree.stage, { override: "unlocked", unlocked: false, reason: FIX.disagree.reason });
  // A course-wide close: every student's cell is closed, as the database would say.
  for (const c of m.cells) if (c.stageId === FIX.global.stage) c.unlocked = false;
  const sec = m.sections[0];
  m.scopeLocks = [
    {
      id: "fixture-global", scope: "global", sectionId: null, sectionCode: null,
      stageId: FIX.global.stage, state: "locked", reason: FIX.global.reason,
      unlockAt: null, lockAt: null, setBy: WHO, setAt: at,
    },
    ...(sec
      ? [{
          id: "fixture-section", scope: "section", sectionId: sec.id, sectionCode: sec.code,
          stageId: FIX.section.stage, state: "unlocked", reason: FIX.section.reason,
          unlockAt: "2026-10-01T00:00:00.000Z", lockAt: "2026-10-08T00:00:00.000Z",
          setBy: WHO, setAt: at,
        }]
      : []),
  ];
  return m;
}

