import { z } from "zod";

/*
 * The environment schemas, on their own subpath: `@octa/contracts/env`.
 *
 * They lived in the package's main entry until 30 Sep 2026, and every app that
 * imported anything from `@octa/contracts` at runtime compiled them in: Zod
 * schemas are module-level calls, so they are not tree-shaken. That put the
 * NAMES `EXAM_SALT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in the console's
 * bundle (NEXT-SESSION §0p.16), and on 30 Sep in the student's too, the day
 * apps/web first imported a runtime value (`Biome`, `planetOf`) from the
 * package. Names, not values, but `pnpm scan:bundle` is a gate and it was red.
 *
 * Only services/api imports this file. An app never should.
 */

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
