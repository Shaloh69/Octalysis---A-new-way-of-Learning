import type { APIRequestContext } from "@playwright/test";

/**
 * The /students/:userId fixture: the REAL student response, patched with the
 * attempts the seed does not have. Same pattern as `_students-fixture.ts` and
 * `_locks-fixture.ts`: the layout is tested on real data, and only the states
 * the seed lacks are added.
 *
 * WHY THE ATTEMPTS ARE ADDED. The seed has none, and locally none can be
 * made: all 96 act-1 items sit at `review`, the engine samples only `live`,
 * so every Start fails to fill (27 Sep 2026). `console-student-detail.spec.ts`'
 * original test starts a real attempt through the API and SKIPS when it
 * cannot, which on this stack is always.
 *
 * WHY THE PAPERS ARE STILL REAL. Each paper is assembled from real bank items
 * resolved by the real engine, through `/items`' preview endpoint (the same
 * `resolveItem()` a paper uses, with a seed). The stems, options, keys and
 * rationales are the bank's own; only the attempt around them is invented.
 * That a paper regenerates byte for byte from its stored seed is proven where
 * it can be, in `services/api/test/console.spec.ts`.
 *
 * Seeded fixture names only. Not a spec: the leading underscore keeps
 * Playwright from collecting it.
 */

export const STUDENT_SUB = "dddddddd-1111-4000-8000-000000000006";
export const STUDENT_ID = "232129006";

export type AttemptStatus = "in_progress" | "submitted" | "abandoned" | "voided";

export interface DetailAttempt {
  attemptId: string; attemptNo: number; status: AttemptStatus;
  score: number | null; maxScore: number | null;
  startedAt: string; submittedAt: string | null;
  engineVersion: string; assessmentTitle: string; scope: string;
}
export interface StudentDetail {
  student: {
    userId: string; studentId: string; fullName: string;
    sectionId?: string | null; sectionCode: string | null;
    claimedAt?: string | null; deactivated: boolean;
  };
  sections?: Array<{ id: string; code: string; term: string }>;
  attempts: DetailAttempt[];
  progress: Array<{ stageId: string; mastery: number; bestScore: number | null; attempts: number; lastSeenAt: string | null }>;
}
export interface PaperItem {
  ordinal: number; type: "S" | "P" | "G"; stageId: string; objectiveId: string | null;
  stem: string; options: string[]; resolvedParams: Record<string, unknown> | null;
  correctValue: string; rationale: string | null;
  studentAnswer: string | null; isCorrect: boolean | null; timeMs: number | null;
}
export interface Paper { attemptId: string; status: string; engineVersion: string; items: PaperItem[] }

/** Valid uuids, so nothing on the page trips over their shape. */
export const ATTEMPT = {
  submitted: "a77e0000-0000-4000-8000-000000000001",
  inProgress: "a77e0000-0000-4000-8000-000000000002",
  voided: "a77e0000-0000-4000-8000-000000000003",
  abandoned: "a77e0000-0000-4000-8000-000000000004",
};

/** The section the fixture adds, so a move has somewhere to go. Every write is intercepted. */
export const SECOND_SECTION = { id: "5ec7f1a0-0000-4000-8000-0000000004b0", code: "BSCPE - 4B", term: "2026-2027 First Semester" };

const at = (d: string) => new Date(`2026-09-${d}Z`).toISOString();

export const ATTEMPTS: DetailAttempt[] = [
  { attemptId: ATTEMPT.inProgress, attemptNo: 1, status: "in_progress", score: null, maxScore: null,
    startedAt: at("27T09:10:00"), submittedAt: null, engineVersion: "1.0.0",
    assessmentTitle: "Stage 02 Check", scope: "stage" },
  { attemptId: ATTEMPT.submitted, attemptNo: 2, status: "submitted", score: 5, maxScore: 8,
    startedAt: at("24T08:00:00"), submittedAt: at("24T08:14:32"), engineVersion: "1.0.0",
    assessmentTitle: "Stage 01 Check", scope: "stage" },
  { attemptId: ATTEMPT.voided, attemptNo: 1, status: "voided", score: 3, maxScore: 8,
    startedAt: at("22T13:00:00"), submittedAt: at("22T13:21:05"), engineVersion: "1.0.0",
    assessmentTitle: "Stage 01 Check", scope: "stage" },
  { attemptId: ATTEMPT.abandoned, attemptNo: 1, status: "abandoned", score: null, maxScore: null,
    startedAt: at("20T10:30:00"), submittedAt: null, engineVersion: "1.0.0",
    assessmentTitle: "Prelim Examination", scope: "final" },
];

export function patchDetail(d: StudentDetail, opts: { deactivated?: boolean; attempts?: DetailAttempt[] } = {}): StudentDetail {
  d.attempts = [...(opts.attempts ?? ATTEMPTS), ...d.attempts];
  if (opts.deactivated) d.student.deactivated = true;
  if (d.sections && !d.sections.some((s) => s.id === SECOND_SECTION.id)) d.sections = [...d.sections, SECOND_SECTION];
  return d;
}

/**
 * Real resolved items, one of each type the bank has plus enough singles to
 * make an eight-question paper. Resolved once per worker and reused.
 */
let resolved: Omit<PaperItem, "ordinal" | "studentAnswer" | "isCorrect" | "timeMs">[] | null = null;

export async function realItems(
  request: APIRequestContext, api: string, token: string,
): Promise<NonNullable<typeof resolved>> {
  if (resolved) return resolved;
  const auth = { Authorization: `Bearer ${token}` };
  const bank = (await (await request.get(`${api}/api/v1/console/items`, { headers: auth })).json()) as {
    items: Array<{ id: string; type: "S" | "P" | "G"; stageId: string }>;
  };
  const act1 = bank.items.filter((i) => ["01", "02"].includes(i.stageId));
  // A G and two Ps first, so every layout an item can take is on the page.
  const pick = [
    ...act1.filter((i) => i.type === "G").slice(0, 1),
    ...act1.filter((i) => i.type === "P").slice(0, 2),
    ...act1.filter((i) => i.type === "S").slice(0, 5),
  ];
  const out: NonNullable<typeof resolved> = [];
  for (const [n, it] of pick.entries()) {
    const res = await request.get(`${api}/api/v1/console/items/${it.id}/preview?seed=fixture-${n}`, { headers: auth });
    const body = (await res.json()) as { item: (PaperItem & { correctIndex?: number }) | null };
    if (!body.item) continue;
    const i = body.item;
    out.push({
      type: i.type, stageId: i.stageId, objectiveId: i.objectiveId, stem: i.stem, options: i.options,
      resolvedParams: i.resolvedParams, correctValue: i.correctValue, rationale: i.rationale,
    });
  }
  if (out.length < 4) throw new Error(`the bank resolved only ${out.length} items; is the seed loaded?`);
  resolved = out;
  return out;
}

/**
 * One paper per fixture attempt. Answers alternate right and wrong so both
 * verdicts are on the page; the in-progress and abandoned papers stop half way.
 */
export function papersFrom(items: NonNullable<typeof resolved>): Record<string, Paper> {
  const wrong = (i: (typeof items)[number]) =>
    i.type === "G" ? [...i.correctValue.split(" | ")].reverse().join(" | ") : i.options.find((o) => o !== i.correctValue) ?? "0";
  const build = (attemptId: string, status: string, answered: number, rightEvery: number): Paper => ({
    attemptId, status, engineVersion: "1.0.0",
    items: items.map((i, n) => {
      const has = n < answered;
      const right = has && n % rightEvery === 0;
      return {
        ...i, ordinal: n + 1,
        studentAnswer: has ? (right ? i.correctValue : wrong(i)) : null,
        isCorrect: has ? right : null,
        timeMs: has ? 31_000 + n * 7_250 : null,
      };
    }),
  });
  return {
    [ATTEMPT.submitted]: build(ATTEMPT.submitted, "submitted", items.length - 1, 2),
    [ATTEMPT.inProgress]: build(ATTEMPT.inProgress, "in_progress", 3, 2),
    [ATTEMPT.voided]: build(ATTEMPT.voided, "voided", items.length, 3),
    [ATTEMPT.abandoned]: build(ATTEMPT.abandoned, "abandoned", 2, 2),
  };
}
