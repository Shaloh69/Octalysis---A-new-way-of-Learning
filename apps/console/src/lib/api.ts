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

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

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
  /** `scaffold` is not a bug -- see the note in pages/ContentPage.tsx. */
  authoring: "authored" | "scaffold" | "empty";
}

export interface ContentStatus {
  stages: ContentStage[];
  summary: {
    total: number;
    authored: number;
    scaffold: number;
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
};
