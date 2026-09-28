/**
 * One CSV cell, safe to open in a spreadsheet.
 *
 * A cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, or a
 * leading tab or return) is prefixed with `'`. What goes in these files is
 * typed by people (an audit reason, a student's report), and the file is
 * opened in Excel by someone else: an export must never be the thing that
 * executes. Shared by `/audit`'s and `/feedback`'s exports.
 */
export function csvCell(v: string | null | undefined): string {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(cells: Array<string | null | undefined>): string {
  return cells.map(csvCell).join(",");
}
