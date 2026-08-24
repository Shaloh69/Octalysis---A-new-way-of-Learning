import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import pg from "pg";
import { registerErrorHandler } from "./errors.js";
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
  await app.register(rateLimit, {
    global: false,
    max: 100,
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
  }
}
