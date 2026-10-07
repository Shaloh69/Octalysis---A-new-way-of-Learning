import type { ContentStatus } from "./api";
import { CONTENT_SUBJECT } from "./approval-gate";

/**
 * Course Studio's addresses, words and counts (`design/templates/console/studio/SPEC.md`),
 * tested in `test/studio-view.spec.ts`. Nothing here decides who may do what:
 * that is the API's and the database's.
 */

/** A subject's address is its code, lowercased, the space a hyphen: `CPE 412` -> `cpe-412`. */
export const subjectSlug = (code: string): string => code.trim().toLowerCase().replace(/\s+/g, "-");

export function subjectFromSlug(slug: string, codes: readonly string[]): string | null {
  return codes.find((c) => subjectSlug(c) === slug.toLowerCase()) ?? null;
}

export const subjectPath = (code: string): string => `/studio/${subjectSlug(code)}`;
export const chapterPath = (stageId: string, code: string = CONTENT_SUBJECT): string =>
  `${subjectPath(code)}/${stageId}`;

/** What waits for a reader, in one number: summaries, drafted chapters and figures to review. */
export function reviewCount(s: ContentStatus["summary"]): number {
  return s.summaries.draft + s.chapters.draft + s.figures.waiting;
}

/** The word beside a chapter in the outline when something there needs reading. */
export function outlineNote(s: {
  summaryStatus: "draft" | "approved" | "sent_back" | null;
  draftStatus: "draft" | "approved" | "sent_back" | null;
  figuresWaiting?: number;
}): string | null {
  return s.summaryStatus === "draft" || s.draftStatus === "draft" || (s.figuresWaiting ?? 0) > 0 ? "to review" : null;
}
