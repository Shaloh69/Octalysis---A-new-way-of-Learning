import type { Page, Route } from "@playwright/test";

/**
 * The /gradebook fixture: the REAL gradebook, patched with the states the seed
 * does not have. Same pattern as `_submissions-fixture.ts`: the layout is
 * tested on real rows, and only what the seed lacks is added.
 *
 * WHAT IS REAL. Every student, ID, section and mark comes from the running
 * API's `computeGradebook()`. The seed has 21 students who all sat stages
 * 01-07, 30 graded labs (lab-03, lab-05, lab-07, out of 100), 8 projects
 * handed in and none marked, no exam sat and no participation: so Quizzes
 * and Labs count, 40% of the grade, and three components have no marks.
 *
 * WHAT IS ADDED, keyed by student ID (user ids are fixed by the demo seed, but
 * the student ID is what a teacher reads):
 *
 *   232129009  stage 06  a real 0%, which must read 0 and not "not sat"
 *   232129020  stage 07  not sat, on a stage the rest of the class has sat
 *   232129014  name      long, with a comma: "Rosales-Villacastín, Trisha Anne Marie"
 *
 * A patched mark is recomputed by `recalc()`, which mirrors
 * `services/api/src/gradebook/compute.ts` for the two components it touches,
 * so a screenshot never shows a final that disagrees with its own row.
 *
 * Options make the states a seeded database cannot: a failed load, a slow one,
 * an empty roster, a course with nothing marked, a failed CSV, and `moons: n`,
 * which gives the class n graded moon checks sat (docs/GRADED-MOONS-PLAN.md): the
 * seed has none, so the Moon checks view is otherwise its honest empty state.
 */

type Pct = number | null;
type Key = "project" | "quizzes" | "exams" | "labs" | "participation";
export interface Student {
  userId: string; studentId: string; fullName: string; section: string | null;
  checks: Record<string, Pct>; moonChecks?: Record<string, Pct>; components: Record<Key, Pct>; unmarked: number; final: Pct;
}
export interface Book {
  components: Array<{ key: Key; label: string; weight: number; covered: boolean; counted: Array<{ id: string; title: string }> }>;
  coverage: number;
  stages: Array<{ id: string; title: string }>;
  students: Student[];
  moons?: Array<{ id: string; title: string }>;
  classAverage: { checks: Record<string, Pct>; moons?: Record<string, Pct>; components: Record<Key, Pct>; final: Pct };
  awaitingMarking: number;
}

export const FIX = {
  zero: { studentId: "232129009", stage: "06" },
  notSat: { studentId: "232129020", stage: "07" },
  long: { studentId: "232129014", name: "Rosales-Villacastín, Trisha Anne Marie" },
  /** Real and untouched: the first row. */
  first: { studentId: "232129001", name: "Juan Miguel Dela Cruz" },
} as const;

const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function recalc(b: Book, s: Student): void {
  const quizzes = b.components.find((c) => c.key === "quizzes")!;
  if (quizzes.covered) s.components.quizzes = r1(mean(quizzes.counted.map((c) => s.checks[c.id] ?? 0))!);
  let w = 0;
  let sum = 0;
  for (const c of b.components) {
    const v = s.components[c.key];
    if (!c.covered || v === null) continue;
    w += c.weight;
    sum += c.weight * v;
  }
  s.final = w === 0 ? null : r1(sum / w);
}

function averages(b: Book): void {
  const avg = (xs: Pct[]) => {
    const m = mean(xs.filter((x): x is number => x !== null));
    return m === null ? null : r1(m);
  };
  for (const st of b.stages) b.classAverage.checks[st.id] = avg(b.students.map((s) => s.checks[st.id] ?? null));
  for (const c of b.components) b.classAverage.components[c.key] = avg(b.students.map((s) => s.components[c.key]));
  b.classAverage.final = avg(b.students.map((s) => s.final));
}

export function patch(b: Book): Book {
  const by = (id: string) => b.students.find((s) => s.studentId === id);
  const zero = by(FIX.zero.studentId);
  if (zero) { zero.checks[FIX.zero.stage] = 0; recalc(b, zero); }
  const notSat = by(FIX.notSat.studentId);
  if (notSat) { notSat.checks[FIX.notSat.stage] = null; recalc(b, notSat); }
  const long = by(FIX.long.studentId);
  if (long) long.fullName = FIX.long.name;
  averages(b);
  return b;
}

/** A course where nothing has been marked: every component uncovered. */
function nothingMarked(b: Book): Book {
  for (const c of b.components) { c.covered = false; c.counted = []; }
  b.coverage = 0;
  for (const s of b.students) {
    for (const k of Object.keys(s.checks)) s.checks[k] = null;
    for (const c of b.components) s.components[c.key] = null;
    s.final = null;
    s.unmarked = 0;
  }
  b.awaitingMarking = 0;
  averages(b);
  return b;
}

export interface FixtureOpts {
  status?: number;
  delayMs?: number;
  empty?: boolean;
  nothingMarked?: boolean;
  csvFail?: boolean;
  /** Give the class this many graded moon checks, sat. The first moon is left unsat by the first student. */
  moons?: number;
}

export const MOON_IDS = (n: number) =>
  Array.from({ length: n }, (_, i) => `${String((i % 7) + 1).padStart(2, "0")}.${Math.floor(i / 7) + 1}`);

/** n graded moon checks, sat by everyone; FIX.first has not sat the first, and one student has a real 0 on the second. */
function withMoons(b: Book, n: number): Book {
  const ids = MOON_IDS(n);
  b.moons = ids.map((id) => ({ id, title: `Moon ${id}: a graded moon of the course` }));
  b.classAverage.moons = {};
  b.students.forEach((s, si) => {
    s.moonChecks = {};
    ids.forEach((id, mi) => {
      const first = s.studentId === FIX.first.studentId;
      s.moonChecks![id] = first && mi === 0 ? null : s.studentId === FIX.zero.studentId && mi === 1 ? 0 : 40 + ((si * 7 + mi * 13) % 61);
    });
  });
  for (const id of ids) {
    const xs = b.students.map((s) => s.moonChecks![id] ?? null).filter((x): x is number => x !== null);
    b.classAverage.moons[id] = xs.length ? r1(xs.reduce((a, c) => a + c, 0) / xs.length) : null;
  }
  return b;
}

export async function useFixture(page: Page, opts: FixtureOpts = {}): Promise<{ book: () => Book | null }> {
  let last: Book | null = null;

  await page.route(/\/api\/v1\/console\/gradebook$/, async (route: Route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.status && opts.status >= 400) {
      return route.fulfill({
        status: opts.status,
        json: { error: { code: "internal", message: "The database did not answer." } },
      });
    }
    const res = await route.fetch();
    let book = patch((await res.json()) as Book);
    if (opts.nothingMarked) book = nothingMarked(book);
    if (opts.moons) book = withMoons(book, opts.moons);
    if (opts.empty) { book.students = []; averages(book); book.awaitingMarking = 0; }
    last = book;
    return route.fulfill({ response: res, json: book });
  });

  await page.route(/\/api\/v1\/console\/gradebook\.csv$/, async (route: Route) => {
    if (opts.csvFail) {
      return route.fulfill({ status: 503, json: { error: { code: "internal", message: "The export could not be built." } } });
    }
    return route.continue();
  });

  return { book: () => last };
}
