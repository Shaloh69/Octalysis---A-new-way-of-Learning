import type { ContentStage, EditVia, StageSummary, SummaryStatus } from "./api";

/**
 * `/content`'s words and its preview rules, tested in `test/content-view.spec.ts`.
 * The page decides nothing a student depends on: approval, versioning and the
 * quote rule are the API's and the database's (`services/api/src/routes/content.ts`).
 */

export const ACT_NAMES = ["", "Prelim", "Midterm", "Semi-finals", "Finals"] as const;

export const AUTHORING_WORD: Record<ContentStage["authoring"], string> = {
  authored: "Authored",
  planned: "Planned",
  empty: "Empty",
};

export const SUMMARY_WORD: Record<SummaryStatus | "none", string> = {
  draft: "To review",
  approved: "Approved",
  sent_back: "Sent back",
  none: "None",
};

/** Words carry the state; the tone only agrees with them. Never `danger`: nothing here is destructive. */
export type Tone = "success" | "info" | "warning" | "neutral";
export const AUTHORING_TONE: Record<ContentStage["authoring"], Tone> = {
  authored: "success",
  planned: "info",
  empty: "neutral",
};
export const SUMMARY_TONE: Record<SummaryStatus | "none", Tone> = {
  approved: "success",
  draft: "info",
  sent_back: "warning",
  none: "neutral",
};

export const VIA_WORD: Record<EditVia, string> = {
  console: "in the console",
  sync: "by sync, from the file",
  direct: "directly in the database",
};

export const archetypeName = (a: string): string =>
  a === "A" ? "concept" : a === "B" ? "computation" : a === "C" ? "artifact" : "simulator";

/** The review queue's three groups, in the order a reviewer works them. */
export const GROUPS: Array<{ status: SummaryStatus; title: string; empty: string }> = [
  { status: "draft", title: "To review", empty: "Nothing waiting. Every drafted summary has been read." },
  { status: "sent_back", title: "Sent back", empty: "None sent back." },
  { status: "approved", title: "Approved", empty: "None approved yet. Students see no summaries on the map." },
];

/**
 * After approving or sending back `done`, the next summary still waiting,
 * in stage order after it and then from the top. Null when none waits.
 */
export function nextToReview(summaries: readonly StageSummary[], done: string): string | null {
  const waiting = summaries.filter((s) => s.status === "draft" && s.stageId !== done).map((s) => s.stageId);
  return waiting.find((id) => id > done) ?? waiting[0] ?? null;
}

export const characters = (n: number): string => `${n} ${n === 1 ? "character" : "characters"}`;

/** Save is offered only for a real change, with a reason the API will accept. */
export function canSave(saved: string, typed: string, reason: string): boolean {
  const t = typed.replace(/\r\n/g, "\n").trim();
  return t.length > 0 && t !== saved.trim() && reason.trim().length >= 3;
}

/** A block's first line, for its row: markers stripped, cut at a word. */
export function excerpt(body: string, max = 96): string {
  const line = body.split(/\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const plain = line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 16))}…`;
}

/* ------------------------------------------------------------------ preview */

/* The preview's markdown is `lib/reader-markdown.ts`, the student reader's own. */

/** How the reader draws a block: which of its five shapes. */
export type Shape = "code" | "planned" | "callout" | "brief" | "prose";
export function shapeOf(kind: string, meta: Record<string, string>): Shape {
  if (kind === "code") return "code";
  if (kind === "callout") return meta.kind === "planned" || meta.kind === "scaffold" ? "planned" : "callout";
  if (kind === "brief") return "brief";
  return "prose"; // prose, quote, and anything else: the reader has no other branch
}

/** A stage's levels: a run of three or more is a range, so [0..6] reads "L0–6", not seven numbers. */
export function levelsText(levels: readonly number[]): string {
  const xs = [...levels];
  const contiguous = xs.length >= 3 && xs.every((v, i) => i === 0 || v === xs[i - 1]! + 1);
  return contiguous ? `L${xs[0]}–${xs[xs.length - 1]}` : `L${xs.join(",")}`;
}
