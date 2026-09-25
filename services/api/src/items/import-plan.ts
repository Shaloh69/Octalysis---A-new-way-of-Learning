import type { AuthoredItem, ItemFile, ItemImportAction, ItemImportRow } from "@octa/contracts";

/**
 * Plan an item import: for every item in a file, decide what would happen to
 * it, and why -- without touching the database.
 *
 * PURE ON PURPOSE. The route reads the bank, hands a snapshot in, and applies
 * the plan inside a transaction; everything that decides anything lives here,
 * where a unit test can reach every branch without a database.
 *
 * THE RULES MIRROR `scripts/sync-items.mjs`'s `validateShape()`, because a file
 * that sync accepts and import refuses (or the reverse) would mean two
 * definitions of a valid item. That script cannot import TypeScript, so the
 * rules are duplicated rather than shared. If you change one, change the other;
 * `import-plan.spec.ts` names each rule so the pair can be compared line by line.
 *
 * Three rules sync does not need, because it runs from the repo:
 *
 * - **An objective belongs to the item's stage.** Sync reads a stage's own file.
 * - **A new or changed item names its source.** Sync checks this too, but here
 *   an UNCHANGED row is excused: the database does not store `source`, so an
 *   export cannot carry it, and a round trip of untouched items must be a no-op.
 * - **A live or retired item is never replaced.** Sync skips them; import says
 *   so per row. Versioning a live item retires it at once -- pulling it out from
 *   under students -- and that is `/items/:id/edit`'s decision, with its
 *   mandatory "statistics do not carry over" confirmation, not an upload's.
 */

/** The latest version of one slug, as the bank holds it. */
export interface ExistingItem {
  id: string;
  familyId: string;
  slug: string;
  status: "draft" | "review" | "live" | "retired";
  version: number;
  fields: RowFields;
}

/** The columns an authored item turns into -- the thing that is compared. */
export interface RowFields {
  stageId: string;
  objectiveId: string;
  type: "S" | "P" | "G";
  bloom: string;
  targetDifficulty: number;
  stemTemplate: string;
  solverRef: string | null;
  correctSpec: Record<string, unknown>;
  distractorPool: unknown[];
  rationale: string | null;
}

export interface PlanContext {
  /** Latest version per slug. */
  existing: ReadonlyMap<string, ExistingItem>;
  /** objective id -> the stage it belongs to. */
  objectives: ReadonlyMap<string, string>;
  solvers: ReadonlySet<string>;
  examinable: (stageId: string) => boolean;
  examinableThrough: string;
}

export interface PlannedRow extends ItemImportRow {
  /** Present for `create` and `version`: what would be written. */
  fields?: RowFields;
  /** Present for `version`: the row that would be retired. */
  replaces?: ExistingItem;
  source?: string;
}

const SLUG = /^[a-z0-9-]{6,80}$/;

/** The P stem placeholder, identical to sync-items so the two compare equal. */
export function parameterizedStem(solver: string): string {
  return `Parameterized — the stem comes from solver "${solver}".`;
}

/** The authored shape as columns. Same mapping as sync-items. */
export function toRowFields(it: AuthoredItem, stageId: string): RowFields {
  return {
    stageId,
    objectiveId: it.objective,
    type: it.type,
    bloom: it.bloom,
    targetDifficulty: it.difficulty ?? 0.6,
    stemTemplate: it.type === "P" ? parameterizedStem(it.solver ?? "") : (it.stem ?? ""),
    solverRef: it.type === "P" ? (it.solver ?? null) : null,
    correctSpec:
      it.type === "S"
        ? { value: it.correct }
        : it.type === "G"
          ? { order: it.order, ...(it.take ? { take: it.take } : {}) }
          : {},
    distractorPool: it.type === "S" ? (it.distractors ?? []) : [],
    rationale: it.rationale ?? null,
  };
}

/** The columns as the authored shape -- the inverse, used by export. */
export function toAuthored(slug: string, f: RowFields): AuthoredItem {
  const base: AuthoredItem = {
    slug,
    stageId: f.stageId,
    objective: f.objectiveId,
    type: f.type,
    bloom: f.bloom as AuthoredItem["bloom"],
    difficulty: f.targetDifficulty,
  };
  if (f.type === "S") {
    base.stem = f.stemTemplate;
    base.correct = String(f.correctSpec.value ?? "");
    base.distractors = f.distractorPool.map(String);
  } else if (f.type === "G") {
    base.stem = f.stemTemplate;
    base.order = (f.correctSpec.order as string[] | undefined) ?? [];
    if (typeof f.correctSpec.take === "number") base.take = f.correctSpec.take;
  } else {
    base.solver = f.solverRef ?? "";
  }
  if (f.rationale !== null) base.rationale = f.rationale;
  return base;
}

/** Key-order-independent JSON, so `{a,b}` and `{b,a}` compare equal. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function sameContent(a: RowFields, b: RowFields): boolean {
  return (
    a.stageId === b.stageId &&
    a.objectiveId === b.objectiveId &&
    a.type === b.type &&
    a.bloom === b.bloom &&
    Math.round(a.targetDifficulty * 100) === Math.round(b.targetDifficulty * 100) &&
    a.stemTemplate === b.stemTemplate &&
    (a.solverRef ?? null) === (b.solverRef ?? null) &&
    stable(a.correctSpec) === stable(b.correctSpec) &&
    stable(a.distractorPool) === stable(b.distractorPool) &&
    (a.rationale ?? null) === (b.rationale ?? null)
  );
}

/** Every rule an item breaks, in words. Empty means valid. */
function shapeErrors(it: AuthoredItem, stageId: string | null, ctx: PlanContext): string[] {
  const e: string[] = [];
  if (!SLUG.test(it.slug)) e.push("slug must be 6-80 characters of a-z, 0-9 and hyphen");

  if (!stageId) {
    e.push("no stage: give the file a stageId, or each item one");
  } else if (!ctx.examinable(stageId)) {
    e.push(
      `stage ${stageId} is beyond the examinable scope (through ${ctx.examinableThrough})`,
    );
  }

  if (!it.objective) {
    e.push("no objective: it would be invisible to coverage");
  } else {
    const owner = ctx.objectives.get(it.objective) ?? /^(\d{2})\./.exec(it.objective)?.[1];
    if (!ctx.objectives.has(it.objective)) {
      e.push(`objective ${it.objective} does not exist`);
    }
    if (owner && stageId && owner !== stageId) {
      e.push(`objective ${it.objective} belongs to stage ${owner}, not ${stageId}`);
    }
  }

  if (it.type === "S") {
    if (!it.stem || it.stem.trim().length < 10) e.push("S needs a stem of at least 10 characters");
    if (it.correct === undefined || it.correct.trim() === "") {
      e.push("no correct answer: it would grade every student wrong");
    }
    const d = it.distractors ?? [];
    if (d.length < 3) e.push("S needs at least 3 distractors");
    if (it.correct && d.includes(it.correct)) e.push("the correct answer also appears as a distractor");
    if (new Set(d).size !== d.length) e.push("duplicate distractors");
  }
  if (it.type === "P") {
    if (!it.solver) e.push("P needs a solver");
    else if (!ctx.solvers.has(it.solver)) {
      e.push(`unknown solver "${it.solver}": the engine would throw when a student presses Start`);
    }
  }
  if (it.type === "G") {
    if (!it.stem || it.stem.trim().length < 10) e.push("G needs a stem of at least 10 characters");
    const o = it.order ?? [];
    if (o.length < 3) e.push('G needs an "order" of at least 3 steps');
    else if (new Set(o).size !== o.length) e.push('duplicate steps in "order": the ordering would be ambiguous');
  }
  return e;
}

export function planImport(file: ItemFile, ctx: PlanContext): PlannedRow[] {
  const seen = new Set<string>();
  return file.items.map((it): PlannedRow => {
    const stageId = it.stageId ?? file.stageId ?? null;
    const reasons = shapeErrors(it, stageId, ctx);
    if (seen.has(it.slug)) reasons.push("duplicate slug in this file");
    seen.add(it.slug);

    const row = (action: ItemImportAction, extra: Partial<PlannedRow> = {}): PlannedRow => ({
      slug: it.slug,
      stageId,
      action,
      reasons,
      ...extra,
    });

    if (reasons.length > 0 || !stageId) return row("invalid");

    const fields = toRowFields(it, stageId);
    const current = ctx.existing.get(it.slug);

    if (current && sameContent(current.fields, fields)) return row("unchanged");

    // New or changed: it must say where it came from.
    if (!it.source || it.source.trim() === "") {
      reasons.push("no source: every new or changed item cites where it came from");
      return row("invalid");
    }

    if (!current) return row("create", { fields, source: it.source });

    if (current.status === "live") {
      reasons.push(
        "is live. Changing it retires the live version at once, which is a decision for " +
          "the item's own edit page, not an upload",
      );
      return row("refused");
    }
    if (current.status === "retired") {
      reasons.push("is retired. Its family is closed; give the new item its own slug");
      return row("refused");
    }
    return row("version", { fields, replaces: current, source: it.source });
  });
}

export function countActions(rows: readonly ItemImportRow[]): Record<ItemImportAction, number> {
  const c = { create: 0, version: 0, unchanged: 0, refused: 0, invalid: 0 };
  for (const r of rows) c[r.action] += 1;
  return c;
}
