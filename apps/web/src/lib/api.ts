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
}

export interface StageDetail {
  id: string;
  title: string;
  summary?: string | null;
  archetype: string;
  levels: number[];
  estMinutes: number;
  locked: boolean;
  mastery?: number;
  objectives: Array<{ id: string; description: string; bloom: string; level?: number; competency?: string }>;
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

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

let tokenProvider: () => Promise<string | null> = async () => null;

export function setTokenProvider(fn: () => Promise<string | null>): void {
  tokenProvider = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
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
      /* non-JSON error body; the defaults above are already the right shape */
    }
    throw new ApiError(code, message, res.status);
  }

  return (await res.json()) as T;
}

export const api = {
  stages: () => request<StageMapData>("/api/v1/stages"),
  stage: (id: string) => request<StageDetail>(`/api/v1/stages/${id}`),
  progress: () => request<ProgressGrid>("/api/v1/progress"),
  startAttempt: (assessmentId: string) =>
    request<{
      attemptId: string;
      attemptNo: number;
      resumed: boolean;
      totalItems: number;
      items: Array<{ ordinal: number; type: string; stem: string; options: string[]; points: number; unit?: string }>;
    }>("/api/v1/attempts", {
      method: "POST",
      body: JSON.stringify({ assessmentId }),
    }),

  answer: (attemptId: string, ordinal: number, answer: unknown, timeMs?: number) =>
    request<{
      recorded: boolean;
      verdictWithheld?: boolean;
      isCorrect?: boolean;
      correctValue?: string;
      rationale?: string;
    }>(`/api/v1/attempts/${attemptId}/answer`, {
      method: "POST",
      body: JSON.stringify({ ordinal, answer, ...(timeMs !== undefined ? { timeMs } : {}) }),
    }),

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

  submit: (attemptId: string) =>
    request<{
      score: number;
      maxScore: number;
      mastery: number;
      byObjective: Record<string, { correct: number; total: number }>;
      review: Array<{ ordinal: number; isCorrect: boolean; correctValue: string; rationale: string }>;
    }>(`/api/v1/attempts/${attemptId}/submit`, { method: "POST" }),
};
