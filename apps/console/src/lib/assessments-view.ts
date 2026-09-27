import type { Assessment, Bank, Shortfall } from "./api";
import { dayDate, TYPE_WORD } from "./record-view";

/**
 * `/assessments`' pure logic: what state an assessment is in, how its window
 * and its bank read in words. Tested in `test/assessments-view.spec.ts`; the
 * page only renders what these return.
 */

export type WindowState = "open" | "scheduled" | "closed";

/**
 * The same rule the engine enforces at Start (`engine-repo.ts`): a NULL bound
 * is no bound, so an assessment with neither date is open now.
 */
export function windowState(a: Pick<Assessment, "opensAt" | "closesAt">, now: Date = new Date()): WindowState {
  const t = now.getTime();
  if (a.closesAt && new Date(a.closesAt).getTime() < t) return "closed";
  if (a.opensAt && new Date(a.opensAt).getTime() > t) return "scheduled";
  return "open";
}

export const STATE_TONE = { open: "success", scheduled: "info", closed: "locked" } as const;

/** `1 Oct 2026, 08:00` in the reader's zone. Built by hand, like `dayDate`. */
export function dayTime(iso: string | null): string | null {
  const day = dayDate(iso);
  if (!day || !iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The two lines of the Window cell; empty when there is no window. */
export function windowLines(a: Pick<Assessment, "opensAt" | "closesAt">): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const o = dayTime(a.opensAt);
  const c = dayTime(a.closesAt);
  if (o) out.push(["opens", o]);
  if (c) out.push(["closes", c]);
  return out;
}

/** What a student can do with it, as a sentence for the preview. */
export function windowSentence(opensAt: string | null, closesAt: string | null, now: Date = new Date()): string {
  const state = windowState({ opensAt, closesAt }, now);
  const o = dayTime(opensAt);
  const c = dayTime(closesAt);
  if (state === "closed") return `Closed on ${c}.`;
  if (state === "scheduled") return c ? `Opens ${o}, closes ${c}.` : `Opens ${o} and stays open.`;
  return c ? `Open now, closes ${c}.` : "Open now, and stays open.";
}

/**
 * When the salt was set or last rotated: `{ verb: "set", day: "27 Sep 2026" }`.
 * Null when there is no salt row, which the page turns into a warning. Never
 * the salt: the API does not send it and the page could not show it if it did.
 */
export function saltState(
  a: Pick<Assessment, "saltSetAt" | "saltRotatedAt">,
): { verb: "set" | "rotated"; day: string } | null {
  if (a.saltRotatedAt) return { verb: "rotated", day: dayDate(a.saltRotatedAt) ?? "" };
  if (a.saltSetAt) return { verb: "set", day: dayDate(a.saltSetAt) ?? "" };
  return null;
}

const ACT_WORD: Record<string, string> = { "1": "Prelim", "2": "Midterm", "3": "Semi-finals", "4": "Finals" };

/** A shortfall cell in a teacher's words: `Bloom · apply`, `Type · computed`, `Act 1 · Prelim`. */
export function cellWords(s: Pick<Shortfall, "dimension" | "cell">): string {
  if (s.dimension === "by_bloom") return `Bloom · ${s.cell}`;
  if (s.dimension === "by_type") {
    const w = TYPE_WORD[s.cell as keyof typeof TYPE_WORD];
    return `Type · ${w ? w.toLowerCase() : s.cell}`;
  }
  if (s.dimension === "by_act") return `Act ${s.cell}${ACT_WORD[s.cell] ? ` · ${ACT_WORD[s.cell]}` : ""}`;
  return `${s.dimension} · ${s.cell}`;
}

/** The Bank cell: `fills`, or how short it is, in one phrase. */
export function bankWords(b: Bank): string {
  if (b.satisfiable) return "fills";
  if (!b.enoughItems) return `short: ${b.poolSize} of ${b.totalItems} live`;
  const n = b.shortfalls.length;
  return `short in ${n} ${n === 1 ? "cell" : "cells"}`;
}

/** The header's counts line. */
export function counts(rows: Array<Pick<Assessment, "opensAt" | "closesAt">>, now: Date = new Date()) {
  const c = { all: rows.length, open: 0, scheduled: 0, closed: 0 };
  for (const r of rows) c[windowState(r, now)] += 1;
  return c;
}

/**
 * Assessments a student can reach (open, or scheduled to open) that the bank
 * cannot fill: each one is a Start that will fail. A closed one no longer
 * matters.
 */
export function unfillable(rows: Array<Pick<Assessment, "opensAt" | "closesAt" | "bank">>, now: Date = new Date()) {
  return rows.filter((r) => windowState(r, now) !== "closed" && !r.bank.satisfiable);
}

/** An ISO instant as a `datetime-local` value in the browser's own zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value as an ISO instant, or null for an empty field. */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
