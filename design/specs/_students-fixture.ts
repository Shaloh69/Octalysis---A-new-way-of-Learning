/**
 * The /students fixture: the REAL local roster, patched with the two states the
 * seed does not have. Same pattern as `_locks-fixture.ts`: the layout is tested
 * on real rows, and only what the seed lacks is added.
 *
 *   - one registered student DEACTIVATED (the seed has none)
 *   - a SECOND section to move students into (the seed has one)
 *
 * The seed already has three unregistered rows (232129022-024). Seeded fixture
 * names only; nothing here names a real person. Not a spec: the leading
 * underscore keeps Playwright from collecting it.
 */

export interface RosterRow {
  studentId: string; fullName: string; status: "unclaimed" | "claimed" | "disabled";
  claimedAt: string | null; sectionId: string | null; sectionCode: string | null;
  userId: string | null; deactivated: boolean; attempts: number; avgMastery: number | null;
}
export interface Roster {
  students: RosterRow[];
  sections: Array<{ id: string; code: string; term: string }>;
}

export const FIX = {
  /** Registered, and deactivated by the fixture. */
  deactivated: "232129020",
  /** Registered and active: the one the deactivate test uses. */
  active: "232129005",
  /** Not registered: deactivating it disables the ID. */
  unregistered: "232129023",
  /** The section the fixture adds. A valid uuid; every write to it is intercepted. */
  section: { id: "5ec7f1a0-0000-4000-8000-0000000004b0", code: "BSCPE - 4B", term: "2026-2027 First Semester" },
};

export function patch(r: Roster): Roster {
  const off = r.students.find((s) => s.studentId === FIX.deactivated);
  if (off) off.deactivated = true;
  if (!r.sections.some((s) => s.id === FIX.section.id)) r.sections = [...r.sections, FIX.section];
  return r;
}

/**
 * A paste that produces every outcome the preview has, against the seed, for
 * the dialog's default section (the seed's own):
 *   new, with a comma in the name   232129099
 *   will change (unregistered)      232129022
 *   not imported: registered        232129001, a different name
 *   unchanged                       232129002
 *   not imported: duplicate x2      232129023
 */
export const PASTE = [
  "232129099,Dela Cruz, Juan Miguel",
  "232129022,Osmeña, Andrea Nicole",
  "232129001,Dela Cruz, Juan",
  "232129002,Maria Angelica Bacaltos",
  "232129023,Canete, Mark Joseph",
  "232129023,Canete, Mark J.",
].join("\n");
