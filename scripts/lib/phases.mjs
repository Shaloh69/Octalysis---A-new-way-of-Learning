/**
 * The phase counts, read from the files. ONE reader, shared by
 * `scripts/phase-report.mjs` (the session's report) and
 * `scripts/changelog.mjs` (the changelog pages), so the two can never show
 * different numbers for the same commit.
 *
 *   R0-R5  docs/redesign/phases/*.md, checkbox-counted
 *   P0-P10 docs/PHASES.md, the status read verbatim from each heading
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PHASE_DIR = resolve(ROOT, "docs/redesign/phases");

const DONE = /^[ \t]*-[ \t]+\[[xX]\]/;
const TODO = /^[ \t]*-[ \t]+\[[ \t]\]/;

export function redesignPhases() {
  return readdirSync(PHASE_DIR)
    .filter((f) => /^R\d-.*\.md$/.test(f))
    .sort()
    .map((f) => {
      const lines = readFileSync(resolve(PHASE_DIR, f), "utf8").split(/\r?\n/);
      const done = lines.filter((l) => DONE.test(l)).length;
      const todo = lines.filter((l) => TODO.test(l)).length;
      const open = [];
      let heading = "";
      for (const l of lines) {
        if (/^#{2,3} /.test(l)) heading = l.replace(/^#+\s*/, "").trim();
        if (TODO.test(l)) open.push({ heading, text: l.replace(/^[ \t]*-[ \t]*\[[ \t]\][ \t]*/, "").trim() });
      }
      const name = basename(f, ".md");
      return { id: name.slice(0, 2), label: name.slice(3).replace(/-/g, " "), done, todo, open };
    });
}

/** P0-P10 statuses, read verbatim from the headings rather than interpreted. */
export function buildPhases() {
  const src = readFileSync(resolve(ROOT, "docs/PHASES.md"), "utf8");
  return [...src.matchAll(/^##\s+(P\d+)\s+—\s+([^\n·]+?)(?:\s*·\s*(.+))?$/gm)].map((m) => ({
    id: m[1],
    label: m[2].trim(),
    status: (m[3] ?? "").replace(/\*\*/g, "").trim(),
  }));
}
