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
