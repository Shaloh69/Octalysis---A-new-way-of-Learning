import { describe, it, expect } from "vitest";
import type { AuthoredItem } from "@octa/contracts";
import {
  countActions, planImport, sameContent, toAuthored, toRowFields,
  type ExistingItem, type PlanContext,
} from "../../src/items/import-plan.js";

/**
 * The import planner, with no database.
 *
 * One test per rule, named after the rule, in the same order as
 * `scripts/sync-items.mjs`'s `validateShape()` -- the two must agree on what a
 * valid item is, and they cannot share code (that script cannot import TS), so
 * this file is how the pair is kept honest.
 */

const S: AuthoredItem = {
  slug: "04-cache-definition",
  objective: "04.1",
  type: "S",
  bloom: "remember",
  difficulty: 0.78,
  stem: "What is a cache?",
  correct: "A small, fast memory",
  distractors: ["A disk", "A register file", "An I/O buffer"],
  rationale: "Small, fast, and between two things.",
  source: "ch-04.md §4.2",
};
const G: AuthoredItem = {
  slug: "04-hierarchy-order",
  objective: "04.3",
  type: "G",
  bloom: "understand",
  stem: "Order the memory hierarchy, fastest first.",
  order: ["Registers", "L1 cache", "L2 cache", "Main memory"],
  source: "ch-04.md §4.1",
};
const P: AuthoredItem = {
  slug: "04-amat-p",
  objective: "04.4",
  type: "P",
  bloom: "apply",
  solver: "amat",
  source: "ch-04.md Appendix 4A",
};

function ctx(existing: ExistingItem[] = []): PlanContext {
  return {
    existing: new Map(existing.map((e) => [e.slug, e])),
    objectives: new Map([
      ["04.1", "04"], ["04.3", "04"], ["04.4", "04"], ["01.1", "01"],
    ]),
    solvers: new Set(["amat"]),
    examinable: (s) => s <= "08",
    examinableThrough: "08",
  };
}
const plan = (items: AuthoredItem[], c = ctx(), stageId = "04") =>
  planImport({ stageId, items }, c);
const reasons = (items: AuthoredItem[], c = ctx(), stageId = "04") =>
  plan(items, c, stageId).flatMap((r) => r.reasons).join(" | ");

describe("validity — the same rules as sync-items.mjs", () => {
  it("valid items of all three types plan as create", () => {
    const rows = plan([S, G, P]);
    expect(rows.map((r) => r.action)).toEqual(["create", "create", "create"]);
    expect(countActions(rows)).toMatchObject({ create: 3, invalid: 0 });
  });

  it("slug: 6-80 of a-z, 0-9 and hyphen", () => {
    expect(reasons([{ ...S, slug: "Bad Slug" }])).toContain("slug must be");
    expect(reasons([{ ...S, slug: "a-b" }])).toContain("slug must be");
  });

  it("slug: no duplicates within one file", () => {
    expect(reasons([S, S])).toContain("duplicate slug in this file");
  });

  it("an objective is required, must exist, and must be the item's own stage's", () => {
    expect(reasons([{ ...S, objective: "" }])).toContain("no objective");
    expect(reasons([{ ...S, objective: "04.9" }])).toContain("objective 04.9 does not exist");
    expect(reasons([{ ...S, objective: "01.1" }])).toContain("belongs to stage 01, not 04");
  });

  it("a source is required for anything new", () => {
    expect(reasons([{ ...S, source: null }])).toContain("no source");
  });

  it("S: a stem, a correct answer, three distinct distractors, the key not among them", () => {
    expect(reasons([{ ...S, stem: "Short" }])).toContain("S needs a stem");
    expect(reasons([{ ...S, correct: " " }])).toContain("no correct answer");
    expect(reasons([{ ...S, distractors: ["a", "b"] }])).toContain("at least 3 distractors");
    expect(reasons([{ ...S, distractors: ["a", "a", "b"] }])).toContain("duplicate distractors");
    expect(reasons([{ ...S, distractors: ["a", "b", S.correct!] }])).toContain(
      "also appears as a distractor",
    );
  });

  it("P: a registered solver", () => {
    expect(reasons([{ ...P, solver: undefined }])).toContain("P needs a solver");
    expect(reasons([{ ...P, solver: "nope" }])).toContain('unknown solver "nope"');
  });

  it("G: a stem and an unambiguous order of at least three", () => {
    expect(reasons([{ ...G, order: ["a", "b"] }])).toContain("at least 3 steps");
    expect(reasons([{ ...G, order: ["a", "b", "a"] }])).toContain("duplicate steps");
  });

  it("the stage must be inside the examinable scope, and must be given", () => {
    expect(reasons([{ ...S, objective: "15.1" }], ctx(), "15")).toContain(
      "beyond the examinable scope (through 08)",
    );
    const noStage = planImport({ items: [S] }, ctx());
    expect(noStage[0]!.reasons.join(" ")).toContain("no stage");
  });

  it("a per-item stageId wins over the file's", () => {
    const rows = planImport({ stageId: "01", items: [{ ...S, stageId: "04" }] }, ctx());
    expect(rows[0]!.action).toBe("create");
    expect(rows[0]!.stageId).toBe("04");
  });
});

describe("what happens to an item the bank already has", () => {
  const existing = (it: AuthoredItem, status: ExistingItem["status"]): ExistingItem => ({
    id: "id-" + it.slug,
    familyId: "fam-" + it.slug,
    slug: it.slug,
    status,
    version: 1,
    fields: toRowFields(it, "04"),
  });

  it("identical content is unchanged, and needs no source", () => {
    const rows = plan([{ ...S, source: null }], ctx([existing(S, "review")]));
    expect(rows[0]!.action).toBe("unchanged");
  });

  it("changed content on a draft or review item is a new VERSION of the same family", () => {
    for (const status of ["draft", "review"] as const) {
      const rows = plan([{ ...S, stem: "What is a cache, in one line?" }], ctx([existing(S, status)]));
      expect(rows[0]!.action).toBe("version");
      expect(rows[0]!.replaces?.familyId).toBe("fam-" + S.slug);
    }
  });

  it("a LIVE item is refused, however it changed", () => {
    const rows = plan([{ ...S, stem: "What is a cache, in one line?" }], ctx([existing(S, "live")]));
    expect(rows[0]!.action).toBe("refused");
    expect(rows[0]!.reasons.join(" ")).toContain("is live");
  });

  it("a RETIRED family is refused", () => {
    const rows = plan([{ ...S, stem: "What is a cache, in one line?" }], ctx([existing(S, "retired")]));
    expect(rows[0]!.action).toBe("refused");
  });
});

describe("export and import are inverses", () => {
  it("toAuthored(toRowFields(x)) compares equal to x, for all three types", () => {
    for (const it of [S, G, { ...G, take: 3 }, P]) {
      const f = toRowFields(it, "04");
      const back = toRowFields(toAuthored(it.slug, f), "04");
      expect(sameContent(f, back), it.slug).toBe(true);
    }
  });

  it("key order inside the answer spec does not count as a change", () => {
    const a = toRowFields({ ...G, take: 3 }, "04");
    const b = { ...a, correctSpec: { take: 3, order: a.correctSpec.order } };
    expect(sameContent(a, b)).toBe(true);
  });
});
