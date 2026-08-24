import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ErrorCode } from "@octa/contracts";

/**
 * One error shape, everywhere: { error: { code, message } }.
 * Never a stack trace, never raw SQL, never a Postgres error code.
 *
 * The auth routes additionally collapse several distinct failures into ONE
 * message on purpose — unknown user and wrong password must be indistinguishable,
 * and so must unknown student ID and already-claimed student ID. Anything else is
 * an enumeration oracle.
 */

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  stage_locked: 403,
  blueprint_unsatisfiable: 409,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Detail for the log only. Never serialised to the client. */
  readonly detail?: string;

  constructor(code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export const errors = {
  badRequest: (m = "That request could not be understood.") => new AppError("bad_request", m),
  unauthorized: (m = "Check your ID and password.") => new AppError("unauthorized", m),
  forbidden: (m = "You do not have access to that.") => new AppError("forbidden", m),
  notFound: (m = "That does not exist, or you cannot see it.") => new AppError("not_found", m),
  rateLimited: (m = "Too many attempts. Wait a moment and try again.") => new AppError("rate_limited", m),
  stageLocked: (m: string) => new AppError("stage_locked", m),
  internal: (detail?: string) =>
    new AppError("internal", "Something went wrong on our side. Try again.", detail),
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) {
      if (err.code === "internal") req.log.error({ detail: err.detail }, err.message);
      else req.log.info({ code: err.code }, err.message);
      return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    }

    // Fastify's own validation / rate-limit errors
    const fe = err as { statusCode?: number; message?: string };
    if (fe.statusCode === 429) {
      return reply
        .status(429)
        .send({ error: { code: "rate_limited", message: errors.rateLimited().message } });
    }
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      return reply
        .status(fe.statusCode)
        .send({ error: { code: "bad_request", message: "That request could not be understood." } });
    }

    // Anything unrecognised is logged in full and reported as nothing.
    req.log.error({ err }, "unhandled error");
    return reply
      .status(500)
      .send({ error: { code: "internal", message: "Something went wrong on our side. Try again." } });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: "not_found", message: "No such endpoint." } }),
  );
}
