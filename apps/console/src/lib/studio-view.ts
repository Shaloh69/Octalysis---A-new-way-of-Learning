import type { ChapterDetail, ContentStatus } from "./api";
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

/** The chapter's tabs, in the order the SPEC lists them. */
export type Tab = "blocks" | "summary" | "draft" | "figures" | "objectives";
export const TAB_WORD: Record<Tab, string> = {
  blocks: "Blocks",
  summary: "Summary",
  draft: "Draft",
  figures: "Figures",
  objectives: "Objectives",
};
export const isTab = (v: string | null): v is Tab => v !== null && v in TAB_WORD;

export interface TabInfo { id: Tab; label: string; waiting: boolean }

/**
 * Draft and Figures appear only when the chapter has them. A tab with something
 * waiting says so in a word ("to review"): the teacher should not have to open
 * each to find out.
 */
export function tabsFor(d: Pick<ChapterDetail, "summary" | "draft" | "figures">): TabInfo[] {
  const tabs: TabInfo[] = [
    { id: "blocks", label: TAB_WORD.blocks, waiting: false },
    { id: "summary", label: TAB_WORD.summary, waiting: d.summary?.status === "draft" },
  ];
  if (d.draft) tabs.push({ id: "draft", label: TAB_WORD.draft, waiting: d.draft.status === "draft" });
  if (d.figures.length > 0) {
    tabs.push({ id: "figures", label: TAB_WORD.figures, waiting: d.figures.some((f) => f.status === "draft") });
  }
  tabs.push({ id: "objectives", label: TAB_WORD.objectives, waiting: false });
  return tabs;
}

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
