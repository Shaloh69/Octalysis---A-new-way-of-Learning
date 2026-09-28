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

/* ============================================================
 * Environment
 *
 * Split is the security boundary, not a convention:
 *   ClientEnv  -> inlined into the bundle by Vite. Treat as published.
 *   ServerEnv  -> services/api only. Never prefixed VITE_.
 * ========================================================== */

export const ClientEnv = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_URL: z.string().url(),
  VITE_APP_VERSION: z.string().default("0.0.0-dev"),
  VITE_APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  VITE_SENTRY_DSN: z.string().optional(),
});
export type ClientEnv = z.infer<typeof ClientEnv>;

export const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  /** Direct Postgres. Local Docker in development; Supabase pooler in production. */
  DATABASE_URL: z.string().min(1),

  /** Absent in local Docker mode, required once a Supabase project exists. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  JWT_AUDIENCE: z.string().default("authenticated"),
  JWT_ISSUER: z.string().optional(),

  /** Master salt. Per-assessment salts derive from it; never stored client-readable. */
  EXAM_SALT_SECRET: z.string().min(32, "EXAM_SALT_SECRET must be at least 32 chars"),

  /** Pins the solver registry. Must match attempts.engine_version to regenerate a paper. */
  ENGINE_VERSION: z.string().default("1.0.0"),

  /** Explicit origin list. Never '*'. */
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:5174")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),

  /** Authenticates Supabase Cron -> /internal/* calls. */
  CRON_SECRET: z.string().min(16).optional(),

  SENTRY_DSN: z.string().optional(),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

/**
 * Names that must never appear with a VITE_ prefix. Checked in CI and at boot —
 * Vite inlines every VITE_* into the client bundle, so one of these leaking is
 * a published secret, not a misconfiguration.
 */
export const SERVER_ONLY_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "EXAM_SALT_SECRET",
  "DATABASE_URL",
  "CRON_SECRET",
  "SENTRY_DSN",
] as const;

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
  "locks", "roster", "items", "assessments", "submissions", "content", "accounts", "feedback",
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
