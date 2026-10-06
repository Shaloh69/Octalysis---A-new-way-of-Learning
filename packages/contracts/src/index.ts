import { z } from "zod";

/* ============================================================
 * Errors — one shape, everywhere.
 * Never a stack trace, never raw SQL. See services/api/CLAUDE.md.
 * ========================================================== */

export const ErrorCode = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "stage_locked",
  "blueprint_unsatisfiable",
  // The class chat while the student has a paper open (ruling 3, 6 Oct 2026).
  "paper_open",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/* ============================================================
 * Domain primitives
 * ========================================================== */

/** Stage ids are the two-character strings seeded in db/schema.sql: '00'..'17'. */
export const StageId = z.string().regex(/^\d{2}$/, "stage id must be two digits, '00'-'17'");
export type StageId = z.infer<typeof StageId>;

export const UserRole = z.enum(["student", "teacher", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const Archetype = z.enum(["A", "B", "C", "D"]);
export type Archetype = z.infer<typeof Archetype>;

/** Computer Level Hierarchy: L6 user level down to L0 digital logic. */
export const Level = z.number().int().min(0).max(6);
export type Level = z.infer<typeof Level>;

export const Competency = z.enum(["read", "trace", "build"]);
export type Competency = z.infer<typeof Competency>;

export const Theme = z.enum(["bare-metal", "blueprint", "phosphor"]);
export type Theme = z.infer<typeof Theme>;

/* ============================================================
 * Cosmetics — GET /api/v1/cosmetics. What a student LOOKS at, never
 * what they can do (SOLAR-SYSTEM-SPEC.md §3). Derived server-side in
 * services/api/src/routes/cosmetics.ts from the student id alone.
 * ========================================================== */

/** The seven landing biomes, in the server's order (`BIOMES`; a test pins it). */
export const Biome = z.enum(["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"]);
export type Biome = z.infer<typeof Biome>;

export const Cosmetics = z.object({
  /** Radians, 0 to 2π: one angle for the whole system. */
  rotationOffset: z.number().min(0).max(Math.PI * 2),
  paletteVariant: z.number().int().min(0),
  /** A registry-style name, never an identifier. */
  callsign: z.string().regex(/^[A-Z]+-[0-9A-F]{2}$/),
  /**
   * The student's one seeded biome, from before planets had their own. Kept
   * because the 3D map still tints its planets from it; a page decides a
   * planet's look from `planetBiomes`, never from this.
   */
  biomeIndex: z.number().int().min(0),
  themeIndex: z.number().int().min(0),
  /** 0-359. A hue, never a hex: lightness and chroma are fixed per colour set. */
  accentHue: z.number().int().min(0).max(359),
  version: z.string(),
  biomes: z.array(Biome),
  themes: z.array(Theme),
  /**
   * WEB-REMAKE.md §1 (30 Sep 2026): one biome per planet, seeded from student
   * and stage, for every stage the caller can see. A moon wears its planet's:
   * resolve one with `planetOf`.
   */
  planetBiomes: z.record(StageId, Biome),
});
export type Cosmetics = z.infer<typeof Cosmetics>;

/**
 * The planet a body belongs to: a moon (an objective, "06.3") to its stage
 * ("06"), and a planet to itself. The one rule for "a moon wears its planet's
 * biome", shared so the API and the client cannot disagree about it.
 */
export function planetOf(bodyId: string): string {
  const dot = bodyId.indexOf(".");
  return dot < 0 ? bodyId : bodyId.slice(0, dot);
}

/** Mastery is always a proportion. The DB enforces the same range (V-23). */
export const Mastery = z.number().min(0).max(1);

/* ============================================================
 * The stage map — the shape apps/web renders.
 *
 * `locked` is ALWAYS the server's answer from is_stage_unlocked().
 * The client renders a lock; it never computes one (hard rule 4).
 * ========================================================== */

export const LockReason = z.object({
  /** Machine-readable cause, so the UI can pick copy without parsing prose. */
  kind: z.enum(["prereq", "override", "not_published", "window_closed", "not_yet_open"]),
  /** Stage ids still standing between the student and this node. */
  blockingStages: z.array(StageId).default([]),
  /** Present for `prereq`: how far off they are, so the UI can say the distance. */
  requiredMastery: Mastery.optional(),
  currentMastery: Mastery.optional(),
  /** Human sentence, authored server-side. Always populated. */
  message: z.string(),
});
export type LockReason = z.infer<typeof LockReason>;

export const StageNodeState = z.enum(["locked", "available", "in_progress", "mastered"]);
export type StageNodeState = z.infer<typeof StageNodeState>;

export const StageNode = z.object({
  id: StageId,
  act: z.number().int().min(1).max(4),
  ordinal: z.number().int().min(0),
  title: z.string(),
  summary: z.string().nullable(),
  estMinutes: z.number().int().positive(),
  archetype: Archetype,
  levels: z.array(Level),
  gradeable: z.boolean(),
  prereq: z.array(StageId),
  state: StageNodeState,
  mastery: Mastery,
  /**
   * The stage's objectives — the moons around its planet.
   *
   * These were being sent by `/api/v1/stages` and consumed by the web app
   * while this schema did not declare them at all, which is precisely the
   * drift "Zod at every API boundary" exists to prevent. Declared now.
   *
   * `description` is the objective's authored sentence, and it is what the
   * planet sidebar labels each moon with. Without it a selection list reads
   * "05.1 L0" and names nothing.
   */
  objectives: z.array(
    z.object({
      id: z.string(),
      level: Level,
      description: z.string(),
    }),
  ),
  /** Non-null if and only if `state === 'locked'`. */
  lockReason: LockReason.nullable(),
});
export type StageNode = z.infer<typeof StageNode>;

export const StageMap = z.object({
  nodes: z.array(StageNode),
  /** Derived server-side so the client never recomputes the graph. */
  edges: z.array(z.object({ from: StageId, to: StageId })),
  generatedAt: z.string().datetime(),
});
export type StageMap = z.infer<typeof StageMap>;

/* The environment schemas are in ./env.ts, the subpath `@octa/contracts/env`,
 * so that no app bundle compiles in the API's secret names (30 Sep 2026). */

/* ============================================================
 * The item bank — import, export, bulk review.
 *
 * `PAGE-SPECS.md` planned "bulk approve drafts" and "import/export JSON" for
 * /items; the instructor approved both on 25 Sep 2026. The file shape is the
 * AUTHORED shape of `content/items/NN.json`, on purpose: an exported item can
 * be committed straight into the repo, and a file from the repo can be
 * imported, so there is one way to write an item down rather than two.
 * ========================================================== */

export const ItemType = z.enum(["S", "P", "G"]);
export type ItemType = z.infer<typeof ItemType>;

export const ItemBloom = z.enum(["remember", "understand", "apply", "analyze"]);
export type ItemBloom = z.infer<typeof ItemBloom>;

export const ItemStatus = z.enum(["draft", "review", "live", "retired"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

/**
 * One item as a person writes it. Loose on purpose: which fields a type needs
 * (S: stem, correct, distractors; G: stem, order; P: solver) is checked by the
 * API's import planner, which can name the rule an item broke. A schema union
 * could only say "invalid".
 */
export const AuthoredItem = z.object({
  slug: z.string().trim(),
  /** Per item in an export; a stage file carries it once at the top instead. */
  stageId: StageId.optional(),
  objective: z.string().trim().max(20),
  type: ItemType,
  bloom: ItemBloom,
  difficulty: z.number().min(0).max(1).optional(),
  stem: z.string().optional(),
  correct: z.string().optional(),
  distractors: z.array(z.string()).optional(),
  order: z.array(z.string()).optional(),
  take: z.number().int().min(2).optional(),
  solver: z.string().trim().optional(),
  rationale: z.string().nullable().optional(),
  /** Where the item came from. Required for anything new or changed. */
  source: z.string().nullable().optional(),
});
export type AuthoredItem = z.infer<typeof AuthoredItem>;

export const ITEM_FILE_FORMAT = "octa-items/1";

export const ItemFile = z.object({
  format: z.literal(ITEM_FILE_FORMAT).optional(),
  exportedAt: z.string().optional(),
  stageId: StageId.optional(),
  items: z.array(AuthoredItem).min(1).max(1000),
});
export type ItemFile = z.infer<typeof ItemFile>;

export const ItemImportRequest = z.object({
  /** A dry run writes nothing. The console always sends one first. */
  dryRun: z.boolean(),
  file: ItemFile,
});
export type ItemImportRequest = z.infer<typeof ItemImportRequest>;

/**
 * What an import does to one item.
 *
 * - `create`    a new slug, inserted as a DRAFT authored by the importer
 * - `version`   an existing draft/review item with different content: a new
 *               draft version in the same family; the old row is retired
 *               (hard rule 6 -- never edited in place)
 * - `unchanged` identical to what the bank already holds
 * - `refused`   the bank's copy is live or retired; an import never pulls a
 *               live item out from under students
 * - `invalid`   breaks a rule; `reasons` says which
 */
export const ItemImportAction = z.enum(["create", "version", "unchanged", "refused", "invalid"]);
export type ItemImportAction = z.infer<typeof ItemImportAction>;

export const ItemImportRow = z.object({
  slug: z.string(),
  stageId: z.string().nullable(),
  action: ItemImportAction,
  reasons: z.array(z.string()),
});
export type ItemImportRow = z.infer<typeof ItemImportRow>;

export const ItemImportResult = z.object({
  dryRun: z.boolean(),
  applied: z.boolean(),
  rows: z.array(ItemImportRow),
  counts: z.object({
    create: z.number().int(),
    version: z.number().int(),
    unchanged: z.number().int(),
    refused: z.number().int(),
    invalid: z.number().int(),
  }),
});
export type ItemImportResult = z.infer<typeof ItemImportResult>;

/**
 * Bulk review moves DRAFTS INTO REVIEW, and nothing else.
 *
 * `to` is a literal on purpose. Publishing stays one decision per item, by a
 * reviewer who is not the author: bulk-publishing is how a wrong key reaches a
 * live bank, and `apps/console/CLAUDE.md`'s review queue advances item by item
 * precisely so nobody is pushed towards rubber-stamping.
 */
export const ItemBulkStatusRequest = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  to: z.literal("review"),
});
export type ItemBulkStatusRequest = z.infer<typeof ItemBulkStatusRequest>;

export const ItemBulkStatusResult = z.object({
  moved: z.array(z.string()),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
});
export type ItemBulkStatusResult = z.infer<typeof ItemBulkStatusResult>;

export const ItemExportRequest = z.object({
  ids: z.array(z.string().uuid()).min(1).max(2000),
});
export type ItemExportRequest = z.infer<typeof ItemExportRequest>;

/* ============================================================
 * Gradebook
 * ========================================================== */

/**
 * The syllabus's five grade components, in the syllabus's order
 * (`docs/CPE412-CURRICULUM.md` §1.1).
 *
 * The weights are FIXED, by instructor decision on 28 Sep 2026: they are the
 * syllabus's, and changing them mid-term is a grading-policy change, not a
 * setting. `PAGE-SPECS.md`'s "weighting configuration" is deferred on purpose
 * and says so in `design/templates/console/gradebook/SPEC.md`.
 */
export const GradeComponent = z.enum(["project", "quizzes", "exams", "labs", "participation"]);
export type GradeComponent = z.infer<typeof GradeComponent>;

export const GRADE_WEIGHTS: Readonly<Record<GradeComponent, number>> = {
  project: 20,
  quizzes: 30,
  exams: 30,
  labs: 10,
  participation: 10,
};

export const GRADE_COMPONENT_LABELS: Readonly<Record<GradeComponent, string>> = {
  project: "Project",
  quizzes: "Quizzes",
  exams: "Major exams",
  labs: "Laboratory exercises",
  participation: "Class participation",
};

/** A percentage, 0-100, or null: nothing to count yet. */
const Pct = z.number().min(0).max(100).nullable();

export const GradebookStudent = z.object({
  userId: z.string().uuid(),
  studentId: z.string(),
  fullName: z.string(),
  section: z.string().nullable(),
  /** Best stage-check score per gradeable stage. null = NOT SAT, which is not 0. */
  checks: z.record(z.string(), Pct),
  /** Per component. null = nothing of this student's counts yet. */
  components: z.record(GradeComponent, Pct),
  /** Handed in and not yet counted: submitted, or returned for revision. */
  unmarked: z.number().int().min(0),
  /** Weighted over the components the class has marks in; null when none do. */
  final: Pct,
});
export type GradebookStudent = z.infer<typeof GradebookStudent>;

export const GradebookComponentInfo = z.object({
  key: GradeComponent,
  label: z.string(),
  weight: z.number(),
  /** The class has at least one mark in it, so it counts toward the final. */
  covered: z.boolean(),
  /** What it is made of so far: the stage checks, exams or deliverables with marks. */
  counted: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type GradebookComponentInfo = z.infer<typeof GradebookComponentInfo>;

export const Gradebook = z.object({
  components: z.array(GradebookComponentInfo),
  /** Share of the grade, in percent, that the final so far is computed over. */
  coverage: z.number().min(0).max(100),
  stages: z.array(z.object({ id: z.string(), title: z.string() })),
  students: z.array(GradebookStudent),
  classAverage: z.object({
    checks: z.record(z.string(), Pct),
    components: z.record(GradeComponent, Pct),
    final: Pct,
  }),
  /** Handed in across the class and waiting on a mark (status = submitted). */
  awaitingMarking: z.number().int().min(0),
});
export type Gradebook = z.infer<typeof Gradebook>;

/* ============================================================
 * Audit log
 * ========================================================== */

/**
 * What the course audits, by family: an action's key before the dot. The
 * `/audit` Action filter and the CSV both use these, so the page and the file
 * cannot group an entry differently.
 */
export const AuditFamily = z.enum([
  "locks", "roster", "items", "assessments", "submissions", "content", "accounts", "feedback", "live", "chat",
]);
export type AuditFamily = z.infer<typeof AuditFamily>;

export const AUDIT_FAMILY_PREFIXES: Readonly<Record<AuditFamily, readonly string[]>> = {
  locks: ["lock"],
  roster: ["roster", "auth"],
  items: ["item"],
  assessments: ["assessment"],
  submissions: ["submission"],
  content: ["content", "summary"],
  accounts: ["account", "admin"],
  feedback: ["feedback"],
  live: ["live"],
  chat: ["chat"],
};

export const AUDIT_FAMILY_LABELS: Readonly<Record<AuditFamily, string>> = {
  locks: "Locks",
  roster: "Roster",
  items: "Items",
  assessments: "Assessments",
  submissions: "Submissions",
  content: "Content & summaries",
  accounts: "Accounts",
  feedback: "Feedback",
  live: "Lecture Mode",
  chat: "Class chat",
};

/**
 * `GET /console/audit` and `/console/audit.csv`. Every filter runs on the
 * server over the whole log (instructor, 28 Sep 2026): before that the page
 * filtered only the newest few hundred rows it had loaded.
 */
export const AuditQuery = z
  .object({
    family: AuditFamily.optional(),
    /** A user id, or `system`: the entries no person made (the pg_cron lock windows). */
    actor: z.union([z.string().uuid(), z.literal("system")]).optional(),
    /** About whom or what: a student's name or ID, a target and its label, or words of the reason. */
    q: z.string().trim().min(1).max(100).optional(),
    /** Inclusive. The console sends the teacher's local midnight. */
    from: z.string().datetime({ offset: true }).optional(),
    /** Exclusive. */
    to: z.string().datetime({ offset: true }).optional(),
    /** The keyset cursor: entries older than this entry id. */
    before: z.string().regex(/^\d{1,19}$/).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .refine((v) => !v.from || !v.to || Date.parse(v.from) < Date.parse(v.to), {
    message: "The start of the range must be before its end.",
  });
export type AuditQuery = z.infer<typeof AuditQuery>;

export const AuditEntry = z.object({
  id: z.string(),
  at: z.string(),
  action: z.string(),
  family: AuditFamily.nullable(),
  /** One sentence, written by the API so the page and the CSV cannot disagree. */
  what: z.string(),
  /** null: no person did it (a scheduled lock window). */
  actor: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  /** The student the entry is about, when it is about one. */
  subject: z.object({ userId: z.string().nullable(), name: z.string(), studentId: z.string().nullable() }).nullable(),
  target: z.object({ type: z.string(), id: z.string().nullable(), label: z.string() }).nullable(),
  reason: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AuditPage = z.object({
  entries: z.array(AuditEntry),
  /** Pass as `before` for the next, older page; null when nothing older matches. */
  next: z.string().nullable(),
  /** Every entry the filter matches, whatever the cursor. */
  total: z.number().int().min(0),
  /** Everyone who appears in the log, for the Who filter; `id: null` is the scheduler. */
  actors: z.array(z.object({ id: z.string().nullable(), name: z.string() })),
});
export type AuditPage = z.infer<typeof AuditPage>;

/* ============================================================
 * System health: `run_invariants()`, live, plus the nightly record
 * ========================================================== */

/** The areas of `db/addendum-audit.sql`, in the order the page shows them. */
export const InvariantArea = z.enum([
  "security", "accounts", "papers", "bank", "curriculum", "content", "feedback",
]);
export type InvariantArea = z.infer<typeof InvariantArea>;

export const INVARIANT_AREA_LABELS: Readonly<Record<InvariantArea, string>> = {
  security: "Security",
  accounts: "Accounts",
  papers: "Papers and grading",
  bank: "Item bank",
  curriculum: "Curriculum and map",
  content: "Content and locks",
  feedback: "Feedback",
};

export const InvariantSeverity = z.enum(["fail", "warn", "notice"]);
export type InvariantSeverity = z.infer<typeof InvariantSeverity>;

export const InvariantResult = z.object({
  id: z.string(),
  /** The database function, e.g. `inv_18_bank_starvation`. */
  name: z.string(),
  /** As presented: `notice` only when the table the check reads is empty. */
  severity: InvariantSeverity,
  /** As `run_invariants()` gave it. */
  dbSeverity: z.enum(["fail", "warn"]),
  offendingCount: z.number().int().min(0),
  /** The first five offending rows, every column the function returns. */
  sample: z.array(z.record(z.string(), z.unknown())),
  area: InvariantArea,
  title: z.string(),
  checks: z.string(),
  protects: z.string(),
  action: z.string(),
  /** Why a check with offenders is a notice rather than its own severity. */
  noticeReason: z.string().nullable(),
});
export type InvariantResult = z.infer<typeof InvariantResult>;

/** One row of `audit_runs`, written nightly by pg_cron's `run_invariants_nightly()`. */
export const InvariantRun = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  /** 'cron' | 'deploy' | a staff member's uuid. */
  triggeredBy: z.string(),
  /** Ids with offenders at `fail`, counted from the run's own stored results. */
  failing: z.array(z.string()),
  warning: z.array(z.string()),
  checks: z.number().int().min(0),
});
export type InvariantRun = z.infer<typeof InvariantRun>;

export const SystemAudit = z.object({
  results: z.array(InvariantResult),
  failing: z.number().int().min(0),
  ranAt: z.string(),
  tookMs: z.number().int().min(0),
  /** The last 14 nightly runs, newest first. */
  runs: z.array(InvariantRun),
});
export type SystemAudit = z.infer<typeof SystemAudit>;

/* ============================================================
 * Feedback: the staff triage queue
 * ========================================================== */

export const FeedbackStatus = z.enum(["new", "triaged", "in_progress", "shipped", "wont_fix"]);
export type FeedbackStatus = z.infer<typeof FeedbackStatus>;

export const FEEDBACK_STATUS_LABELS: Readonly<Record<FeedbackStatus, string>> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  shipped: "Shipped",
  wont_fix: "Won't fix",
};

/** What the queue holds. SUS responses are not reports; they are the panel. */
export const FeedbackKind = z.enum(["flag", "content_report", "csat"]);
export type FeedbackKind = z.infer<typeof FeedbackKind>;

export const FEEDBACK_KIND_LABELS: Readonly<Record<FeedbackKind, string>> = {
  flag: "Flag",
  content_report: "Question report",
  csat: "Satisfaction (CSAT)",
};

export const FeedbackSeverity = z.enum(["low", "medium", "high"]);
export type FeedbackSeverity = z.infer<typeof FeedbackSeverity>;

export const FeedbackQuery = z
  .object({
    status: FeedbackStatus.optional(),
    kind: FeedbackKind.optional(),
    /** A group cursor from `next`: groups last reported before it. */
    before: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
export type FeedbackQuery = z.infer<typeof FeedbackQuery>;

export const FeedbackReport = z.object({
  id: z.string(),
  reporterName: z.string().nullable(),
  role: z.string(),
  createdAt: z.string(),
  route: z.string().nullable(),
  appVersion: z.string().nullable(),
  category: z.string().nullable(),
  /** CSAT, 1-5. */
  rating: z.number().int().nullable(),
  /** What the client attached automatically: viewport, user agent, last events. */
  context: z.record(z.string(), z.unknown()),
  /** The exact instance a question report was about, rebuilt by the server. */
  resolvedVariant: z.unknown().nullable(),
});
export type FeedbackReport = z.infer<typeof FeedbackReport>;

/** Exact repeats: the same kind, item, route, status and text (trimmed, case folded). */
export const FeedbackGroup = z.object({
  key: z.string(),
  status: FeedbackStatus,
  kind: FeedbackKind,
  category: z.string().nullable(),
  body: z.string().nullable(),
  severity: FeedbackSeverity.nullable(),
  releasedIn: z.string().nullable(),
  item: z.object({ id: z.string(), slug: z.string().nullable() }).nullable(),
  route: z.string().nullable(),
  count: z.number().int().min(1),
  firstAt: z.string(),
  lastAt: z.string(),
  triagedBy: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  triagedAt: z.string().nullable(),
  /** Newest first. */
  reports: z.array(FeedbackReport),
});
export type FeedbackGroup = z.infer<typeof FeedbackGroup>;

const SusFigure = z.object({ n: z.number().int().min(0), mean: z.number().nullable() });

export const FeedbackQueue = z.object({
  groups: z.array(FeedbackGroup),
  /** Pass as `before` for the next, older page; null when nothing older matches. */
  next: z.string().nullable(),
  /** Everything the filter matches, cursor aside. */
  total: z.object({ groups: z.number().int().min(0), reports: z.number().int().min(0) }),
  /** Reports per status for the current kind, status filter aside: the filter's own counts. */
  counts: z.record(FeedbackStatus, z.number().int().min(0)),
  /** PAGE-SPECS.md 4.3: students and staff reported separately, each with its n. */
  sus: z.object({ student: SusFigure, staff: SusFigure }),
});
export type FeedbackQueue = z.infer<typeof FeedbackQueue>;

export const FeedbackBulkTriage = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    status: FeedbackStatus,
    /** null clears it; absent leaves it. */
    severity: FeedbackSeverity.nullable().optional(),
    releasedIn: z.string().trim().max(50).nullable().optional(),
  })
  .strict();
export type FeedbackBulkTriage = z.infer<typeof FeedbackBulkTriage>;

/* ------------------------------------------------------------------ Lecture Mode */

/**
 * Below this many people, an aggregate names them. With four students in a
 * room, "3 of 4 got it" plus one visible face is not anonymous, so the server
 * sends no figure at all rather than one the page declines to draw.
 */
export const LIVE_MIN_COHORT = 5;

/**
 * `GET /console/live`: what the room is doing, in aggregate. It is also what the
 * projector reads, so NOTHING here identifies a person: no name, student ID or
 * user ID is selected for it, and not even the teacher who started a question
 * (that is in `/audit`).
 */
export const LiveStage = z.object({
  stageId: z.string(),
  title: z.string(),
  /** Students with any progress on this stage: a count of people, never who. */
  students: z.number().int().min(0),
  /** Their average best mastery, 0-100. null: fewer than LIVE_MIN_COHORT, withheld by the server. */
  avgMastery: z.number().int().min(0).max(100).nullable(),
});
export type LiveStage = z.infer<typeof LiveStage>;

export const LiveSession = z.object({
  id: z.string().uuid(),
  itemSlug: z.string(),
  itemType: z.enum(["S", "P", "G"]),
  stageId: z.string(),
  stageTitle: z.string(),
  /** The objective's own wording. Never the stem: a stem beside the split hands the answer out. */
  objective: z.string().nullable(),
  /** Who may answer it: a section code, or null for everyone. */
  section: z.string().nullable(),
  startedAt: z.string(),
  answered: z.number().int().min(0),
  /** How many answered correctly. null: fewer than LIVE_MIN_COHORT have answered, withheld. */
  correct: z.number().int().min(0).nullable(),
});
export type LiveSession = z.infer<typeof LiveSession>;

export const LiveSnapshot = z.object({
  /** Students with a paper started or answered in the last 20 minutes. */
  cohort: z.number().int().min(0),
  minCohort: z.number().int().min(1),
  stages: z.array(LiveStage),
  /** The one question running, or null. One at a time: a lecture hall has one projector. */
  session: LiveSession.nullable(),
  at: z.string(),
});
export type LiveSnapshot = z.infer<typeof LiveSnapshot>;

/** `GET /console/live/options`: what a question can be started with. */
export const LiveOptions = z.object({
  /** LIVE items only. An item at draft or review has not been approved for any student. */
  items: z.array(
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      type: z.enum(["S", "P", "G"]),
      stageId: z.string(),
      stageTitle: z.string(),
      objective: z.string().nullable(),
    }),
  ),
  sections: z.array(z.object({ id: z.string().uuid(), code: z.string() })),
});
export type LiveOptions = z.infer<typeof LiveOptions>;

const LiveReason = z.string().trim().min(3, "Say why, in a few words.").max(500);

/** `POST /console/live/sessions`. Starting changes what students may answer, so it is audited with a reason. */
export const LiveStartBody = z
  .object({
    itemId: z.string().uuid(),
    /** null: everyone may answer. */
    sectionId: z.string().uuid().nullable(),
    reason: LiveReason,
  })
  .strict();
export type LiveStartBody = z.infer<typeof LiveStartBody>;

/** `POST /console/live/sessions/:id/end`. */
export const LiveEndBody = z.object({ reason: LiveReason }).strict();
export type LiveEndBody = z.infer<typeof LiveEndBody>;

/* ---------------------------------------------------------------------------
 * Sitting a paper (instructor ruling 3, 30 Sep 2026; WEB-REMAKE.md §4a).
 * What the runner reports when a student leaves the paper, and when they come
 * back. The server stamps the time; the client never supplies one.
 * ------------------------------------------------------------------------- */
export const AttemptEventKind = z.enum(["left_fullscreen", "left_page", "returned", "fullscreen_unavailable"]);
export type AttemptEventKind = z.infer<typeof AttemptEventKind>;

export const AttemptEventBody = z.object({ kind: AttemptEventKind }).strict();
export type AttemptEventBody = z.infer<typeof AttemptEventBody>;

/** The kinds that count as leaving the paper, for the console's tally. */
export const LEAVING_KINDS: readonly AttemptEventKind[] = ["left_fullscreen", "left_page"];

/* ---------------------------------------------------------------------------
 * The class chat (instructor, approved 6 Oct 2026; docs/CHAT-PLAN.md).
 * One room per section and one private thread per student with the
 * instructor. Writes go through the API; reads too, with Supabase Realtime
 * saying WHEN to read again. A student with a paper open gets `paper_open`.
 * ------------------------------------------------------------------------- */
/** Ruling 2: 25 MB per attachment. The bucket refuses more whoever signed it. */
export const CHAT_MAX_BYTES = 25 * 1024 * 1024;
/** Supabase Free's whole storage, which the attachments view measures against. */
export const CHAT_STORAGE_BYTES = 1024 * 1024 * 1024;
export const CHAT_BODY_MAX = 4000;
export const ChatMime = z.enum([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
export type ChatMime = z.infer<typeof ChatMime>;

export const ChatPerson = z.object({
  id: z.string().uuid(),
  name: z.string(),
  staff: z.boolean(),
});
export type ChatPerson = z.infer<typeof ChatPerson>;

export const ChatRoom = z.object({
  id: z.string().uuid(),
  kind: z.enum(["section", "direct"]),
  /** "BSCPE-2A", or the other side of a private thread. */
  title: z.string(),
  /** One line saying who is in it. */
  subtitle: z.string(),
  /** Messages by others since you last opened it. */
  unread: z.number().int().min(0),
  /** Of those, how many @mention you. */
  mentions: z.number().int().min(0),
  lastAt: z.string().nullable(),
});
export type ChatRoom = z.infer<typeof ChatRoom>;

export const ChatRooms = z.object({
  me: ChatPerson,
  rooms: z.array(ChatRoom),
  /** False where no file storage is configured (the local stack): no attach control. */
  attachments: z.boolean(),
});
export type ChatRooms = z.infer<typeof ChatRooms>;

export const ChatAttachment = z.object({
  name: z.string(),
  mime: ChatMime,
  bytes: z.number().int().min(1),
  /** A short-lived signed link. null where storage is not configured. */
  url: z.string().nullable(),
});
export type ChatAttachment = z.infer<typeof ChatAttachment>;

export const ChatMessage = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  author: ChatPerson,
  /** null for a deleted message, or one that is only an attachment. */
  body: z.string().nullable(),
  mentions: z.array(z.string().uuid()),
  attachment: ChatAttachment.nullable(),
  /** The attachment was removed to free storage; the message stays. */
  attachmentRemoved: z.boolean(),
  deleted: z.boolean(),
  mine: z.boolean(),
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatThread = z.object({
  room: ChatRoom,
  /** Oldest first, the latest 100 (or the 100 before `before`). */
  messages: z.array(ChatMessage),
  /** Whether older messages exist before the first one sent. */
  more: z.boolean(),
  /** Who can be @mentioned here. */
  members: z.array(ChatPerson),
});
export type ChatThread = z.infer<typeof ChatThread>;

export const ChatPostBody = z
  .object({
    body: z.string().trim().max(CHAT_BODY_MAX).optional(),
    mentions: z.array(z.string().uuid()).max(50).default([]),
    /** A path the API signed for this room and this author. */
    attachment: z.object({ path: z.string().min(1).max(400), name: z.string().trim().min(1).max(200) }).strict().optional(),
  })
  .strict()
  .refine((b) => (b.body !== undefined && b.body.length > 0) || b.attachment !== undefined, {
    message: "Write something or attach a file.",
  });
export type ChatPostBody = z.infer<typeof ChatPostBody>;

export const ChatUploadBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    mime: ChatMime,
    bytes: z.number().int().min(1).max(CHAT_MAX_BYTES),
  })
  .strict();
export type ChatUploadBody = z.infer<typeof ChatUploadBody>;

/** Where to PUT the file: a one-time signed upload, and the path to post with. */
export const ChatUpload = z.object({ path: z.string(), uploadUrl: z.string().url() });
export type ChatUpload = z.infer<typeof ChatUpload>;

export const ChatUnread = z.object({
  /** Messages that @mention you, unread. Shown on the Chat nav item. */
  mentions: z.number().int().min(0),
  /** A paper is open: chat is closed until it is submitted. */
  closed: z.boolean(),
});
export type ChatUnread = z.infer<typeof ChatUnread>;

/** The instructor's storage view: every attachment still held, oldest first. */
export const ChatStoredAttachment = z.object({
  messageId: z.string().uuid(),
  room: z.string(),
  author: z.string(),
  name: z.string(),
  mime: ChatMime,
  bytes: z.number().int().min(1),
  createdAt: z.string(),
});
export type ChatStoredAttachment = z.infer<typeof ChatStoredAttachment>;

export const ChatAttachments = z.object({
  usedBytes: z.number().int().min(0),
  limitBytes: z.number().int().min(1),
  items: z.array(ChatStoredAttachment),
});
export type ChatAttachments = z.infer<typeof ChatAttachments>;

/** Staff moderation and storage housekeeping change what students see: a reason, audited. */
const ChatReason = z.string().trim().min(3, "Say why, in a few words.").max(500);
export const ChatReasonBody = z.object({ reason: ChatReason }).strict();
export type ChatReasonBody = z.infer<typeof ChatReasonBody>;

export const ChatPruneBody = z.object({ olderThanDays: z.number().int().min(1).max(365), reason: ChatReason }).strict();
export type ChatPruneBody = z.infer<typeof ChatPruneBody>;

export const ChatThreadBody = z.object({ userId: z.string().uuid() }).strict();
export type ChatThreadBody = z.infer<typeof ChatThreadBody>;
