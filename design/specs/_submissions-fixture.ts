import type { Page, Route } from "@playwright/test";

/**
 * The /submissions fixture: the REAL queue, patched with the states the seed
 * does not have. Same pattern as `_assessments-fixture.ts`: the layout is
 * tested on real rows, and only what the seed lacks is added.
 *
 * WHAT IS REAL. All 61 rows, every name, student ID, deliverable, date and
 * score come from the running API. The seed has 21 to mark, 30 graded (out of
 * 100, with an empty rubric) and 10 drafts, whose bodies the API withholds.
 *
 * WHAT IS ADDED, keyed by student ID + deliverable (row ids are regenerated
 * by every reset):
 *
 *   232129002 lab-07   late          handed in 27 hours after it was due
 *   232129008 lab-07   attachments   a file and two recorded values
 *   232129010 lab-05   returned      a mark taken back, with its reason
 *   232129002 lab-03   graded lab    band 3 of 4, with feedback and a grader
 *   232129017 lab-03   participation re-kinded, so the menu has three kinds
 *
 * EVERY WRITE IS INTERCEPTED. Grading and returning are writes to 40% of the
 * grade; no spec may make one. An intercepted write is applied to the next
 * list the page fetches, so save-and-advance is tested on the queue it
 * produces. `fail` makes a write refuse, for the error paths.
 *
 * Seeded fixture names only. Not a spec: the leading underscore keeps
 * Playwright from collecting it.
 */

export interface Sub {
  id: string; kind: "lab" | "project" | "participation"; stageId: string | null;
  slug: string; title: string; bodyMd: string | null;
  attachments: Array<{ name: string; path: string }>; payload: Record<string, unknown>;
  status: "draft" | "submitted" | "returned" | "graded" | "voided";
  submittedAt: string | null; score: number | null; maxScore: number | null;
  rubric: Record<string, unknown>; feedbackMd: string | null; gradedAt: string | null;
  dueAt: string | null; isLate: boolean; studentName: string; studentId: string; graderName: string | null;
}
export interface List { submissions: Sub[]; summary: Record<string, number> }

export const FIX = {
  late: { studentId: "232129002", slug: "lab-07", name: "Maria Angelica Bacaltos" },
  files: { studentId: "232129008", slug: "lab-07", name: "Reymart Pahayahay" },
  returned: { studentId: "232129010", slug: "lab-05", name: "Bea Katrina Enriquez" },
  banded: { studentId: "232129002", slug: "lab-03", name: "Maria Angelica Bacaltos" },
  participation: { studentId: "232129017", slug: "participation-prelim", name: "Jerome Tumulak" },
  /** Real and untouched: a project waiting for a stated score. */
  project: { studentId: "232129005", slug: "final-project", name: "Rafael Antonio Abellana" },
  /** Real and untouched: a draft, whose body the API withholds. */
  draft: { studentId: "232129007", slug: "lab-03", name: "Emmanuel Diaz" },
  /** Real and untouched: a graded row out of 100, rubric empty. */
  graded: { studentId: "232129013", slug: "lab-07", name: "Christian Dave Baguio" },
} as const;

export const RETURN_REASON = "Band applied to the wrong part; re-marking after the rework.";
const HOUR = 3_600_000;

export function patch(list: List): List {
  const by = (studentId: string, slug: string) =>
    list.submissions.find((s) => s.studentId === studentId && s.slug === slug);

  const late = by(FIX.late.studentId, FIX.late.slug);
  if (late?.submittedAt) {
    late.dueAt = new Date(new Date(late.submittedAt).getTime() - 27 * HOUR).toISOString();
    late.isLate = true;
  }
  const files = by(FIX.files.studentId, FIX.files.slug);
  if (files) {
    files.attachments = [{ name: "trace-table.png", path: "labs/232129008/lab-07/trace-table.png" }];
    files.payload = { cycles: 14, stalls: 2 };
  }
  const ret = by(FIX.returned.studentId, FIX.returned.slug);
  if (ret) { ret.status = "returned"; ret.feedbackMd = RETURN_REASON; }
  const banded = by(FIX.banded.studentId, FIX.banded.slug);
  if (banded) {
    banded.score = 3; banded.maxScore = 4;
    banded.rubric = { band: 3, criterion: "Correct and complete; reasoning thin or missing" };
    banded.feedbackMd = "The trace is right. Say why the fetch stalls on the third instruction.";
    banded.graderName = banded.graderName ?? "Prof. Amalia R. Bontuyan";
  }
  const part = by(FIX.participation.studentId, "lab-03");
  if (part) {
    part.kind = "participation"; part.slug = FIX.participation.slug; part.stageId = null;
    part.title = "Class participation — Prelim";
  }
  const n = (st: string) => list.submissions.filter((s) => s.status === st).length;
  list.summary = { submitted: n("submitted"), returned: n("returned"), graded: n("graded"), draft: n("draft") };
  return list;
}

export interface Writes {
  grade: Array<{ id: string; body: { score: number; maxScore: number; rubric?: Record<string, unknown>; feedbackMd?: string } }>;
  ret: Array<{ id: string; body: { reason: string } }>;
}

export async function useFixture(
  page: Page,
  opts: { fail?: "grade" | "return"; delayMs?: number; listStatus?: number } = {},
): Promise<{ writes: Writes; list: () => List | null }> {
  const writes: Writes = { grade: [], ret: [] };
  let last: List | null = null;

  await page.route("**/api/v1/console/submissions*", async (route: Route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.listStatus && opts.listStatus >= 400) {
      return route.fulfill({ status: opts.listStatus, json: { error: { code: "internal", message: "The database did not answer." } } });
    }
    const res = await route.fetch();
    const list = patch((await res.json()) as List);
    // Replay what the spec "wrote", so the page sees the queue it produced.
    for (const g of writes.grade) {
      const s = list.submissions.find((x) => x.id === g.id);
      if (s) {
        Object.assign(s, {
          status: "graded", score: g.body.score, maxScore: g.body.maxScore, rubric: g.body.rubric ?? {},
          feedbackMd: g.body.feedbackMd ?? s.feedbackMd, graderName: "Prof. Amalia R. Bontuyan",
          gradedAt: new Date().toISOString(),
        });
      }
    }
    for (const r of writes.ret) {
      const s = list.submissions.find((x) => x.id === r.id);
      if (s) Object.assign(s, { status: "returned", feedbackMd: r.body.reason });
    }
    if (writes.grade.length || writes.ret.length) patchSummary(list);
    last = list;
    return route.fulfill({ response: res, json: list });
  });

  await page.route("**/api/v1/console/submissions/*/grade", async (route: Route) => {
    const id = route.request().url().split("/").slice(-2)[0]!;
    if (opts.fail === "grade") {
      return route.fulfill({ status: 409, json: { error: { code: "conflict", message: "This has already been marked. To change the mark, return it first, with a reason." } } });
    }
    writes.grade.push({ id, body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.route("**/api/v1/console/submissions/*/return", async (route: Route) => {
    const id = route.request().url().split("/").slice(-2)[0]!;
    if (opts.fail === "return") {
      return route.fulfill({ status: 409, json: { error: { code: "conflict", message: "Only a graded submission can be returned. This one has not been marked." } } });
    }
    writes.ret.push({ id, body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, json: { ok: true } });
  });

  return { writes, list: () => last };
}

function patchSummary(list: List): void {
  const n = (st: string) => list.submissions.filter((s) => s.status === st).length;
  list.summary = { submitted: n("submitted"), returned: n("returned"), graded: n("graded"), draft: n("draft") };
}
