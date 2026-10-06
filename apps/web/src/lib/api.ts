import type {
  AttemptEventKind,
  ChatMessage,
  ChatRoom,
  ChatRooms,
  ChatThread,
  ChatUnread,
  ChatUpload,
  Cosmetics,
} from "@octa/contracts";

/**
 * API client.
 *
 * Everything gradeable goes through services/api. This module never computes a
 * lock, never scores an answer, and never holds an answer key -- those live on
 * the server by design, and the browser owns nothing.
 */

export interface LockReason {
  kind: "prereq" | "override" | "not_published" | "window_closed" | "not_yet_open";
  blockingStages: string[];
  requiredMastery?: number;
  currentMastery?: number;
  message: string;
}

/**
 * A moon's mastery, as the server counts it (WEB-REVAMP 3.7a): `correct` is the
 * distinct questions of it answered right, `mastered` the database's verdict
 * (two of them), `questions` its live questions (0: it cannot be mastered yet).
 * Printed, never recomputed: the client does not decide a moon.
 */
export interface MoonFacts {
  id: string;
  correct: number;
  mastered: boolean;
  questions: number;
}

export interface StageNode {
  id: string;
  act: number;
  ordinal: number;
  title: string;
  summary: string | null;
  estMinutes: number;
  archetype: "A" | "B" | "C" | "D";
  levels: number[];
  gradeable: boolean;
  published: boolean;
  prereq: string[];
  blockCount: number;
  /**
   * This stage's objectives: one objective is one moon, and a planet's orbit
   * ring is the mean of its moons' levels (src/solar-system/layout.ts). Each
   * carries its mastery as the server counts it (WEB-REVAMP 3.7a).
   */
  objectives: Array<MoonFacts & { level: number; description: string }>;
  /** "N of M subtopics mastered"; null on a non-gradeable planet (Orientation). */
  moons: { mastered: number; total: number } | null;
  state: "locked" | "available" | "in_progress" | "mastered";
  mastery: number;
  lockReason: LockReason | null;
}

export interface StageMapData {
  nodes: StageNode[];
  edges: Array<{ from: string; to: string }>;
  generatedAt: string;
}

export interface ContentBlock {
  ordinal: number;
  kind: string;
  body: string;
  meta: Record<string, string>;
  version: number;
  /** A figure block's drawing: only ever one an instructor approved (6 Oct 2026). */
  figure?: CourseFigure;
}

/** A figure drawn for the course, as the API serves it: approved, inline SVG. */
export interface CourseFigure {
  id?: string;
  title: string;
  svg: string;
}

export interface StageDetail {
  id: string;
  title: string;
  summary?: string | null;
  archetype: string;
  levels: number[];
  estMinutes: number;
  /** False for orientation: nothing in it is graded. */
  gradeable: boolean;
  locked: boolean;
  /** The map's own state, decided by the server (hard rule 4). */
  state: "locked" | "available" | "in_progress" | "mastered";
  /** Best check score at which a stage counts as mastered, from the server. */
  masteryThreshold: number;
  /** Why a locked stage is locked, worded by the server; null when open. */
  lockReason: { kind: string; blockingStages: string[]; message: string } | null;
  mastery?: number;
  objectives: Array<MoonFacts & { description: string; bloom: string; level?: number; competency?: string }>;
  blocks: ContentBlock[];
  /** The stage's check, if one is scheduled for this student's section. */
  assessment: {
    id: string;
    title: string;
    attemptsAllowed: number;
    attemptsUsed: number;
    opensAt: string | null;
    closesAt: string | null;
  } | null;
}

export interface ProgressGrid {
  grid: Array<{ level: number; competency: string; mastery: number; objectives: number }>;
  depth: number;
  thresholdForMastery: number;
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

/*
 * 8090, not 8080.
 *
 * The fallback was `http://localhost:8080`, which on a developer machine is
 * frequently another project's Adminer — it answers preflight with no CORS
 * headers, so every request fails with `net::ERR_FAILED` and the app renders
 * "That did not load". Nothing in the failure names the port, and the API is
 * usually running perfectly on 8090 at the time.
 *
 * That cost a full debugging round twice: once chasing a rendering bug, once
 * chasing a spec suite that had started timing out. `playwright.config.ts` and
 * `DESIGN-REVIEW-01.md`'s reproduce block both already said 8090; only the
 * fallback in the client disagreed, so the fix is to make the code agree with
 * the docs rather than to remember an env var.
 *
 * A deployment always sets `VITE_API_URL`, so this value is only ever the local
 * default.
 */
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8090";

let tokenProvider: () => Promise<string | null> = async () => null;

export function setTokenProvider(fn: () => Promise<string | null>): void {
  tokenProvider = fn;
}

/**
 * The last token a request used. `pagehide` gives no time to await a session
 * read, so a paper handed in as the page closes (ruling 4) is sent with this.
 */
let lastToken: string | null = null;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  lastToken = token;
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
      /* non-JSON error body; the defaults above are already the right shape */
    }
    throw new ApiError(code, message, res.status);
  }

  // A 204 (a read marker, a delete) has no body to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * The student's cosmetic look. Cosmetic ONLY -- it decides what they see, never
 * what they can do. Derived server-side from `student_id` alone; the client is
 * a thin consumer and never computes it (docs/redesign/SOLAR-SYSTEM-SPEC.md §3,
 * and `services/api/test/cosmetics.spec.ts` asserts both halves of that).
 *
 * The shape is the shared Zod contract now (`packages/contracts`), since the
 * per-planet biomes of 30 Sep 2026: a hand-kept mirror is how a field goes
 * missing on one side.
 */
export type { Cosmetics };

/** A paper as it opens: a stage check, an exam, or a moon's journey. */
export interface StartedPaper {
  attemptId: string;
  attemptNo: number;
  resumed: boolean;
  totalItems: number;
  items: PaperItem[];
  /** Since 29 Sep 2026: the student's own recorded answers on a resume. */
  answered?: RecordedAnswer[];
}

export const api = {
  stages: () => request<StageMapData>("/api/v1/stages"),
  cosmetics: () => request<Cosmetics>("/api/v1/cosmetics"),
  stage: (id: string) => request<StageDetail>(`/api/v1/stages/${id}`),
  progress: () => request<ProgressGrid>("/api/v1/progress"),
  startAttempt: (assessmentId: string) =>
    request<StartedPaper>("/api/v1/attempts", {
      method: "POST",
      body: JSON.stringify({ assessmentId }),
    }),
  /**
   * A moon's journey (WEB-REVAMP 3.7a): practice on one objective's own live
   * questions. The server decides the lock and finds or begins the journey;
   * answering and submitting use the ordinary attempt calls.
   */
  /**
   * An UNGRADED stage read to its end (instructor, 5 Oct 2026): the server
   * records it mastered and names the next stage. A graded stage is refused.
   */
  readStage: (stageId: string) =>
    request<{ stageId: string; state: "mastered"; next: string | null }>(
      `/api/v1/stages/${encodeURIComponent(stageId)}/read`,
      { method: "POST" },
    ),

  startJourney: (objectiveId: string) =>
    request<StartedPaper & { objectiveId: string }>(
      `/api/v1/objectives/${encodeURIComponent(objectiveId)}/journey`,
      { method: "POST" },
    ),

  answer: (attemptId: string, ordinal: number, answer: unknown, timeMs?: number) =>
    request<AnswerOutcome>(`/api/v1/attempts/${attemptId}/answer`, {
      method: "POST",
      body: JSON.stringify({ ordinal, answer, ...(timeMs !== undefined ? { timeMs } : {}) }),
    }),

  /* ---- submissions: labs, the project, participation. 40% of the grade. ---- */

  mySubmissions: () => request<{ submissions: unknown[] }>("/api/v1/submissions"),

  saveSubmission: (
    slug: string,
    input: { kind: string; title: string; bodyMd: string; submit: boolean; stageId?: string },
  ) =>
    request<{ id: string; status: string; submittedAt: string | null; isLate: boolean }>(
      `/api/v1/submissions/${encodeURIComponent(slug)}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  /* ---- feedback. The routes existed and tested; nothing called them. ---- */

  sendFeedback: (input: {
    channel: "flag" | "content_report" | "csat";
    category?: string;
    body?: string;
    route?: string;
    context?: Record<string, unknown>;
    /** Together these let the SERVER reconstruct the exact variant seen. */
    attemptId?: string;
    ordinal?: number;
  }) =>
    request<{ id: string; variantAttached: boolean }>("/api/v1/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** May the SUS survey appear? The gate is server-side; see SusSurvey.tsx. */
  feedbackPrompt: () =>
    request<{ show: boolean; sessions: number; completed: number }>("/api/v1/feedback/prompt"),

  dismissPrompt: () =>
    request<{ ok: true }>("/api/v1/feedback/prompt/dismiss", { method: "POST" }),

  submitSus: (answers: number[]) =>
    request<{ score: number }>("/api/v1/feedback/sus", {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  /** The student left the paper, or came back (ruling 3). The server stamps the time. */
  attemptEvent: (attemptId: string, kind: AttemptEventKind) =>
    request<{ recorded: true }>(`/api/v1/attempts/${attemptId}/events`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),

  /** One paper of the student's own: its questions (never a key) and what they recorded. */
  attempt: (attemptId: string) =>
    request<{ attemptId: string; status: string; items: PaperItem[]; answered?: RecordedAnswer[] }>(
      `/api/v1/attempts/${attemptId}`,
    ),

  /** `left`: handed in because the student left the paper (ruling 4); the server records it. */
  submit: (attemptId: string, left?: LeftReason) =>
    request<SubmitResult>(`/api/v1/attempts/${attemptId}/submit`, {
      method: "POST",
      ...(left ? { body: JSON.stringify({ left }) } : {}),
    }),

  /** The student's own new password (after a temporary one, 6 Oct 2026). Sign in again after. */
  changeOwnPassword: (password: string) =>
    request<{ ok: true; reauthRequired: true }>("/api/v1/account/password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  /* ---- the class chat (docs/CHAT-PLAN.md). 423 paper_open while a paper is open. ---- */

  chatRooms: () => request<ChatRooms>("/api/v1/chat/rooms"),
  chatUnread: () => request<ChatUnread>("/api/v1/chat/unread"),
  chatThread: (roomId: string, before?: string) =>
    request<ChatThread>(
      `/api/v1/chat/rooms/${encodeURIComponent(roomId)}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ),
  chatRead: (roomId: string) =>
    request<void>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST" }),
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
  chatDelete: (messageId: string) =>
    request<void>(`/api/v1/chat/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" }),
};

export type { ChatMessage, ChatRoom, ChatRooms, ChatThread };

/** Why a paper was handed in for the student (ruling 4, 6 Oct 2026). */
export type LeftReason = "left_fullscreen" | "left_page" | "closed";

/**
 * Hand the paper in as the page goes away (`pagehide`): synchronous, with the
 * last token, `keepalive` so the request outlives the page. Best effort: when
 * it does not arrive, the reload marker or the server's sweep submits it.
 */
export function submitOnUnload(attemptId: string): void {
  try {
    void fetch(`${BASE}/api/v1/attempts/${attemptId}/submit`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", ...(lastToken ? { authorization: `Bearer ${lastToken}` } : {}) },
      body: JSON.stringify({ left: "closed" }),
    }).catch(() => {});
  } catch {
    /* the page is going; the server's sweep is the backstop */
  }
}

/**
 * The file itself goes straight to storage, to the one-time URL the API signed
 * for this room and this author: 25 MB through Render's free tier would be
 * slow, and the API never needs the bytes. The bucket refuses anything over
 * 25 MB or of another type, whoever signed it.
 */
export async function putChatFile(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type, "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) throw new ApiError("upload_failed", "The file did not upload. Try attaching it again.", res.status);
}

/* ---- the paper: shapes from services/api/src/serialize/student.ts, the ONE serializer ---- */

/** One question as a student may see it while the paper is open. No key, by construction. */
export interface PaperItem {
  ordinal: number;
  type: string;
  stem: string;
  options: string[];
  points: number;
  unit?: string;
  /** The question's figure, when it needs one: part of the question, never of the key. */
  figure?: CourseFigure;
}

/** An answer in the shape the grading service takes and stores. */
export type StudentAnswer = { index: number } | { value: string | number } | { order: string[] };

/** A verdict: only ever for a question the student has recorded. */
export interface Verdict {
  ordinal: number;
  isCorrect: boolean;
  points: number;
  correctValue: string;
  rationale: string;
}

/** On a resume: what was recorded, and on a stage check, the verdict already shown. */
export interface RecordedAnswer {
  ordinal: number;
  answer: StudentAnswer | null;
  verdict?: Verdict;
}

export type AnswerOutcome =
  | ({ recorded: true; alreadyAnswered: boolean; answer: StudentAnswer | null; verdictWithheld?: undefined } & Verdict)
  | { recorded: true; verdictWithheld: true; alreadyAnswered: boolean; answer: StudentAnswer | null; ordinal: number };

export interface SubmitResult {
  score: number;
  maxScore: number;
  mastery: number;
  byObjective: Record<string, { correct: number; total: number }>;
  review: Verdict[];
}
