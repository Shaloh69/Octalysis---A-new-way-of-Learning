import { getAccessToken } from "./session";

/**
 * Console API client.
 *
 * Every route here is staff-only ON THE SERVER — `requireStaff()` runs before
 * any query, and RLS denies underneath that. Nothing in this file is a control;
 * it is a typed fetch wrapper. If it disagreed with the server about who may do
 * what, the server would win, which is the correct arrangement.
 *
 * The one shape worth reading twice is `AttemptDetail`: it carries
 * `correctValue`. That is deliberate and staff-only — `ai_after_submit` grants
 * staff the same read at the database level. It must never be imported by
 * apps/web, and `scripts/scan-bundle.mjs` checks the student bundle for exactly
 * these names.
 */

/*
 * 8090, not 8080 — the same fix `apps/web/src/lib/api.ts` carries, and it was
 * missed here on the first pass.
 *
 * 8080 is frequently another project's Adminer on a developer machine. It
 * answers preflight without CORS headers, so every request fails with
 * `net::ERR_FAILED` and the page renders an error that names no port, while the
 * API runs perfectly on 8090.
 *
 * Fixing one app and not the other is worse than fixing neither: the student
 * app worked, the console did not, and the difference looked like a console bug.
 * A deployment always sets `VITE_API_URL`.
 */
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8090";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let code = "internal";
    let message = "Something went wrong. Try again.";
    try {
      const body = (await res.json()) as { error?: { code: string; message: string } };
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      /* non-JSON body; the defaults are already the right shape */
    }
    throw new ApiError(code, message, res.status);
  }
  return (await res.json()) as T;
}

async function requestText(path: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError("internal", "Export failed.", res.status);
  return res.text();
}

/* ---------------------------------------------------------------- types */

export interface RosterRow {
  studentId: string;
  fullName: string;
  status: "unclaimed" | "claimed" | "disabled";
  sectionCode: string | null;
  userId: string | null;
  deactivated: boolean;
  attempts: number;
  avgMastery: number | null;
}

export interface LockStage {
  id: string;
  title: string;
  ordinal: number;
}
export interface LockStudent {
  userId: string;
  studentId: string;
  fullName: string;
}
export interface LockCell {
  userId: string;
  stageId: string;
  unlocked: boolean;
  mastery: number;
  /** null means "auto" — the curriculum policy decides, not a person. */
  override: "locked" | "unlocked" | null;
  reason: string | null;
}
export interface LockMatrix {
  stages: LockStage[];
  students: LockStudent[];
  cells: LockCell[];
  globalLocks: Array<{
    stage_id: string;
    state: string;
    reason: string | null;
    unlock_at: string | null;
    lock_at: string | null;
  }>;
}

export interface StudentDetail {
  student: {
    userId: string;
    studentId: string;
    fullName: string;
    sectionCode: string | null;
    deactivated: boolean;
  };
  attempts: Array<{
    attemptId: string;
    attemptNo: number;
    status: "in_progress" | "submitted" | "abandoned" | "voided";
    score: number | null;
    maxScore: number | null;
    startedAt: string;
    submittedAt: string | null;
    engineVersion: string;
    assessmentTitle: string;
    scope: string;
  }>;
  progress: Array<{
    stageId: string;
    mastery: number;
    bestScore: number | null;
    attempts: number;
    lastSeenAt: string | null;
  }>;
}

/** Staff-only. Carries the answer key — see the note at the top of this file. */
export interface AttemptDetail {
  attemptId: string;
  status: string;
  engineVersion: string;
  items: Array<{
    ordinal: number;
    type: "S" | "P" | "G";
    stageId: string;
    objectiveId: string | null;
    stem: string;
    options: string[];
    resolvedParams: Record<string, unknown> | null;
    correctValue: string;
    rationale: string | null;
    studentAnswer: string | null;
    isCorrect: boolean | null;
    timeMs: number | null;
  }>;
}

export interface AuditEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  at: string;
  actor_name: string | null;
}

export interface InvariantResult {
  id: string;
  name: string;
  severity: "fail" | "warn" | "notice";
  offendingCount: number;
  sample: unknown;
}

export interface RosterImportPlan {
  dryRun: boolean;
  summary: { insert: number; update: number; skipped: number };
  plan?: Array<{
    studentId: string;
    fullName: string;
    action: "insert" | "update" | "skip-claimed";
  }>;
}

export interface ContentStage {
  id: string;
  title: string;
  act: number;
  ordinal: number;
  archetype: "A" | "B" | "C" | "D";
  levels: number[];
  estMinutes: number;
  published: boolean;
  gradeable: boolean;
  blocks: number;
  objectives: number;
  liveItems: number;
  draftItems: number;
  /** `planned` is not a bug -- see the note in pages/ContentPage.tsx. */
  authoring: "authored" | "planned" | "empty";
}

export interface ContentStatus {
  stages: ContentStage[];
  summary: {
    total: number;
    authored: number;
    planned: number;
    empty: number;
    objectives: number;
    liveItems: number;
    itemTarget: number;
  };
}

export interface FeedbackEntry {
  id: string;
  channel: "flag" | "content_report" | "sus" | "csat";
  category: string | null;
  body: string | null;
  rating: number | null;
  route: string | null;
  status: "new" | "triaged" | "in_progress" | "shipped" | "wont_fix";
  severity: string | null;
  susScore: number | null;
  itemId: string | null;
  itemSlug: string | null;
  /** The exact resolved instance the reporter saw. Server-reconstructed. */
  resolvedVariant: unknown;
  reporterName: string | null;
  role: string;
  createdAt: string;
}

export interface BankItem {
  id: string;
  familyId: string;
  slug: string;
  stageId: string;
  objectiveId: string | null;
  objectiveText: string | null;
  type: "S" | "P" | "G";
  status: "draft" | "review" | "live" | "retired";
  version: number;
  bloom: string;
  targetDifficulty: number | null;
  /** The TEMPLATE, with its `{f}` slots. Never a resolved instance. */
  stemTemplate: string;
  solverRef: string | null;
  authorName: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  stats: {
    exposures: number;
    /** Difficulty. HIGH means EASY -- it is the proportion who got it right. */
    pValue: number | null;
    /** Point-biserial. Negative almost always means the key is wrong. */
    discrimination: number | null;
    flagged: boolean;
    flagReason: string | null;
  };
}

/** Staff-only, and it carries the key. See the note at the top of this file. */
export interface ResolvedPreview {
  seed: string;
  item: {
    stem: string;
    options: string[];
    correctValue: string;
    correctIndex: number;
    rationale: string;
    resolvedParams: Record<string, unknown>;
  } | null;
  error?: string;
}

export interface Submission {
  id: string;
  kind: "lab" | "project" | "participation";
  stageId: string | null;
  slug: string;
  title: string;
  bodyMd: string;
  attachments: Array<{ name: string; path: string }>;
  payload: Record<string, unknown>;
  status: "draft" | "submitted" | "returned" | "graded" | "voided";
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  rubric: Record<string, unknown>;
  feedbackMd: string | null;
  gradedAt: string | null;
  dueAt: string | null;
  /** A FACT, not a penalty. Whether it costs marks is the grader's call. */
  isLate: boolean;
  studentName: string;
  studentId: string;
  graderName: string | null;
}

export interface LiveSnapshot {
  cohort: number;
  /** True when the cohort is too small for an aggregate to stay anonymous. */
  suppressed: boolean;
  minCohort: number;
  stages: Array<{ stageId: string; students: number; avgMastery: number }>;
  spread: Array<{ ordinal: number; answered: number; correct: number }>;
  at: string;
}

export interface Blueprint {
  id: string;
  name: string;
  scope: "stage" | "final";
  stageId: string | null;
  totalItems: number;
  constraints: Record<string, unknown>;
}

export interface Assessment {
  id: string;
  title: string;
  attemptsAllowed: number;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  blueprintId: string;
  blueprintName: string;
  scope: "stage" | "final";
  stageId: string | null;
  totalItems: number;
  sectionCode: string | null;
  attempts: number;
  submitted: number;
}

/** Asked BEFORE an assessment is created -- see pages/AssessmentsPage.tsx. */
export interface Feasibility {
  blueprintId: string;
  name: string;
  totalItems: number;
  poolSize: number;
  enoughItems: boolean;
  shortfalls: Array<{ dimension: string; cell: string; need: number; have: number }>;
  satisfiable: boolean;
}

export interface SetLockInput {
  scope: "global" | "section" | "user";
  stageId: string;
  state: "locked" | "unlocked" | "auto";
  userId?: string;
  sectionId?: string;
  /** Required by the server, min 3 chars. INV-22 enforces it in the database. */
  reason: string;
  unlockAt?: string;
  lockAt?: string;
}

/* --------------------------------------------------------------- client */

export const api = {
  roster: () => request<{ students: RosterRow[] }>("/api/v1/console/roster"),

  importRoster: (input: {
    sectionCode: string;
    term: string;
    rows: Array<{ studentId: string; fullName: string }>;
    apply: boolean;
  }) =>
    request<RosterImportPlan>("/api/v1/console/roster/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  locks: () => request<LockMatrix>("/api/v1/console/locks"),

  setLock: (input: SetLockInput) =>
    request<{ ok: true }>("/api/v1/console/locks", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  student: (userId: string) =>
    request<StudentDetail>(`/api/v1/console/students/${encodeURIComponent(userId)}`),

  attempt: (attemptId: string) =>
    request<AttemptDetail>(`/api/v1/console/attempts/${encodeURIComponent(attemptId)}`),

  audit: (limit = 100) =>
    request<{ entries: AuditEntry[] }>(`/api/v1/console/audit?limit=${limit}`),

  systemAudit: () =>
    request<{ results: InvariantResult[]; failing: number; ranAt: string }>(
      "/api/v1/console/audit/system",
    ),

  gradebookCsv: () => requestText("/api/v1/console/gradebook.csv"),

  stages: () =>
    request<{
      nodes: Array<{ id: string; title: string; ordinal: number; act: number; gradeable: boolean }>;
    }>("/api/v1/stages"),

  content: () => request<ContentStatus>("/api/v1/console/content"),

  feedback: (status?: string) =>
    request<{ entries: FeedbackEntry[]; sus: { mean: number | null; n: number } }>(
      `/api/v1/console/feedback${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),

  triageFeedback: (id: string, input: { status: string; severity?: string; releasedIn?: string }) =>
    request<{ ok: true }>(`/api/v1/console/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  items: (filter: { stageId?: string | null; status?: string | null; flagged?: string | null }) => {
    const q = new URLSearchParams();
    if (filter.stageId) q.set("stageId", filter.stageId);
    if (filter.status) q.set("status", filter.status);
    if (filter.flagged) q.set("flagged", filter.flagged);
    const qs = q.toString();
    return request<{ items: BankItem[]; summary: Record<string, number> }>(
      `/api/v1/console/items${qs ? `?${qs}` : ""}`,
    );
  },

  previewItem: (id: string, seed: string) =>
    request<ResolvedPreview>(
      `/api/v1/console/items/${encodeURIComponent(id)}/preview?seed=${encodeURIComponent(seed)}`,
    ),

  /** Lecture Mode. Carries NO name, student id, or user id -- by construction. */
  live: () => request<LiveSnapshot>("/api/v1/console/live"),

  assessments: () =>
    request<{ assessments: Assessment[]; blueprints: Blueprint[] }>(
      "/api/v1/console/assessments",
    ),

  blueprintFeasibility: (id: string) =>
    request<Feasibility>(
      `/api/v1/console/blueprints/${encodeURIComponent(id)}/feasibility`,
    ),

  createAssessment: (input: {
    blueprintId: string;
    title: string;
    attemptsAllowed: number;
    sectionId?: string | null;
    opensAt?: string;
    closesAt?: string;
  }) =>
    request<{ id: string }>("/api/v1/console/assessments", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  submissions: (status?: string) =>
    request<{ submissions: Submission[]; summary: Record<string, number> }>(
      `/api/v1/console/submissions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),

  gradeSubmission: (
    id: string,
    input: {
      score: number;
      maxScore: number;
      rubric?: Record<string, unknown> | undefined;
      feedbackMd?: string | undefined;
    },
  ) =>
    request<{ ok: true }>(`/api/v1/console/submissions/${encodeURIComponent(id)}/grade`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** The ONLY way a graded submission becomes editable again. Reason required. */
  returnSubmission: (id: string, reason: string) =>
    request<{ ok: true }>(`/api/v1/console/submissions/${encodeURIComponent(id)}/return`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  /**
   * The exam window, after creation.
   *
   * `undefined` leaves a field alone; `null` clears that bound. The two must
   * stay distinguishable, because extending an exam indefinitely and not
   * mentioning the date are different intentions.
   */
  setAssessmentWindow: (
    id: string,
    body: {
      opensAt?: string | null;
      closesAt?: string | null;
      attemptsAllowed?: number;
      reason: string;
    },
  ) =>
    request<{ ok: true }>(`/api/v1/console/assessments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  setItemStatus: (
    id: string,
    status: string,
    opts: { reason?: string; selfApproved?: boolean } = {},
  ) =>
    request<{ ok: true; status: string }>(
      `/api/v1/console/items/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: JSON.stringify({ status, ...opts }) },
    ),
};
