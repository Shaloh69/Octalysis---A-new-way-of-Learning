import type {
  AuditPage, Gradebook, ItemBulkStatusRequest, ItemBulkStatusResult, ItemExportRequest, ItemFile,
  ItemImportRequest, ItemImportResult,
  SystemAudit, FeedbackBulkTriage, FeedbackQueue,
  LiveOptions, LiveSession, LiveSnapshot, LiveStartBody,
  ChatAttachments, ChatMessage, ChatRoom, ChatRooms, ChatThread, ChatUnread, ChatUpload,
  ClassAssignBody, ClassUpdateBody, TeacherClaimBody, TeacherDetail, TeacherImportBody,
  TeacherStatusBody, TeachersResponse, ProgressResponse,
  BookCreateBody, BookDefaultBody, BookUpdateBody, StudioSubjectsResponse, SubjectCreateBody, SubjectRenameBody,
  WorkingCopy, WorkingCopyPublishBody, WorkingCopyPutBody,
  MoonAddBody, MoonPendingBody, MoonsPublishBody, MoonsPublishResult, StudioMoonsResponse,
  Avatar, Profile,
} from "@octa/contracts";
import { studentAnswerText } from "./record-view";
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

/**
 * Wake the API. `true` once it answers, `false` if it never does.
 *
 * Approved by the instructor 25 Sep 2026. Render's free tier sleeps when idle
 * and takes ~50s to start, and signing in goes to Supabase -- not to this API
 * -- so a teacher could sign in in ten seconds and then sit on /locks waiting
 * for a server nobody had asked to start. The gate pages call this on arrival,
 * so the wake overlaps the typing.
 *
 * `/healthz` on purpose: it touches no database and needs no token
 * (`services/api/src/server.ts`), so waking costs nothing and reveals nothing.
 *
 * One request per page load, however many components ask: StrictMode mounts
 * twice, and two gate pages can mount in one visit. A failed wake is forgotten
 * so the next page can try again.
 */
let waking: Promise<boolean> | null = null;

export function wakeApi(): Promise<boolean> {
  waking ??= fetch(`${BASE}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(75_000) })
    .then((r) => r.ok)
    .catch(() => false)
    .then((ok) => {
      if (!ok) waking = null;
      return ok;
    });
  return waking;
}

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
      // Only a request WITH a body says it is JSON. The API (Fastify) refuses a
      // JSON content type with an empty body, so every bodiless POST (a journey,
      // a dismiss, Orientation's finish) answered 400 (found 5 Oct 2026).
      ...(init.body !== undefined && init.body !== null ? { "content-type": "application/json" } : {}),
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
  // A 204 (a read marker, a delete) has no body to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestText(path: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    // The refusal is a sentence worth showing: an audit export past its cap says
    // how many entries matched and what to narrow.
    let message = "Export failed.";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* non-JSON body; keep the default */
    }
    throw new ApiError("internal", message, res.status);
  }
  return res.text();
}

/* ---------------------------------------------------------------- types */

export interface RosterRow {
  studentId: string;
  fullName: string;
  status: "unclaimed" | "claimed" | "disabled";
  claimedAt: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  /** Set once the student has registered: the link to their record. */
  userId: string | null;
  /** Registered and soft-deleted, or never registered and disabled. */
  deactivated: boolean;
  attempts: number;
  avgMastery: number | null;
  /** Their picture as this viewer may see it, or the generated planet (PROFILES). */
  avatar: Avatar;
}

export interface RosterSection {
  id: string;
  code: string;
  term: string;
}

export interface Roster {
  students: RosterRow[];
  sections: RosterSection[];
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
  sectionId: string | null;
}
export interface LockCell {
  userId: string;
  stageId: string;
  /** From is_stage_unlocked(). The page renders this; it never derives it. */
  unlocked: boolean;
  mastery: number;
  /** null means "auto" — the curriculum policy decides, not a person. */
  override: "locked" | "unlocked" | null;
  reason: string | null;
  /** Who set the override and when. Both null on an automatic cell. */
  setBy: string | null;
  setAt: string | null;
}
/** A course-wide ("global") or section override, with its window. */
export interface ScopeLock {
  id: string;
  scope: "global" | "section";
  sectionId: string | null;
  sectionCode: string | null;
  stageId: string;
  state: "locked" | "unlocked";
  reason: string | null;
  unlockAt: string | null;
  lockAt: string | null;
  setBy: string;
  setAt: string | null;
}
export interface LockMatrix {
  stages: LockStage[];
  students: LockStudent[];
  cells: LockCell[];
  sections: Array<{ id: string; code: string; term: string }>;
  scopeLocks: ScopeLock[];
}

export interface StudentDetail {
  student: {
    userId: string;
    studentId: string;
    fullName: string;
    sectionId: string | null;
    sectionCode: string | null;
    /** When they claimed their student ID. Null only for a record older than the directory. */
    claimedAt: string | null;
    deactivated: boolean;
    /** Their picture as this viewer may see it, with whether the viewer may remove it (PROFILES). */
    avatar: Avatar;
    /** A teacher or the admin removed it and the student has not set a new one. */
    pictureRemovedAt: string | null;
  };
  /** For "Move to section…", the same list the roster reads. */
  sections: RosterSection[];
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
    /** Times the student left the paper: full screen or the page (ruling 3, 30 Sep 2026). */
    leaves: number;
  }>;
  progress: Array<{
    stageId: string;
    mastery: number;
    bestScore: number | null;
    attempts: number;
    lastSeenAt: string | null;
  }>;
  /**
   * Moon mastery by stage (instructor, 30 Sep 2026; WEB-REVAMP 3.7a): every
   * gradeable, published stage with moons. `correct` is the distinct questions
   * of a moon answered right (journey or check), `mastered` the database's
   * verdict (two of them), `questions` its live questions. Printed, never
   * recomputed. Optional so an older API degrades to an absent card.
   */
  moons?: RecordMoonStage[];
}

export interface RecordMoonStage {
  stageId: string;
  title: string;
  mastered: number;
  total: number;
  objectives: Array<{ id: string; description: string; correct: number; mastered: boolean; questions: number }>;
}

/** Staff-only. Carries the answer key — see the note at the top of this file. */
export interface AttemptDetail {
  attemptId: string;
  status: string;
  engineVersion: string;
  /** Whose paper, which assessment, when (29 Sep 2026): `/attempts/:id` is addressable on its own. */
  student: { userId: string; studentId: string; fullName: string };
  assessmentTitle: string;
  scope: string;
  attemptNo: number;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  /** The sitting, in order: every leave and return (ruling 3, 30 Sep 2026). */
  events?: Array<{
    kind: "left_fullscreen" | "left_page" | "returned" | "fullscreen_unavailable" | "closed" | "auto_submitted";
    at: string;
  }>;
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

export type { AuditEntry, AuditPage } from "@octa/contracts";

/** One pasted line, as the server will treat it. See routes/console.ts. */
export interface RosterPlanRow {
  studentId: string;
  fullName: string;
  sectionCode: string;
  action: "insert" | "update" | "unchanged" | "conflict";
  why?: "registered" | "duplicate" | "unknown-section";
  current: { fullName: string; sectionCode: string | null; status: RosterRow["status"] } | null;
}

export interface RosterImportPlan {
  dryRun: boolean;
  summary: { insert: number; update: number; unchanged: number; conflict: number };
  plan?: RosterPlanRow[];
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
  /** `planned` is not a bug -- see the note in pages/studio/OverviewView.tsx. */
  authoring: "authored" | "planned" | "empty";
  /** Blocks edited in the console and not yet written back into the .md. */
  consoleEdited: number;
  summaryStatus: SummaryStatus | null;
  /** Drafted lesson text waiting on /content (5 Oct 2026), or null when the chapter has none. */
  draftStatus: SummaryStatus | null;
  /** Figures drawn for this chapter: waiting for review, and approved (6 Oct 2026). Optional: older fixtures omit them. */
  figuresWaiting?: number;
  figuresApproved?: number;
}

export type SummaryStatus = "draft" | "approved" | "sent_back";

/** A planet summary under review. The draft is staff-only: see db/schema.sql `stage_summaries`. */
export interface StageSummary {
  stageId: string;
  title: string;
  act: number;
  draft: string;
  /** What an approval names: the approval is of THIS text. */
  hash: string;
  status: SummaryStatus;
  note: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  /** The teacher who wrote this version in the console; null: from the files (sync). */
  authoredBy?: string | null;
}

export type EditVia = "sync" | "console" | "direct";

export interface ContentBlock {
  id: string;
  ordinal: number;
  kind: string;
  body: string;
  meta: Record<string, string>;
  version: number;
  updatedAt: string;
  consoleEdited: boolean;
  /** False for a quote from the book (`meta.source`), which is edited in its .md file. */
  editable: boolean;
  source: string | null;
  historyCount: number;
  lastEdit: { via: EditVia; at: string; reason: string | null; editor: string | null } | null;
}

export interface ChapterDetail {
  stage: {
    id: string;
    title: string;
    act: number;
    archetype: string;
    levels: number[];
    gradeable: boolean;
    published: boolean;
    authoring: "authored" | "planned" | "empty";
  };
  blocks: ContentBlock[];
  summary: StageSummary | null;
  /** The chapter's drafted lesson text (instructor ruling, 5 Oct 2026). Staff-only, unreviewed. */
  draft: ChapterDraft | null;
  /** The chapter's figures (6 Oct 2026), each drawn as it is under review. */
  figures: ContentFigure[];
  /** The syllabus's objectives for this chapter, verbatim (Studio's Objectives tab). */
  objectives?: Array<{ code: string; description: string; bloom: string; level: number | null; competency: string | null }>;
}

/**
 * A figure drawn for the course (docs/FIGURES-AND-AUDIO.md). `svg` is the
 * drawing under review; approving is of THIS drawing, by `hash`. `served`
 * says whether students see a drawing now (the last approved one, which may be
 * older than this).
 */
export interface ContentFigure {
  id: string;
  title: string;
  svg: string;
  hash: string;
  status: SummaryStatus;
  note: string | null;
  served: boolean;
  everApproved: boolean;
  reviewer: string | null;
  reviewedAt: string | null;
  authoredBy?: string | null;
}

/** A chapter's lesson text drafted from the textbook, waiting for review. Approving is of THIS text. */
export interface ChapterDraft {
  blocks: Array<{ kind: string; body: string; meta: Record<string, string> }>;
  hash: string;
  status: SummaryStatus;
  note: string | null;
  /** Students already read an earlier approved version of this chapter's draft. */
  everApproved: boolean;
  reviewer: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  authoredBy?: string | null;
}

export interface BlockVersion {
  version: number;
  kind: string;
  body: string;
  via: EditVia;
  replacedAt: string;
  reason: string | null;
  editor: string | null;
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
    consoleEdited: number;
    summaries: { draft: number; approved: number; sentBack: number; none: number };
    chapters: { draft: number; approved: number; sentBack: number };
    /** Figures drawn for the course (6 Oct 2026): waiting for review, and approved. */
    figures: { waiting: number; approved: number };
  };
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
  /** A question that needs a figure: it cannot go live until the figure is approved. */
  figure: { id: string; status: SummaryStatus; served: boolean } | null;
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
  /** The question's figure, drawn as it is under review, approvable here. */
  figure: ContentFigure | null;
  error?: string;
}

export interface Submission {
  id: string;
  kind: "lab" | "project" | "participation";
  stageId: string | null;
  slug: string;
  title: string;
  /** Null on a draft: the console list withholds it (instructor, 27 Sep 2026). */
  bodyMd: string | null;
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

/** Lecture Mode's shapes live in `@octa/contracts` (29 Sep 2026); re-exported for the pages. */
export type { LiveOptions, LiveSession, LiveSnapshot } from "@octa/contracts";

/** `GET /console/live/health`: what a teacher needs mid-lecture that is not about students. */
export interface LiveHealth {
  inProgress: number;
  submittedRecently: number;
  reportsRecently: number;
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
  sectionId: string | null;
  sectionCode: string | null;
  /** When the exam salt was set. Null means no salt row: Start will fail. Never the salt. */
  saltSetAt: string | null;
  /** When it was last rotated, from the audit log; null if never. */
  saltRotatedAt: string | null;
  attempts: number;
  submitted: number;
  /** Can the live bank fill this assessment's blueprint? Same answer as `Feasibility`. */
  bank: Bank;
}

export interface Shortfall { dimension: string; cell: string; need: number; have: number }

/** "Can the live bank fill this blueprint?", from `feasibilityOf()` in routes/assessments.ts. */
export interface Bank {
  totalItems: number;
  poolSize: number;
  enoughItems: boolean;
  shortfalls: Shortfall[];
  satisfiable: boolean;
}

/** Asked BEFORE an assessment is created -- see pages/AssessmentsPage.tsx. */
export interface Feasibility extends Bank {
  blueprintId: string;
  name: string;
}

export interface Section { id: string; code: string; term: string }

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
  roster: () => request<Roster>("/api/v1/console/roster"),

  importRoster: (input: {
    sectionCode: string;
    term: string;
    rows: Array<{ studentId: string; fullName: string; sectionCode?: string }>;
    apply: boolean;
  }) =>
    request<RosterImportPlan>("/api/v1/console/roster/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Deactivate or reactivate. Reason required, both ways; audited. */
  setRosterStatus: (input: { studentId: string; active: boolean; reason: string }) =>
    request<{ ok: true; active: boolean }>("/api/v1/console/roster/status", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** All or nothing; one audit row per student. */
  moveSection: (input: { studentIds: string[]; sectionId: string; reason: string }) =>
    request<{ ok: true; moved: number; sectionCode: string }>("/api/v1/console/roster/section", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  locks: () => request<LockMatrix>("/api/v1/console/locks"),

  setLock: (input: SetLockInput) =>
    request<{ ok: true }>("/api/v1/console/locks", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** One reason, one transaction, one audit row per cell. */
  setLocks: (input: {
    state: "locked" | "unlocked" | "auto";
    reason: string;
    cells: Array<{ userId: string; stageId: string }>;
  }) =>
    request<{ ok: true; count: number }>("/api/v1/console/locks/bulk", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  student: (userId: string) =>
    request<StudentDetail>(`/api/v1/console/students/${encodeURIComponent(userId)}`),

  attempt: (attemptId: string) =>
    request<AttemptDetail>(`/api/v1/console/attempts/${encodeURIComponent(attemptId)}`).then((d) => ({
      ...d,
      // Text, whatever shape was stored: an object here blanks the page (see studentAnswerText).
      items: (d.items ?? []).map((i) => ({
        ...i,
        options: Array.isArray(i.options) ? i.options : [],
        studentAnswer: studentAnswerText(i.studentAnswer, Array.isArray(i.options) ? i.options : []),
      })),
    })),

  /** One page of the log, newest first; `params` from `lib/audit-view.ts` `apiParams()`. */
  audit: (params: URLSearchParams) => request<AuditPage>(`/api/v1/console/audit?${params}`),
  /** Every entry the filter matches, as CSV (the cursor is ignored). */
  auditCsv: (params: URLSearchParams) => requestText(`/api/v1/console/audit.csv?${params}`),

  systemAudit: () =>
    request<SystemAudit>("/api/v1/console/audit/system"),

  /** The page. The CSV below comes from the same computation, on the server. */
  gradebook: () => request<Gradebook>("/api/v1/console/gradebook"),

  gradebookCsv: () => requestText("/api/v1/console/gradebook.csv"),

  stages: () =>
    request<{
      nodes: Array<{ id: string; title: string; ordinal: number; act: number; gradeable: boolean }>;
    }>("/api/v1/stages"),

  content: () => request<ContentStatus>("/api/v1/console/content"),
  /** Course Studio (CS1): subjects, their books and classes, and what this reader may approve. */
  studioSubjects: () => request<StudioSubjectsResponse>("/api/v1/console/subjects"),
  createSubject: (b: SubjectCreateBody) =>
    request<{ ok: true; code: string }>("/api/v1/console/subjects", { method: "POST", body: JSON.stringify(b) }),
  renameSubject: (code: string, b: SubjectRenameBody) =>
    request<{ ok: true }>(`/api/v1/console/subjects/${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify(b) }),
  createBook: (code: string, b: BookCreateBody) =>
    request<{ ok: true; id: string }>(`/api/v1/console/subjects/${encodeURIComponent(code)}/books`, { method: "POST", body: JSON.stringify(b) }),
  updateBook: (id: string, b: BookUpdateBody) =>
    request<{ ok: true }>(`/api/v1/console/books/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(b) }),
  defaultBook: (id: string, b: BookDefaultBody) =>
    request<{ ok: true }>(`/api/v1/console/books/${encodeURIComponent(id)}/default`, { method: "POST", body: JSON.stringify(b) }),
  /** The Studio's editor (E1): a chapter's working copy, saved as a draft students never see, and Publish. */
  workingCopy: (stageId: string) => request<WorkingCopy>(`/api/v1/console/content/${encodeURIComponent(stageId)}/working`),
  saveWorkingCopy: (stageId: string, body: WorkingCopyPutBody) =>
    request<{ ok: true; version: number; hash: string; savedAt: string }>(
      `/api/v1/console/content/${encodeURIComponent(stageId)}/working`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  discardWorkingCopy: (stageId: string) =>
    request<{ ok: true; hash: string; blocks: number }>(
      `/api/v1/console/content/${encodeURIComponent(stageId)}/working`,
      { method: "DELETE" },
    ),
  publishWorkingCopy: (stageId: string, body: WorkingCopyPublishBody) =>
    request<{ ok: true; added: number; removed: number; edited: number; moved: number; blocks: number }>(
      `/api/v1/console/content/${encodeURIComponent(stageId)}/publish`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  /** The Studio's moons (E2): a chapter's objectives, edits waiting to publish, drafts, and Publish. */
  moons: (stageId: string) => request<StudioMoonsResponse>(`/api/v1/console/content/${encodeURIComponent(stageId)}/moons`),
  addMoon: (stageId: string, body: MoonAddBody) =>
    request<{ ok: true; id: string }>(`/api/v1/console/content/${encodeURIComponent(stageId)}/moons`, { method: "POST", body: JSON.stringify(body) }),
  saveMoonPending: (id: string, body: MoonPendingBody) =>
    request<{ ok: true; version: number }>(`/api/v1/console/content/moons/${encodeURIComponent(id)}/pending`, { method: "PUT", body: JSON.stringify(body) }),
  discardMoonPending: (id: string) =>
    request<{ ok: true; removed: boolean }>(`/api/v1/console/content/moons/${encodeURIComponent(id)}/pending`, { method: "DELETE" }),
  deleteMoon: (id: string) =>
    request<{ ok: true }>(`/api/v1/console/content/moons/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publishMoons: (stageId: string, body: MoonsPublishBody) =>
    request<MoonsPublishResult>(`/api/v1/console/content/${encodeURIComponent(stageId)}/moons/publish`, { method: "POST", body: JSON.stringify(body) }),
  /** The /changelog page's course readiness: the Prelim's five conditions, live. */
  progress: () => request<ProgressResponse>("/api/v1/console/progress"),

  contentSummaries: () => request<{ summaries: StageSummary[] }>("/api/v1/console/content/summaries"),

  contentChapter: (stageId: string) =>
    request<ChapterDetail>(`/api/v1/console/content/${encodeURIComponent(stageId)}`),

  contentHistory: (blockId: string) =>
    request<{ versions: BlockVersion[] }>(`/api/v1/console/content/blocks/${encodeURIComponent(blockId)}/history`),

  approveSummary: (stageId: string, hash: string) =>
    request<{ ok: true; alreadyApproved: boolean }>(
      `/api/v1/console/content/summaries/${encodeURIComponent(stageId)}/approve`,
      { method: "POST", body: JSON.stringify({ hash }) },
    ),

  /** Drafted lesson text: approving copies it in, and students read it from then on. */
  approveDraft: (stageId: string, hash: string) =>
    request<{ ok: true; alreadyApproved: boolean }>(
      `/api/v1/console/content/drafts/${encodeURIComponent(stageId)}/approve`,
      { method: "POST", body: JSON.stringify({ hash }) },
    ),

  /** A figure: approving serves THIS drawing to students, on the lesson and on its questions. */
  approveFigure: (figureId: string, hash: string) =>
    request<{ ok: true; alreadyApproved: boolean }>(
      `/api/v1/console/figures/${encodeURIComponent(figureId)}/approve`,
      { method: "POST", body: JSON.stringify({ hash }) },
    ),

  sendBackFigure: (figureId: string, reason: string) =>
    request<{ ok: true }>(
      `/api/v1/console/figures/${encodeURIComponent(figureId)}/send-back`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),

  sendBackDraft: (stageId: string, reason: string) =>
    request<{ ok: true }>(
      `/api/v1/console/content/drafts/${encodeURIComponent(stageId)}/send-back`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),

  sendBackSummary: (stageId: string, reason: string) =>
    request<{ ok: true }>(
      `/api/v1/console/content/summaries/${encodeURIComponent(stageId)}/send-back`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),

  /** The triage queue: groups of exact repeats, filtered on the server, a page at a time. */
  feedback: (params: URLSearchParams) =>
    request<FeedbackQueue>(`/api/v1/console/feedback?${params}`),

  /** Every report the filter matches, as the server writes it. */
  feedbackCsv: (params: URLSearchParams) => requestText(`/api/v1/console/feedback.csv?${params}`),

  /** One decision for every report in a group; one audit row each. */
  triageFeedback: (body: FeedbackBulkTriage) =>
    request<{ updated: number }>("/api/v1/console/feedback", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  items: (filter: {
    stageId?: string | null;
    status?: string | null;
    flagged?: string | null;
    /** `/items` asks for the whole bank (up to 2000) and filters in the page. */
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (filter.stageId) q.set("stageId", filter.stageId);
    if (filter.status) q.set("status", filter.status);
    if (filter.flagged) q.set("flagged", filter.flagged);
    if (filter.limit) q.set("limit", String(filter.limit));
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
  liveHealth: () => request<LiveHealth>("/api/v1/console/live/health"),
  /** Live items only, and the sections: what a question can be started with. */
  liveOptions: () => request<LiveOptions>("/api/v1/console/live/options"),
  /** Put one live item to the room. Staff only, reason required, audited. */
  liveStart: (body: LiveStartBody) =>
    request<{ session: LiveSession }>("/api/v1/console/live/sessions", { method: "POST", body: JSON.stringify(body) }),
  /** End it. Reason required, audited; an ended question is a record. */
  liveEnd: (id: string, reason: string) =>
    request<{ ok: true; endedAt: string }>(`/api/v1/console/live/sessions/${encodeURIComponent(id)}/end`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  assessments: () =>
    request<{ assessments: Assessment[]; blueprints: Blueprint[]; sections: Section[] }>(
      "/api/v1/console/assessments",
    ),

  /**
   * A new salt for papers not yet started. Staff only, reason required, audited.
   * The response carries when, never the salt.
   */
  rotateSalt: (id: string, reason: string) =>
    request<{ ok: true; rotatedAt: string }>(
      `/api/v1/console/assessments/${encodeURIComponent(id)}/rotate-salt`,
      { method: "POST", body: JSON.stringify({ reason }) },
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
    opensAt?: string | null;
    closesAt?: string | null;
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
  /**
   * Replace your OWN email and password, clearing the bootstrap flag.
   * Self-only on the server: the user id comes from the verified JWT, never
   * from this body.
   */
  setOwnCredentials: (body: { email: string; password: string }) =>
    request<{ ok: true; reauthRequired: boolean }>("/api/v1/console/account/credentials", {
      method: "POST",
      body: JSON.stringify(body),
    }),

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

  /** Drafts into review, and nothing else. The API refuses any other `to`. */
  bulkSendToReview: (ids: string[]) =>
    request<ItemBulkStatusResult>("/api/v1/console/items/bulk-status", {
      method: "POST",
      body: JSON.stringify({ ids, to: "review" } satisfies ItemBulkStatusRequest),
    }),

  /** Always called with `dryRun: true` first; the page shows the plan. */
  importItems: (file: ItemFile, dryRun: boolean) =>
    request<ItemImportResult>("/api/v1/console/items/import", {
      method: "POST",
      body: JSON.stringify({ dryRun, file } satisfies ItemImportRequest),
    }),

  /** Carries the answer keys. Staff only, and only ever saved to a file. */
  exportItems: (ids: string[]) =>
    request<ItemFile>("/api/v1/console/items/export", {
      method: "POST",
      body: JSON.stringify({ ids } satisfies ItemExportRequest),
    }),
  /** A temporary password for one student, shown once (6 Oct 2026). Never stored. */
  resetStudentPassword: (userId: string, reason: string) =>
    request<{ temporaryPassword: string; studentId: string; fullName: string }>(
      `/api/v1/console/students/${encodeURIComponent(userId)}/password`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),

  /* ---- the class chat (docs/CHAT-PLAN.md): every room, moderation, storage ---- */
  chatRooms: () => request<ChatRooms>("/api/v1/chat/rooms"),
  chatUnread: () => request<ChatUnread>("/api/v1/chat/unread"),
  chatThread: (roomId: string, before?: string) =>
    request<ChatThread>(
      `/api/v1/chat/rooms/${encodeURIComponent(roomId)}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ),
  chatRead: (roomId: string) =>
    request<void>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST" }),
  chatOpenThread: (userId: string) =>
    request<ChatRoom>("/api/v1/chat/threads", { method: "POST", body: JSON.stringify({ userId }) }),
  chatUpload: (roomId: string, file: { name: string; mime: string; bytes: number }) =>
    request<ChatUpload>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/uploads`, {
      method: "POST",
      body: JSON.stringify(file),
    }),
  chatSend: (roomId: string, input: { body?: string; mentions: string[]; attachment?: { path: string; name: string } }) =>
    request<ChatMessage>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Your own message: no reason. Someone else's (moderation): a reason, audited. */
  chatDelete: (messageId: string, reason?: string) =>
    request<void>(`/api/v1/chat/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
      ...(reason ? { body: JSON.stringify({ reason }) } : {}),
    }),
  chatAttachments: () => request<ChatAttachments>("/api/v1/chat/attachments"),
  chatRemoveAttachment: (messageId: string, reason: string) =>
    request<{ removed: number; bytes: number }>(`/api/v1/chat/messages/${encodeURIComponent(messageId)}/attachment`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  chatPrune: (olderThanDays: number, reason: string) =>
    request<{ removed: number; bytes: number }>("/api/v1/chat/attachments/prune", {
      method: "POST",
      body: JSON.stringify({ olderThanDays, reason }),
    }),
};

/** Straight to storage, at the one-time URL the API signed (see apps/web's twin). */
export async function putChatFile(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, body: file });
  if (!res.ok) throw new ApiError("upload_failed", "The file did not upload. Try attaching it again.", res.status);
}

/* ---------------------------------------------------------- teachers (T1) */

/** POST /auth/claim-teacher: public; the role comes from the roster. */
export async function claimTeacher(body: TeacherClaimBody): Promise<void> {
  await request<{ ok: true }>("/api/v1/auth/claim-teacher", { method: "POST", body: JSON.stringify(body) });
}

export const getTeachers = () => request<TeachersResponse>("/api/v1/console/teachers");

export const getTeacher = (key: string) =>
  request<TeacherDetail>(`/api/v1/console/teachers/${encodeURIComponent(key)}`);

export interface TeacherImportPlanRow {
  employeeId: string;
  fullName: string;
  email: string | null;
  role: "teacher" | "admin";
  current: { fullName: string; email: string | null; role: string; status: string } | null;
  action: "insert" | "update" | "unchanged" | "conflict";
  why?: "claimed" | "duplicate";
}

export interface TeacherImportResult {
  dryRun: boolean;
  summary: { insert: number; update: number; unchanged: number; conflict: number };
  plan: TeacherImportPlanRow[];
}

export const importTeachers = (body: TeacherImportBody) =>
  request<TeacherImportResult>("/api/v1/console/teachers/import", { method: "POST", body: JSON.stringify(body) });

export const setTeacherStatus = (key: string, body: TeacherStatusBody) =>
  request<{ ok: true; active: boolean }>(`/api/v1/console/teachers/${encodeURIComponent(key)}/status`, {
    method: "POST", body: JSON.stringify(body),
  });

export const assignClass = (body: ClassAssignBody) =>
  request<{ ok: true; id: string }>("/api/v1/console/classes", { method: "POST", body: JSON.stringify(body) });

export const updateClass = (id: string, body: ClassUpdateBody) =>
  request<{ ok: true }>(`/api/v1/console/classes/${id}`, { method: "PATCH", body: JSON.stringify(body) });

/* ---- profile pictures (docs/PROFILES-PLAN.md): the signed-in person's own, and a moderator's removal ---- */

export const getProfile = () => request<Profile>("/api/v1/profile");

export const profileAvatarUpload = (bytes: number) =>
  request<{ path: string; uploadUrl: string }>("/api/v1/profile/avatar/upload", {
    method: "POST", body: JSON.stringify({ bytes }),
  });

export const profileAvatarSet = (path: string) =>
  request<Profile>("/api/v1/profile/avatar", { method: "PUT", body: JSON.stringify({ path }) });

export const profileAvatarRemove = () => request<Profile>("/api/v1/profile/avatar", { method: "DELETE" });

/** The first-run tour has been started for this account (set once, in the database). */
export const profileTourSeen = () => request<Profile>("/api/v1/profile/tour", { method: "POST" });

/** PUT the encoded picture to the one-time signed URL the API gave (the bucket takes WebP only). */
export async function putAvatarFile(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/webp", "x-upsert": "false" },
    body: blob,
  });
  if (!res.ok) throw new ApiError("upload_failed", "The picture did not upload. Try again.", res.status);
}

/** A teacher removes a student's picture; the admin anyone's. A reason, audited, the person is told. */
export const removePicture = (userId: string, reason: string) =>
  request<{ removed: true }>(`/api/v1/profiles/${encodeURIComponent(userId)}/avatar`, {
    method: "DELETE", body: JSON.stringify({ reason }),
  });
