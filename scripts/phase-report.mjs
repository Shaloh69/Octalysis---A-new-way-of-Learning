#!/usr/bin/env node
/**
 * phase-report.mjs — where every phase stands, counted from the files.
 *
 * The instructor asked for a phase report every session. This exists so that
 * report is COUNTED rather than remembered, because remembering is exactly how
 * this project lost track twice: `PROGRESS.md` read "R2 complete, R3 next" for
 * sessions after R3 had started, and R3's own checklist sat at 0 of 44 while
 * eight of its routes were reworked and committed (`REDESIGN-CLAUDE.md` §2b).
 *
 * Two tracks, and they are NOT the same thing:
 *
 *   R0-R5  the solar-system redesign, in `docs/redesign/phases/*.md`.
 *          Checkbox-counted, so the number cannot drift from the file.
 *   P0-P10 the build plan in `docs/PHASES.md`. Prose status lines, not
 *          checkboxes, so this reads the heading and reports it verbatim
 *          rather than inventing a percentage.
 *
 * A `wip` count is deliberately absent. The phase files have two states, ticked
 * and unticked; inventing a third here would be a number with nothing behind it.
 * Where work is genuinely part-done the phase file says so in prose under the
 * box, which is where it belongs.
 *
 * Usage:
 *   node scripts/phase-report.mjs           the report
 *   node scripts/phase-report.mjs --open    also list every open R-phase box
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_DIR = resolve(ROOT, "docs/redesign/phases");

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const DONE = /^[ \t]*-[ \t]+\[[xX]\]/;
const TODO = /^[ \t]*-[ \t]+\[[ \t]\]/;

function redesignPhases() {
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
function buildPhases() {
  const src = readFileSync(resolve(ROOT, "docs/PHASES.md"), "utf8");
  return [...src.matchAll(/^##\s+(P\d+)\s+—\s+([^\n·]+?)(?:\s*·\s*(.+))?$/gm)].map((m) => ({
    id: m[1],
    label: m[2].trim(),
    status: (m[3] ?? "").replace(/\*\*/g, "").trim(),
  }));
}

const bar = (done, total, width = 22) => {
  if (total === 0) return c.dim("—".repeat(width));
  const filled = Math.round((done / total) * width);
  return c.green("█".repeat(filled)) + c.dim("░".repeat(width - filled));
};

const phases = redesignPhases();
const totalDone = phases.reduce((n, p) => n + p.done, 0);
const totalTodo = phases.reduce((n, p) => n + p.todo, 0);
const total = totalDone + totalTodo;

console.log(c.bold("\nOCTA — phase report") + c.dim(`   ${new Date().toISOString().slice(0, 10)}\n`));

console.log(c.bold("  Redesign track") + c.dim("   docs/redesign/phases/*.md, checkbox-counted\n"));
/*
 * TABLE FORM, ALWAYS.
 *
 * This report gets pasted into sessions and read at a glance. Aligned columns
 * inside a visible frame survive that; a loose list does not, and two runs read
 * one above the other no longer line up.
 *
 * `pad()` measures the string WITHOUT its ANSI colour codes. `padEnd()` on a
 * coloured string counts the escape bytes as width and shears the column by
 * roughly nine characters per colour — which looks like a broken table and is
 * actually a broken measurement.
 */
const VIS = /\x1b\[[0-9;]*m/g;
const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.replace(VIS, "").length));
const W = [6, 24, 13, 13, 32];
const line = (l, m, r) => c.dim(l + W.map((w) => "─".repeat(w + 2)).join(m) + r);
const row = (cells) =>
  c.dim("│") + cells.map((x, i) => ` ${pad(x, W[i])} `).join(c.dim("│")) + c.dim("│");

console.log("  " + line("┌", "┬", "┐"));
console.log(
  "  " + row([c.bold("PHASE"), c.bold("PROGRESS"), c.bold("DONE"), c.bold("STATE"), c.bold("WHAT IT IS")]),
);
console.log("  " + line("├", "┼", "┤"));
for (const p of phases) {
  const tot = p.done + p.todo;
  const state = p.todo === 0 ? c.green("done") : p.done === 0 ? c.dim("not started") : c.yellow("LIVE");
  const share = tot === 0 ? 0 : Math.round((p.done / tot) * 100);
  console.log(
    "  " +
      row([
        c.cyan(p.id),
        bar(p.done, tot, 24),
        `${String(p.done).padStart(3)}/${String(tot).padEnd(3)} ${c.dim(String(share).padStart(3) + "%")}`,
        state,
        c.dim(p.label),
      ]),
  );
}
console.log("  " + line("└", "┴", "┘"));
const pct = total === 0 ? 0 : Math.round((totalDone / total) * 100);
console.log(
  `\n   ${c.bold("TOTAL")}  ${totalDone} done · ${totalTodo} to-do ` +
    c.dim(`(${total} items, ${pct}%)`),
);

const live = phases.filter((p) => p.todo > 0 && p.done > 0);
if (live.length > 0) {
  console.log(
    c.yellow(`\n   Live phase: ${live.map((p) => `${p.id} (${p.done}/${p.done + p.todo})`).join(", ")}`),
  );
}

console.log(c.bold("\n  Build track") + c.dim("   docs/PHASES.md, status read from the headings\n"));
const BW = [6, 34, 48];
const bline = (l, m, r) => c.dim(l + BW.map((w) => "─".repeat(w + 2)).join(m) + r);
const brow = (cells) =>
  c.dim("│") + cells.map((x, i) => ` ${pad(x, BW[i])} `).join(c.dim("│")) + c.dim("│");

console.log("  " + bline("┌", "┬", "┐"));
console.log("  " + brow([c.bold("PHASE"), c.bold("WHAT IT IS"), c.bold("STATUS")]));
console.log("  " + bline("├", "┼", "┤"));
for (const p of buildPhases()) {
  const st = p.status || "(no status)";
  const tone = /DONE/i.test(st) ? c.green(st) : /NOT BUILT/i.test(st) ? c.dim(st) : c.yellow(st);
  console.log("  " + brow([c.cyan(p.id), p.label, tone]));
}
console.log("  " + bline("└", "┴", "┘"));

if (process.argv.includes("--open")) {
  console.log(c.bold("\n  Open boxes\n"));
  for (const p of phases) {
    if (p.open.length === 0) continue;
    console.log(`   ${c.cyan(p.id)}`);
    for (const o of p.open) {
      console.log(c.dim(`     [${o.heading.slice(0, 38)}]`));
      console.log(`       ${o.text.slice(0, 96)}`);
    }
  }
}

console.log(
  c.dim(
    "\n  The redesign track is checkbox-counted and cannot drift from the files.\n" +
      "  The build track is prose; read PHASES.md before trusting a status line.\n",
  ),
);
