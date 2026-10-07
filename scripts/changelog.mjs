#!/usr/bin/env node
/**
 * changelog.mjs — the changelog pages' data, from the repository itself.
 *
 * Instructor, 7 Oct 2026 (night): a changelog on both apps "to show the
 * updates we made", and "all the progress of the entire system". Answered the
 * same night: BOTH written highlights and the full commit list; students see
 * their own changes only, with one line of progress; the console shows the
 * build phases, course readiness (live, from the API) and the planned work.
 *
 * Reads:
 *   git log                          every feat / fix / perf / content commit
 *   content/changelog/highlights.json the written highlights, per day
 *   content/changelog/roadmap.json    what comes next, and what is owed
 *   docs/redesign/phases, PHASES.md   the phase counts (scripts/lib/phases.mjs,
 *                                     the same reader `pnpm phase` uses)
 * Writes (committed: Vercel builds from a shallow clone, which has no history):
 *   apps/console/src/generated/changelog.json
 *   apps/web/src/generated/changelog.json
 *
 * Run it before committing a session's last commit: `pnpm changelog`. A file
 * can never list the commit it is part of, so it is always one commit behind
 * the one that carries it; the page says which commit it was made at.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { ROOT, buildPhases, redesignPhases } from "./lib/phases.mjs";

const SHOWN = new Set(["feat", "fix", "perf", "content"]);
const CONVENTIONAL = /^([a-z+]+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

function commits() {
  const out = execFileSync("git", ["log", "--format=%ad%x09%h%x09%s", "--date=short"], { cwd: ROOT, encoding: "utf8" });
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [date, hash, ...rest] = line.split("\t");
      const subject = rest.join("\t");
      const m = CONVENTIONAL.exec(subject);
      if (!m) return null;
      return { date, hash, type: m[1], scope: m[2] ?? null, subject: m[4] };
    })
    .filter((c) => c && SHOWN.has(c.type));
}

const all = commits();
const head = execFileSync("git", ["log", "-1", "--format=%h%x09%ad", "--date=short"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\t");
const highlights = read("content/changelog/highlights.json").updates;
const roadmap = read("content/changelog/roadmap.json");
const byDate = new Map(highlights.map((h) => [h.date, h]));

// Every day that shipped something, newest first; a day without written
// highlights still shows, with its commits, so nothing is hidden by omission.
const days = [...new Set([...all.map((c) => c.date), ...highlights.map((h) => h.date)])].sort().reverse();
const unwritten = days.filter((d) => !byDate.has(d));

const redesign = redesignPhases().map(({ id, label, done, todo }) => ({ id, label, done, todo }));
const done = redesign.reduce((n, p) => n + p.done, 0);
const total = redesign.reduce((n, p) => n + p.done + p.todo, 0);
const pct = total === 0 ? 0 : Math.round((done / total) * 100);

const madeAt = { commit: head[0], date: head[1] };

const consoleData = {
  madeAt,
  updates: days.map((date) => {
    const h = byDate.get(date);
    return {
      date,
      title: h?.title ?? "Updates",
      highlights: h?.teachers ?? [],
      commits: all.filter((c) => c.date === date).map(({ hash, type, scope, subject }) => ({ hash, type, scope, subject })),
    };
  }),
  phases: { redesign, build: buildPhases(), done, total, pct },
  roadmap: { next: roadmap.next, owed: roadmap.owed },
};

const webData = {
  madeAt,
  progress: { done, total, pct },
  updates: highlights
    .filter((h) => Array.isArray(h.students) && h.students.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    // A student's title in a student's words: the day's own title is the
    // teachers' ("The console rebuild begins"), jargon on the student's page.
    .map((h) => ({ date: h.date, title: h.studentTitle ?? h.title, items: h.students })),
};

for (const [file, data] of [
  ["apps/console/src/generated/changelog.json", consoleData],
  ["apps/web/src/generated/changelog.json", webData],
]) {
  const p = resolve(ROOT, file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(
  `changelog: ${consoleData.updates.length} days, ${all.length} commits, redesign ${done}/${total} (${pct}%), ` +
    `${webData.updates.length} days for students; made at ${madeAt.commit}`,
);
if (unwritten.length > 0) {
  console.log(`  no written highlights yet for: ${unwritten.join(", ")} (shown with their commits only)`);
}
