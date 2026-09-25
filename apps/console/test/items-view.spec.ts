import { describe, it, expect } from "vitest";
import type { BankItem } from "../src/lib/api";
import {
  NO_FILTER, exportFileName, filterItems, firstAwaitingReview, isFiltered, nextAfter,
  objectiveOptions, paginate, readDiscrimination, readPValue, sortForReview, statusCounts,
} from "../src/lib/items-view";

/**
 * `/items`' view logic. Every function here is one where being wrong is
 * silent: a count that disagrees with the table, a queue that skips an item,
 * a flagged item buried on page six.
 */

let n = 0;
function item(
  over: Omit<Partial<BankItem>, "stats"> & { stats?: Partial<BankItem["stats"]> } = {},
): BankItem {
  n += 1;
  const { stats, ...rest } = over;
  return {
    id: `id-${n}`,
    familyId: `fam-${n}`,
    slug: `01-item-${String(n).padStart(3, "0")}`,
    stageId: "01",
    objectiveId: "01.1",
    objectiveText: "Define computer architecture",
    type: "S",
    status: "review",
    version: 1,
    bloom: "remember",
    targetDifficulty: 0.6,
    stemTemplate: "A stem",
    solverRef: null,
    authorName: null,
    reviewerName: null,
    reviewedAt: null,
    createdAt: "2026-09-25T00:00:00Z",
    ...rest,
    stats: { exposures: 0, pValue: null, discrimination: null, flagged: false, flagReason: null, ...stats },
  };
}

describe("filtering", () => {
  const bank = [
    item({ slug: "01-cache-a", stageId: "01", type: "S", status: "review" }),
    item({ slug: "04-cache-b", stageId: "04", objectiveId: "04.3", type: "G", status: "live" }),
    item({ slug: "04-amat", stageId: "04", objectiveId: "04.4", type: "P", status: "draft",
           stats: { flagged: true } }),
  ];

  it("no filter is everything", () => {
    expect(filterItems(bank, NO_FILTER)).toHaveLength(3);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it("narrows by stage, status, type, objective and flag, together", () => {
    expect(filterItems(bank, { ...NO_FILTER, stageId: "04" }).map((i) => i.slug)).toEqual([
      "04-cache-b", "04-amat",
    ]);
    expect(filterItems(bank, { ...NO_FILTER, type: "G" })).toHaveLength(1);
    expect(filterItems(bank, { ...NO_FILTER, objectiveId: "04.4" })).toHaveLength(1);
    expect(filterItems(bank, { ...NO_FILTER, flaggedOnly: true })[0]!.slug).toBe("04-amat");
    expect(filterItems(bank, { ...NO_FILTER, stageId: "04", status: "live" })).toHaveLength(1);
  });

  it("the search matches slug, stem and objective, case-insensitively", () => {
    expect(filterItems(bank, { ...NO_FILTER, query: "CACHE" })).toHaveLength(2);
    expect(filterItems(bank, { ...NO_FILTER, query: "04.4" })).toHaveLength(1);
    expect(filterItems(bank, { ...NO_FILTER, query: "architecture" })).toHaveLength(3);
  });

  it("status counts ignore the status filter itself but honour the others", () => {
    const f = { ...NO_FILTER, stageId: "04", status: "live" as const };
    expect(statusCounts(bank, f)).toEqual({ draft: 1, review: 0, live: 1, retired: 0 });
  });
});

describe("the review queue", () => {
  it("puts flagged items first, then stage and slug", () => {
    const a = item({ slug: "04-z", stageId: "04" });
    const b = item({ slug: "01-b", stageId: "01" });
    const c = item({ slug: "07-flagged", stageId: "07", stats: { flagged: true } });
    const d = item({ slug: "01-a", stageId: "01" });
    expect(sortForReview([a, b, c, d]).map((i) => i.slug)).toEqual([
      "07-flagged", "01-a", "01-b", "04-z",
    ]);
  });

  it("advances to the next item in the list being looked at, and stops at the end", () => {
    const list = [item(), item(), item()];
    expect(nextAfter(list, list[0]!.id)).toBe(list[1]);
    expect(nextAfter(list, list[2]!.id)).toBeNull();
    expect(nextAfter(list, "not-there")).toBeNull();
  });

  it("'review next' finds the first item awaiting review, not the first row", () => {
    const list = [item({ status: "live" }), item({ status: "review" })];
    expect(firstAwaitingReview(list)).toBe(list[1]);
    expect(firstAwaitingReview([item({ status: "live" })])).toBeNull();
  });
});

describe("objectives to browse by", () => {
  it("come from the bank, narrowed to the stage, in numeric order", () => {
    const bank = [
      item({ stageId: "04", objectiveId: "04.10", objectiveText: "ten" }),
      item({ stageId: "04", objectiveId: "04.2", objectiveText: "two" }),
      item({ stageId: "01", objectiveId: "01.1" }),
      item({ stageId: "04", objectiveId: "04.2", objectiveText: "two" }),
      item({ stageId: "04", objectiveId: null }),
    ];
    expect(objectiveOptions(bank, "04").map((o) => o.id)).toEqual(["04.2", "04.10"]);
    expect(objectiveOptions(bank, "")).toHaveLength(3);
  });
});

describe("paging", () => {
  const list = Array.from({ length: 53 }, (_, i) => i);

  it("slices, and reports the range in words a person would use", () => {
    const p = paginate(list, 3, 25);
    expect(p).toMatchObject({ page: 3, pages: 3, from: 51, to: 53, total: 53 });
    expect(p.rows).toEqual([50, 51, 52]);
  });

  it("clamps a page that no longer exists after a filter narrows the list", () => {
    expect(paginate(list.slice(0, 5), 3, 25)).toMatchObject({ page: 1, from: 1, to: 5 });
  });

  it("an empty list is page 1 of 1, showing nothing", () => {
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0, total: 0 });
  });
});

describe("the psychometrics, in words", () => {
  it("a p-value under 0.25 is at guessing; over 0.85 is very easy", () => {
    expect(readPValue(0.18)).toEqual({ tone: "warn", words: "at guessing" });
    expect(readPValue(0.9)?.words).toBe("very easy");
    expect(readPValue(0.5)?.words).toBe("reasonable");
    expect(readPValue(null)).toBeNull();
  });

  it("a NEGATIVE discrimination says the key is probably wrong", () => {
    expect(readDiscrimination(-0.12)).toEqual({ tone: "bad", words: "the key is probably wrong" });
    expect(readDiscrimination(0.1)?.words).toBe("not separating students");
    expect(readDiscrimination(0.4)).toEqual({ tone: "plain", words: null });
  });
});

describe("the export's file name", () => {
  it("is dated, and names the stage when the export is one stage", () => {
    const d = new Date("2026-09-25T08:00:00Z");
    expect(exportFileName(d, "")).toBe("octa-items-2026-09-25.json");
    expect(exportFileName(d, "04")).toBe("octa-items-stage-04-2026-09-25.json");
  });
});
