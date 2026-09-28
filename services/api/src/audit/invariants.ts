import type { InvariantArea, InvariantResult } from "@octa/contracts";

/**
 * `/system`: what each invariant is FOR, and when one is only a notice.
 *
 * Rebuilt 28 Sep 2026 on two instructor rulings:
 *
 *  1. Every check says what it checks, what it protects and what to do, from
 *     this one catalogue. `test/console.spec.ts` fails if `run_invariants()`
 *     returns an id that is not here, so a new invariant cannot ship without
 *     saying what it is.
 *  2. A check is a NOTICE only when the table it reads is truly empty. Before,
 *     INV-18/27/28/29 were notices whenever they had offenders, which filed
 *     "the Prelim has 0 of 40 live items" under "nothing yet to check".
 *
 * Drafted from each function's SQL and comments in `db/addendum-audit.sql`
 * and `db/addendum-submissions.sql`. An action names the console page that
 * fixes what the check finds; this page never fixes anything itself.
 */

export interface CatalogueEntry {
  area: InvariantArea;
  title: string;
  checks: string;
  protects: string;
  action: string;
}

export const INVARIANT_CATALOGUE: Readonly<Record<string, CatalogueEntry>> = {
  "INV-01": {
    area: "security",
    title: "Every table has row-level security on",
    checks: "Every table in the public schema has row-level security enabled.",
    protects: "Without it, any signed-in student could read or write the whole table through Supabase directly, answer keys included.",
    action: "Enable RLS on the table named below in the schema, add its policies and a denial test. Schema work; nothing on the console changes this.",
  },
  "INV-02": {
    area: "security",
    title: "Every protected table has a policy",
    checks: "Every table with row-level security on has at least one policy.",
    protects: "A table with RLS and no policy refuses everyone, so the pages that read it silently show nothing.",
    action: "Add the missing policy in the schema, with a test proving the wrong user is still blocked. Schema work.",
  },
  "INV-03": {
    area: "security",
    title: "Privileged functions pin their search path",
    checks: "Every SECURITY DEFINER function in the public schema sets its own search_path.",
    protects: "A definer function runs with its owner's rights; without a pinned search_path a caller could substitute a table it reads and run as the owner.",
    action: "Add `set search_path = public` to the function named below. Schema work.",
  },
  "INV-05": {
    area: "accounts",
    title: "Every student account matches a claimed roster row",
    checks: "Every account with a student ID points at a roster row, and that row is marked claimed.",
    protects: "An account whose ID is not on the roster, or not claimed, is a student the course cannot place in a section or grade.",
    action: "Look the student ID up on Students: import the missing roster row, or correct the ID that was entered.",
  },
  "INV-06": {
    area: "accounts",
    title: "Every claimed roster row has an account",
    checks: "Every roster row marked claimed has an account carrying its student ID.",
    protects: "A claimed row with no account locks the real student out: their ID reads as taken and they cannot claim it.",
    action: "Find the student ID on Students. The claim has to be corrected by staff before that student can sign in.",
  },
  "INV-07": {
    area: "accounts",
    title: "No student ID belongs to two accounts",
    checks: "No student ID appears on more than one account.",
    protects: "Two accounts with one ID split one student's attempts, marks and locks between them.",
    action: "Find the ID on Students, decide which account is the student's, and deactivate the other.",
  },
  "INV-09": {
    area: "papers",
    title: "Every answer belongs to a question on its paper",
    checks: "Every recorded answer points at a question the attempt actually drew.",
    protects: "An answer with no question cannot be graded, and means a paper changed after it was issued.",
    action: "Report the attempt below as a grading-service defect. Corrections void an attempt; they never edit history.",
  },
  "INV-10": {
    area: "papers",
    title: "No answer arrived after a paper was handed in",
    checks: "No answer is timestamped after its attempt was submitted.",
    protects: "An answer recorded after hand-in means work was accepted past the end of the paper, and the score may include it.",
    action: "Report the attempt below as a grading-service defect. Corrections void an attempt; they never edit history.",
  },
  "INV-11": {
    area: "papers",
    title: "Every handed-in paper has a score",
    checks: "Every attempt marked submitted has a score.",
    protects: "A submitted paper without a score looks finished everywhere and adds nothing to the gradebook.",
    action: "Report the attempt below as a grading-service defect. A score is never typed in by hand.",
  },
  "INV-12": {
    area: "papers",
    title: "Every paper has as many questions as its blueprint",
    checks: "Every attempt holds exactly the number of questions its blueprint's total asks for.",
    protects: "A short or long paper is not equivalent to its classmates' papers, which is the promise the engine makes.",
    action: "Report the attempt below, and check on Assessments whether its blueprint's total changed after papers were issued.",
  },
  "INV-13": {
    area: "papers",
    title: "Every question on a paper still exists",
    checks: "Every item a paper drew still exists as a row.",
    protects: "Items are versioned, never deleted; a paper pointing at a missing row cannot be regenerated or reviewed.",
    action: "Restore the missing item version from the item files. An item row is retired, never deleted.",
  },
  "INV-30": {
    area: "papers",
    title: "No paper drew from an ungraded stage",
    checks: "No attempt sampled an item from a stage marked not gradeable.",
    protects: "Orientation and other ungraded stages must never count toward a mark.",
    action: "Report the attempt below, and check on Items which items are attached to the stage named.",
  },
  "INV-31": {
    area: "papers",
    title: "Every marked submission has a score, a maximum and a marker",
    checks: "Every lab, project or participation row marked graded records its score, its maximum and who marked it.",
    protects: "Submissions are 40% of the grade; a mark with no score looks finished and adds nothing.",
    action: "Open it on Submissions and return it to be marked again. A graded mark is never edited in place.",
  },
  "INV-15": {
    area: "bank",
    title: "Every live item was reviewed",
    checks: "Every live item records who reviewed it.",
    protects: "Only reviewed items may reach a student's paper; an unreviewed live item skipped the review.",
    action: "Open the item on Items and review it, or send it back.",
  },
  "INV-16": {
    area: "bank",
    title: "Every live multiple-choice item has three wrong answers",
    checks: "Every live type-S item has at least three distractors in its pool.",
    protects: "The engine draws three distractors for a four-option question; with fewer, Start fails for the student who draws it.",
    action: "Open the item on Items: add distractors in its source file and import a new version, or send it back.",
  },
  "INV-17": {
    area: "bank",
    title: "Every live computed item names its solver",
    checks: "Every live type-P item carries a solver reference.",
    protects: "A computed item is generated by its solver; without one, Start fails for the student who draws it.",
    action: "Open the item on Items: name its solver in its source file and import a new version, or send it back.",
  },
  "INV-18": {
    area: "bank",
    title: "Every assessment can be filled from the live bank",
    checks: "For each assessment, every act its blueprint draws from has at least three times as many live items as it needs.",
    protects: "If the live bank cannot fill a blueprint, a student pressing Start gets an error instead of a paper; the headroom keeps papers different from each other.",
    action: "Review and approve items for the act named below on Items. Assessments shows each blueprint's shortfall.",
  },
  "INV-19": {
    area: "curriculum",
    title: "Every prerequisite names a real stage",
    checks: "Every stage listed as a prerequisite exists.",
    protects: "The skill tree is the curriculum; a prerequisite that does not exist is a lock no student can ever open.",
    action: "Correct the stage's prerequisites in its content file and sync.",
  },
  "INV-20": {
    area: "curriculum",
    title: "No stage depends on itself through a loop",
    checks: "Following prerequisites from any stage never leads back to that stage.",
    protects: "A loop in the prerequisites locks every stage in it for good.",
    action: "Break the loop in the content files' prerequisite lists and sync.",
  },
  "INV-32": {
    area: "curriculum",
    title: "Every published stage can be reached",
    checks: "Every published stage can be reached by following prerequisites from a stage that has none.",
    protects: "An unreachable stage is a planet the map draws and no student can ever arrive at.",
    action: "Fix the stage's prerequisites in its content file, or unpublish it, and sync.",
  },
  "INV-33": {
    area: "curriculum",
    title: "Every prerequisite points at a published stage",
    checks: "No published stage requires an unpublished stage, or itself.",
    protects: "A prerequisite on an unpublished stage is an arrow into empty space and a lock no student can satisfy.",
    action: "Publish the prerequisite, or remove it from the stage's list, and sync.",
  },
  "INV-28": {
    area: "curriculum",
    title: "Every graded stage has fully tagged objectives",
    checks: "Every published, graded stage has objectives, and each objective has a level and a competency.",
    protects: "Mastery and the competency grid are counted by objective; an untagged objective counts toward nothing.",
    action: "Add the missing objective, level or competency in the stage's content file and sync.",
  },
  "INV-29": {
    area: "curriculum",
    title: "Every competency cell can be earned",
    checks: "Each of the 21 level-and-competency cells has an objective on a published, graded stage.",
    protects: "A cell with no objective can never be completed, so no student can finish the grid.",
    action: "A cell that stays empty once every stage is published needs an objective tagged to it in the content files.",
  },
  "INV-22": {
    area: "content",
    title: "Every lock override says why",
    checks: "Every stage lock opened or closed by hand carries a reason.",
    protects: "An override with no reason cannot be explained when a student asks why a stage opened for someone else.",
    action: "Open the stage on Locks and set the override again with a reason, or return it to automatic.",
  },
  "INV-23": {
    area: "content",
    title: "Every content block belongs to a stage",
    checks: "Every content block names a stage that exists.",
    protects: "A block for a missing stage is reading no student can reach.",
    action: "Correct the block's stage in the content files and sync. Content shows what each stage holds.",
  },
  "INV-27": {
    area: "content",
    title: "Every stage has the block its lesson is built on",
    checks: "Every published stage has a block of the kind its archetype needs: a simulator for D, code for C, prose for A and B.",
    protects: "A simulator stage with no simulator, or a code stage with no listing, is missing the beat the lesson is built around.",
    action: "Author the missing block for the stage named below. Content shows each stage's blocks.",
  },
  "INV-24": {
    area: "feedback",
    title: "Every usability survey is well formed",
    checks: "Every SUS response has ten answers from 1 to 5, and the score those answers compute to.",
    protects: "A malformed survey skews the usability score reported as project evidence.",
    action: "Look at the response on Feedback. A survey answer is not edited.",
  },
  "INV-25": {
    area: "feedback",
    title: "Every question report names the exact question",
    checks: "Every content report carries the item and the exact variant the student saw.",
    protects: "Without the variant, a report of a wrong answer cannot be reproduced, so it cannot be fixed or dismissed fairly.",
    action: "Open the report on Feedback. A report without its variant came from a path that did not attach it: report that as a defect.",
  },
};

/** Which of the tables the four bank-and-curriculum checks read are empty. */
export interface Emptiness {
  items: boolean;
  contentBlocks: boolean;
  objectives: boolean;
}

/** The only checks that may be notices, each with the table that makes it one. */
const NOTICE_WHEN_EMPTY: Readonly<Record<string, { table: keyof Emptiness; reason: string }>> = {
  "INV-18": {
    table: "items",
    reason: "The item bank has no items at all yet, so no assessment can be filled. Expected until the bank is imported.",
  },
  "INV-27": {
    table: "contentBlocks",
    reason: "No content blocks exist yet, so every stage lacks its blocks. Expected until content is synced.",
  },
  "INV-28": {
    table: "objectives",
    reason: "No objectives exist yet. Expected until the curriculum is synced.",
  },
  "INV-29": {
    table: "objectives",
    reason: "No objectives exist yet, so no cell can be reached. Expected until the curriculum is synced.",
  },
};

/** One row of `run_invariants()`, as `pg` returns it (`bigint` arrives as a string). */
export interface InvariantRow {
  id: string;
  name: string;
  severity: string;
  offending_count: string | number;
  sample: unknown;
}

export function presentInvariant(r: InvariantRow, empty: Emptiness): InvariantResult {
  const offendingCount = Number(r.offending_count);
  const dbSeverity = r.severity === "warn" ? "warn" : "fail";
  const rule = NOTICE_WHEN_EMPTY[r.id];
  const notice = rule !== undefined && offendingCount > 0 && empty[rule.table];
  const entry: CatalogueEntry = INVARIANT_CATALOGUE[r.id] ?? {
    area: "security",
    title: r.name,
    checks: `${r.name}() returns the rows that break its rule.`,
    protects: "Not described yet: add this check to services/api/src/audit/invariants.ts.",
    action: "Read the function in the db/ files to see what it expects.",
  };
  return {
    id: r.id,
    name: r.name,
    severity: notice ? "notice" : dbSeverity,
    dbSeverity,
    offendingCount,
    sample: Array.isArray(r.sample) ? (r.sample as Array<Record<string, unknown>>) : [],
    ...entry,
    noticeReason: notice ? rule.reason : null,
  };
}

/**
 * A nightly run, from the results it stored. Counted by each result's own
 * severity, never from `audit_runs.passed`: `run_invariants_nightly()` leaves
 * INV-18/27/28/29 out of `passed` unconditionally (`addendum-cron.sql`), which
 * the page's "only when empty" ruling does not.
 */
export function summariseRun(results: unknown): { failing: string[]; warning: string[]; checks: number } {
  if (!Array.isArray(results)) return { failing: [], warning: [], checks: 0 };
  const failing: string[] = [];
  const warning: string[] = [];
  for (const r of results as Array<{ id?: unknown; severity?: unknown; offending_count?: unknown }>) {
    if (typeof r?.id !== "string" || Number(r.offending_count) <= 0) continue;
    if (r.severity === "fail") failing.push(r.id);
    else if (r.severity === "warn") warning.push(r.id);
  }
  return { failing, warning, checks: results.length };
}
