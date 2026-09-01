import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import pg from "pg";
import { registerErrorHandler } from "./errors.js";
import { registerAttemptRoutes } from "./routes/attempts.js";
import { registerAuthRoutes, makeSupabaseAdmin } from "./routes/auth.js";
import { registerStageRoutes } from "./routes/stages.js";
import { registerCosmeticRoutes } from "./routes/cosmetics.js";
import { registerConsoleRoutes } from "./routes/console.js";
import { registerFeedbackRoutes } from "./routes/feedback.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerSubmissionRoutes } from "./routes/submissions.js";
import { registerLiveRoutes } from "./routes/live.js";
import { registerAssessmentRoutes } from "./routes/assessments.js";
import type { Env } from "./env.js";

/**
 * The API exists because answer keys, seeded generation, grading, and lock
 * resolution must run where students cannot reach them. Everything scored goes
 * through here; the browser owns nothing.
 */
export async function buildServer(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      // Never log a token, a seed, or an answer key.
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.seed",
          "*.exam_salt",
          "*.correct_value",
        ],
        censor: "[redacted]",
      },
    },
    // Render sits behind a proxy; without this every client shares one IP for
    // rate-limiting purposes.
    trustProxy: true,
    disableRequestLogging: env.NODE_ENV === "production",
  });

  registerErrorHandler(app);

  await app.register(cors, {
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
  });

  /**
   * Render Free runs a single instance with an ephemeral filesystem, so this
   * limiter is in-memory and resets on every spin-down. That is a softer
   * guarantee than it looks — see VERIFICATION.md V-26.3. Back it with a
   * Postgres table before relying on it for anything that matters.
   */
  // Relaxed under NODE_ENV=test so an integration suite is not fighting the
  // limiter while exercising engine behaviour. `test/ratelimit.spec.ts` builds a
  // non-test server specifically to prove the limiter still trips.
  const limitScale = env.NODE_ENV === "test" ? 1000 : 1;
  app.decorate("limitScale", limitScale);

  await app.register(rateLimit, {
    global: false,
    max: 100 * limitScale,
    timeWindow: "1 minute",
  });

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    // Free-tier Supabase allows few connections; keep the pool small.
    max: env.NODE_ENV === "production" ? 5 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  app.decorate("db", pool);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  /**
   * /healthz must stay trivially cheap. Supabase Cron pings it every few minutes
   * to keep the free Render instance from spinning down, and a cold start in
   * front of a lecture hall is the worst failure mode in this system.
   *
   * It deliberately does NOT touch the database — a health check that queries
   * Postgres turns a slow database into a dead service.
   */
  app.get("/healthz", async () => ({
    ok: true,
    version: env.ENGINE_VERSION,
    env: env.NODE_ENV,
  }));

  registerAttemptRoutes(app, env);
  registerStageRoutes(app, env);
  registerCosmeticRoutes(app, env);
  registerConsoleRoutes(app, env);
  registerFeedbackRoutes(app, env);
  registerItemRoutes(app, env);
  registerSubmissionRoutes(app, env);
  registerLiveRoutes(app, env);
  registerAssessmentRoutes(app, env);

  // Auth routes need the Supabase Admin API. Without a project configured they
  // are simply not mounted, rather than mounted and failing at request time.
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    registerAuthRoutes(app, env, makeSupabaseAdmin(env));
  } else {
    app.log.warn("SUPABASE_URL / service role not set - auth routes not mounted");
  }

  /** Readiness DOES check the database, and is not what the keep-alive pings. */
  app.get("/readyz", async (_req, reply) => {
    try {
      await pool.query("select 1");
      return { ok: true, db: "up" };
    } catch {
      return reply.status(503).send({ error: { code: "internal", message: "Database unreachable." } });
    }
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool;
    limitScale: number;
  }
}
