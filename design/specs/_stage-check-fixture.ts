import type { APIRequestContext, Page, Route } from "@playwright/test";
import { createHmac } from "node:crypto";
import type { ResolvedItem } from "../../services/api/src/engine/resolve.ts";
import { gradeResponse } from "../../services/api/src/engine/grade.ts";
import {
  toStudentAnswer,
  toStudentPaper,
  toStudentRecorded,
  toStudentVerdict,
} from "../../services/api/src/serialize/student.ts";

/**
 * The `/app/stage/:id/check` fixture: a paper the page cannot tell from the
 * API's, because it is built by the API's own functions.
 *
 * WHY A FIXTURE. No paper can be filled locally: all 96 act-1 items sit at
 * `review`, the engine samples only `live`, so every Start answers 500
 * (`NEXT-SESSION.md` §0e.1). The instructor chose (29 Sep 2026) a fixture for
 * layout and state, and a locally approved slice for the real-API tests.
 *
 * WHY IT IS STILL REAL.
 * - The items are the bank's own, resolved by the real engine through `/items`'
 *   preview endpoint (`resolveItem()` with a seed), as `_student-detail-fixture.ts` does.
 * - What reaches the page goes through the ONE serializer
 *   (`services/api/src/serialize/student.ts`): `toStudentPaper` for the paper,
 *   `toStudentVerdict` after a Record, `toStudentRecorded` on a resume. The key
 *   stays in this Node process until a Record asks for its verdict.
 * - Every answer is graded by the real `gradeResponse()`, first write wins, and
 *   a repeat gets the RECORDED answer's verdict, as `recordAnswer()` does.
 *
 * ONE INVENTION, said out loud: the bank has no free-entry item today (every P
 * item resolves with options), so question 6 is a real P item with its options
 * removed. `gradeResponse` grades a typed value against the same key with the
 * item's own tolerance; the runner owes that control, and it needs a spec.
 *
 * Seeded student `232129006`. Not a spec: the leading underscore.
 */

export const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
export const API = process.env.OCTA_API_URL ?? "http://localhost:8090";

export const STUDENT_SUB = "dddddddd-1111-4000-8000-000000000006";
export const STUDENT_ID = "232129006";
export const STAGE = "02";
export const ATTEMPT_ID = "a77e0000-0000-4000-8000-00000000c4ec";
/** Used only if the seed has no stage 02 check for this student's section. */
const FALLBACK_ASSESSMENT = "a55e0000-0000-4000-8000-00000000c4ec";

function mint(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, ...payload });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export const STUDENT = mint({
  sub: STUDENT_SUB,
  email: `${STUDENT_ID}@example.com`,
  app_metadata: { role: "student", student_id: STUDENT_ID },
});
export const STAFF = mint({
  sub: "dddddddd-0000-4000-8000-000000000001",
  email: "demo@example.com",
  app_metadata: { role: "teacher" },
});

export async function signIn(page: Page, token = STUDENT): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), token);
}

/* ------------------------------------------------------------------ paper */

let cached: ResolvedItem[] | null = null;

/**
 * Eight real stage-02 items: five choices, the ordering item, a computed
 * choice and a computed free entry, in an order that puts each layout early.
 */
export async function realPaper(request: APIRequestContext): Promise<ResolvedItem[]> {
  if (cached) return cached;
  const auth = { Authorization: `Bearer ${STAFF}` };
  const bank = (await (await request.get(`${API}/api/v1/console/items`, { headers: auth })).json()) as {
    items: Array<{ id: string; type: "S" | "P" | "G"; stageId: string }>;
  };
  const s02 = bank.items.filter((i) => i.stageId === STAGE);
  const S = s02.filter((i) => i.type === "S");
  const P = s02.filter((i) => i.type === "P");
  const G = s02.filter((i) => i.type === "G");
  if (S.length < 5 || P.length < 2 || G.length < 1) {
    throw new Error(`stage ${STAGE}'s bank is short (S ${S.length}, P ${P.length}, G ${G.length}); is the seed loaded?`);
  }
  const pick = [S[0]!, S[1]!, G[0]!, P[0]!, S[2]!, P[1]!, S[3]!, S[4]!];
  const out: ResolvedItem[] = [];
  for (const [n, it] of pick.entries()) {
    const res = await request.get(`${API}/api/v1/console/items/${it.id}/preview?seed=check-fixture-${n}`, { headers: auth });
    const body = (await res.json()) as { item: ResolvedItem | null };
    if (!body.item) throw new Error(`item ${it.id} did not resolve`);
    const item = { ...body.item, ordinal: n + 1 };
    // The one invention: question 6 is typed, not chosen (see the header).
    out.push(n === 5 ? { ...item, options: [], correctIndex: -1 } : item);
  }
  cached = out;
  return out;
}

/**
 * A moon's journey (WEB-REVAMP 3.7a): EVERY question of one objective, as the
 * API's journey takes them, resolved by the real engine. Stage 01 is open for
 * this student from the start (3.7, Orientation never blocks).
 */
export const MOON_STAGE = "01";
export const MOON = "01.4";
export async function realMoonPaper(request: APIRequestContext, objectiveId = MOON): Promise<ResolvedItem[]> {
  const auth = { Authorization: `Bearer ${STAFF}` };
  const bank = (await (await request.get(`${API}/api/v1/console/items`, { headers: auth })).json()) as {
    items: Array<{ id: string; objectiveId: string | null }>;
  };
  const mine = bank.items.filter((i) => i.objectiveId === objectiveId);
  if (mine.length < 2) throw new Error(`moon ${objectiveId} has ${mine.length} question(s); is the seed loaded?`);
  const out: ResolvedItem[] = [];
  for (const [n, it] of mine.entries()) {
    const res = await request.get(`${API}/api/v1/console/items/${it.id}/preview?seed=journey-fixture-${n}`, { headers: auth });
    const body = (await res.json()) as { item: ResolvedItem | null };
    if (!body.item) throw new Error(`item ${it.id} did not resolve`);
    out.push({ ...body.item, ordinal: n + 1 });
  }
  return out;
}

export function journeyUrl(objectiveId = MOON): string {
  return `/app/stage/${objectiveId.split(".")[0]}/moon/${objectiveId}`;
}

/** The stage 02 check this student would open, read from the real API. */
export async function realAssessment(request: APIRequestContext): Promise<{ id: string; title: string }> {
  const res = await request.get(`${API}/api/v1/stages/${STAGE}`, {
    headers: { Authorization: `Bearer ${STUDENT}` },
  });
  const body = (await res.json()) as { assessment: { id: string; title: string } | null };
  return body.assessment ?? { id: FALLBACK_ASSESSMENT, title: `Stage ${STAGE} Check` };
}

export function checkUrl(a: { id: string; title: string }): string {
  return `/app/stage/${STAGE}/check?a=${encodeURIComponent(a.id)}&t=${encodeURIComponent(a.title)}`;
}

/* ------------------------------------------------------------------ server */

export interface PaperOptions {
  /** `final` withholds verdicts until submit, as `recordAnswer()` does. */
  scope?: "stage" | "final";
  /**
   * Serve a moon's journey for this objective instead of a check: the paper
   * answers `POST /api/v1/objectives/:id/journey`, and `/attempts` is not served.
   */
  journey?: string;
  /** Answers already recorded: the paper arrives resumed. */
  recorded?: Array<{ ordinal: number; answer: unknown }>;
  /** Hold the start this long: the loading state. */
  startDelayMs?: number;
  /** Answer the start with this status and sentence. */
  failStart?: { status: number; message: string };
  /** Drop Record for these ordinals, as a dead connection would. */
  failRecord?: (ordinal: number) => boolean;
  /** Refuse the submit. */
  failSubmit?: boolean;
}

export interface Served {
  /** Every body the fixture sent the page, in order, for the key-leak check. */
  bodies: Array<{ url: string; body: string }>;
  /** What the "database" holds: first write wins. */
  responses: Map<number, { raw: unknown; isCorrect: boolean; points: number }>;
  submitted: boolean;
  /** How many answer POSTs arrived, repeats and failures included. */
  answerPosts: Array<{ ordinal: number; answer: unknown }>;
  /** Leaves and returns the runner reported (ruling 3), in order. */
  events: string[];
}

/**
 * Serve the paper: start, answer, submit. Everything else (the stage, the map,
 * cosmetics) is the real API.
 */
export async function servePaper(page: Page, items: ResolvedItem[], opts: PaperOptions = {}): Promise<Served> {
  const scope = opts.scope ?? "stage";
  const reveal = scope !== "final";
  const served: Served = { bodies: [], responses: new Map(), submitted: false, answerPosts: [], events: [] };
  for (const r of opts.recorded ?? []) {
    const item = items.find((i) => i.ordinal === r.ordinal)!;
    const g = gradeResponse(item, r.answer);
    served.responses.set(r.ordinal, { raw: r.answer, isCorrect: g.isCorrect, points: g.points });
  }

  const send = async (route: Route, status: number, json: unknown) => {
    const body = JSON.stringify(json);
    served.bodies.push({ url: route.request().url(), body });
    await route.fulfill({ status, contentType: "application/json", body });
  };

  const startAt = opts.journey
    ? new RegExp(`/api/v1/objectives/${opts.journey.replace(".", "\\.")}/journey$`)
    : /\/api\/v1\/attempts$/;
  await page.route(startAt, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    if (opts.startDelayMs) await new Promise((r) => setTimeout(r, opts.startDelayMs));
    if (opts.failStart) {
      return send(route, opts.failStart.status, { error: { code: "internal", message: opts.failStart.message } });
    }
    const recorded = [...served.responses.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ordinal, r]) => ({ ordinal, rawAnswer: r.raw, isCorrect: r.isCorrect, points: r.points }));
    return send(route, 200, {
      ...(opts.journey ? { objectiveId: opts.journey } : {}),
      attemptId: ATTEMPT_ID,
      attemptNo: 1,
      resumed: recorded.length > 0,
      totalItems: items.length,
      items: toStudentPaper(items),
      answered: toStudentRecorded(items, recorded, reveal),
    });
  });

  await page.route(/\/api\/v1\/attempts\/[^/]+\/answer$/, async (route) => {
    const { ordinal, answer } = route.request().postDataJSON() as { ordinal: number; answer: unknown };
    served.answerPosts.push({ ordinal, answer });
    if (opts.failRecord?.(ordinal)) return route.abort("failed");
    const item = items.find((i) => i.ordinal === ordinal);
    if (!item) return send(route, 404, { error: { code: "not_found", message: `This paper has no question ${ordinal}.` } });

    const already = served.responses.get(ordinal);
    if (!already) {
      const g = gradeResponse(item, answer);
      served.responses.set(ordinal, { raw: answer, isCorrect: g.isCorrect, points: g.points });
    }
    const kept = served.responses.get(ordinal)!;
    if (!reveal) {
      return send(route, 200, {
        ordinal, recorded: true, verdictWithheld: true,
        alreadyAnswered: Boolean(already), answer: toStudentAnswer(kept.raw),
      });
    }
    return send(route, 200, {
      recorded: true,
      alreadyAnswered: Boolean(already),
      answer: toStudentAnswer(kept.raw),
      ...toStudentVerdict(item, { isCorrect: kept.isCorrect, points: kept.points }),
    });
  });

  await page.route(/\/api\/v1\/attempts\/[^/]+\/events$/, async (route) => {
    served.events.push((route.request().postDataJSON() as { kind: string }).kind);
    return send(route, 201, { recorded: true });
  });

  await page.route(/\/api\/v1\/attempts\/[^/]+\/submit$/, async (route) => {
    if (opts.failSubmit) {
      return send(route, 503, { error: { code: "unavailable", message: "The server could not take the paper just now." } });
    }
    served.submitted = true;
    let score = 0;
    const byObjective: Record<string, { correct: number; total: number }> = {};
    for (const item of items) {
      const r = served.responses.get(item.ordinal);
      const ok = Boolean(r?.isCorrect);
      score += ok ? (r?.points ?? 0) : 0;
      const key = item.objectiveId ?? "unmapped";
      byObjective[key] ??= { correct: 0, total: 0 };
      byObjective[key].total += 1;
      if (ok) byObjective[key].correct += 1;
    }
    const maxScore = items.reduce((n, i) => n + i.points, 0);
    return send(route, 200, {
      attemptId: ATTEMPT_ID,
      alreadySubmitted: false,
      score,
      maxScore,
      mastery: Number((maxScore ? score / maxScore : 0).toFixed(3)),
      byObjective,
      review: items.map((item) => {
        const r = served.responses.get(item.ordinal);
        return toStudentVerdict(item, { isCorrect: Boolean(r?.isCorrect), points: r?.isCorrect ? r.points : 0 });
      }),
    });
  });

  return served;
}

/** An answer that grades correct / not correct for `item`, by the real grader. */
export function answerFor(item: ResolvedItem, correct: boolean): { index: number } | { value: string } | { order: string[] } {
  if (item.type === "G") {
    const key = item.correctValue.split(" | ");
    return { order: correct ? key : [...key].reverse() };
  }
  if (item.options.length === 0) return { value: correct ? item.correctValue : "0" };
  const idx = correct ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
  return { index: idx };
}
