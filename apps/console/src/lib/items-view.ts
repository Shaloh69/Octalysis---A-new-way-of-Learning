import type { BankItem } from "./api";

/**
 * What `/items` shows, as pure functions over the bank.
 *
 * The page fetches the WHOLE bank once (the API allows 2000 rows; the target
 * is ~700) and does its filtering, counting and paging here. Two reasons:
 * facet counts ("Review 183") can only be honest if they are counted over the
 * same list the table shows, and a reviewer moving through the queue must
 * advance through exactly the order they are looking at.
 *
 * Pure, so it is tested: `apps/console/CLAUDE.md` puts logic in `src/lib/`
 * and tests it, and leaves the JSX untested.
 */

export type ItemStatus = BankItem["status"];
export type ItemType = BankItem["type"];

export const STATUSES: readonly ItemStatus[] = ["review", "draft", "live", "retired"];

/**
 * The item types, in words. `G` is an ORDERING item -- `correct_spec` holds an
 * `order` -- and the page this replaced called it "generated", which was wrong
 * and read as though G items were machine-written.
 */
export const TYPE_LABEL: Record<ItemType, string> = {
  S: "static",
  P: "parameterized",
  G: "ordering",
};

export interface ItemsFilter {
  query: string;
  status: ItemStatus | "";
  stageId: string;
  type: ItemType | "";
  objectiveId: string;
  flaggedOnly: boolean;
}

export const NO_FILTER: ItemsFilter = {
  query: "",
  status: "",
  stageId: "",
  type: "",
  objectiveId: "",
  flaggedOnly: false,
};

export function isFiltered(f: ItemsFilter): boolean {
  return (
    f.query.trim() !== "" ||
    f.status !== "" ||
    f.stageId !== "" ||
    f.type !== "" ||
    f.objectiveId !== "" ||
    f.flaggedOnly
  );
}

function matchesQuery(i: BankItem, q: string): boolean {
  if (q === "") return true;
  const hay = `${i.slug} ${i.stemTemplate} ${i.objectiveId ?? ""} ${i.objectiveText ?? ""}`;
  return hay.toLowerCase().includes(q);
}

/** Every filter except the one named, so a facet can count its own options. */
export function filterItems(
  items: readonly BankItem[],
  f: ItemsFilter,
  except?: keyof ItemsFilter,
): BankItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (except === "query" || matchesQuery(i, q)) &&
      (except === "status" || f.status === "" || i.status === f.status) &&
      (except === "stageId" || f.stageId === "" || i.stageId === f.stageId) &&
      (except === "type" || f.type === "" || i.type === f.type) &&
      (except === "objectiveId" || f.objectiveId === "" || i.objectiveId === f.objectiveId) &&
      (except === "flaggedOnly" || !f.flaggedOnly || i.stats.flagged),
  );
}

/**
 * The queue order: FLAGGED FIRST, then stage and slug.
 *
 * A flagged item is one the statistics say is probably broken -- most often a
 * wrong key on a live paper -- so it is the first thing a reviewer should see,
 * not something found on page six.
 */
export function sortForReview(items: readonly BankItem[]): BankItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.stats.flagged) - Number(a.stats.flagged) ||
      a.stageId.localeCompare(b.stageId) ||
      a.slug.localeCompare(b.slug) ||
      b.version - a.version,
  );
}

/** Counts per status over everything the OTHER filters let through. */
export function statusCounts(items: readonly BankItem[], f: ItemsFilter): Record<ItemStatus, number> {
  const c: Record<ItemStatus, number> = { draft: 0, review: 0, live: 0, retired: 0 };
  for (const i of filterItems(items, f, "status")) c[i.status] += 1;
  return c;
}

/**
 * Objectives to offer, from the bank itself: an objective with no items is not
 * something to browse by. Narrowed to the chosen stage when there is one.
 */
export function objectiveOptions(
  items: readonly BankItem[],
  stageId: string,
): Array<{ id: string; text: string }> {
  const seen = new Map<string, string>();
  for (const i of items) {
    if (!i.objectiveId) continue;
    if (stageId !== "" && i.stageId !== stageId) continue;
    if (!seen.has(i.objectiveId)) seen.set(i.objectiveId, i.objectiveText ?? "");
  }
  return [...seen]
    .map(([id, text]) => ({ id, text }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export interface Page<T> {
  rows: T[];
  /** 1-based, clamped into range. */
  page: number;
  pages: number;
  /** 1-based index of the first row shown; 0 when there are none. */
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(list: readonly T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const rows = list.slice(start, start + size);
  return {
    rows,
    page: p,
    pages,
    from: rows.length === 0 ? 0 : start + 1,
    to: start + rows.length,
    total: list.length,
  };
}

/**
 * The item after `id` in the list the reviewer is looking at, or null.
 *
 * Taken from the list BEFORE the reload that follows a decision: afterwards the
 * item just decided may have left the filter and every index moves.
 */
export function nextAfter(list: readonly BankItem[], id: string): BankItem | null {
  const i = list.findIndex((x) => x.id === id);
  return i >= 0 ? (list[i + 1] ?? null) : null;
}

/** The first item awaiting review in the list, for "Review next". */
export function firstAwaitingReview(list: readonly BankItem[]): BankItem | null {
  return list.find((i) => i.status === "review") ?? null;
}

/**
 * The psychometrics in words. Colour is never the only signal: a negative
 * point-biserial means the students who did best on the paper did worst on
 * this item, which almost always means the key is wrong, and that sentence is
 * the reason a teacher opens this page.
 *
 * Null below 30 exposures: under that the numbers are noise, and the page says
 * so once, above the table, rather than on every row.
 */
export const MIN_EXPOSURES = 30;

export function readPValue(p: number | null): { tone: "warn" | "plain"; words: string } | null {
  if (p === null) return null;
  if (p < 0.25) return { tone: "warn", words: "at guessing" };
  if (p > 0.85) return { tone: "plain", words: "very easy" };
  return { tone: "plain", words: "reasonable" };
}

export function readDiscrimination(
  d: number | null,
): { tone: "bad" | "warn" | "plain"; words: string | null } | null {
  if (d === null) return null;
  if (d < 0) return { tone: "bad", words: "the key is probably wrong" };
  if (d < 0.15) return { tone: "warn", words: "not separating students" };
  return { tone: "plain", words: null };
}

/** `octa-items-2026-09-25.json`, or with the stage when the export is one stage. */
export function exportFileName(now: Date, stageId: string): string {
  const d = now.toISOString().slice(0, 10);
  return `octa-items-${stageId ? `stage-${stageId}-` : ""}${d}.json`;
}
