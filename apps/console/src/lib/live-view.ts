import type { LiveSession, LiveStage } from "@octa/contracts";

/**
 * `/live` and `/live/present`: the words and numbers, decided once.
 *
 * Every figure here arrives already withheld or not: the server sends null in
 * place of an average below five students and of a split below five answers.
 * Nothing in this file decides anonymity; it only says, in words, what the
 * server did.
 */

/** How often the room is read. One read, then one per this, never overlapping. */
export const POLL_MS = 5000;

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The share correct, a whole percent. null when there is nothing to divide. */
export function share(correct: number | null, answered: number): number | null {
  if (correct === null || answered <= 0) return null;
  return Math.round((correct / answered) * 100);
}

/** Who may answer a question, in words. */
export function whoMayAnswer(section: string | null): string {
  return section ? `section ${section}` : "everyone";
}

/**
 * Wall-clock time, built by hand: `toLocaleTimeString` is not one format
 * (`NEXT-SESSION.md` §0e.5), and a projector should not change its clock with
 * the laptop's locale.
 */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The projector shows at most this many stages: the most students first, then in course order. */
export function busiest(stages: LiveStage[], n = 8): LiveStage[] {
  return [...stages]
    .sort((a, b) => b.students - a.students || a.stageId.localeCompare(b.stageId))
    .slice(0, n)
    .sort((a, b) => a.stageId.localeCompare(b.stageId));
}

/** The sentence the toast says when a question is started. */
export function startedWords(slug: string, section: string | null): string {
  return `${slug} put to the room, for ${whoMayAnswer(section)}`;
}

/** The sentence the toast says when a question is ended. */
export function endedWords(slug: string, answered: number): string {
  return `${slug} ended after ${plural(answered, "answer", "answers")}`;
}

/** What the result line says: the split, or why there is none yet. */
export function resultWords(s: Pick<LiveSession, "answered" | "correct">, min: number): string {
  const pct = share(s.correct, s.answered);
  if (pct === null) {
    return s.answered === 0
      ? `Nobody has answered yet. The result appears once ${min} have.`
      : `Held back until ${min} have answered: with fewer, it would say how each of them did.`;
  }
  return `${s.correct} of ${s.answered} correct, ${pct}%`;
}
