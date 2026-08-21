import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import { createLicenseValidationCache } from "./cache/license-validation.js";
import { NoopCacheStore } from "./cache/noop.js";
import type { CacheStore } from "./cache/store.js";
import type { AppConfig } from "./config.js";
import type { SqlClient } from "./db/sql.js";
import { ApiError, apiError } from "./http/errors.js";
import { registerDiscoveryRoutes } from "./routes/discovery.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLicenseRoutes } from "./routes/license.js";

function statusCodeFrom(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }
  return 500;
}

function messageFrom(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }
  return "The request could not be processed.";
}

export type AppDependencies = {
  db?: SqlClient | null;
  cache?: CacheStore | null;
};

export async function buildApp(
  config: AppConfig,
  deps: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.env === "test" ? "silent" : config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-api-key']",
          "req.headers['x-prodexa-secret']",
          "req.headers['x-prodexa-signature']",
        ],
        remove: true,
      },
    },
    requestIdHeader: "x-request-id",
    genReqId: (req) => {
      const existing = req.headers["x-request-id"];
      return typeof existing === "string" && existing.length > 0
        ? existing
        : crypto.randomUUID();
    },
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  app.decorateRequest("rawBody", "");

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const raw = typeof body === "string" ? body : "";
      request.rawBody = raw;
      if (raw.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw) as unknown);
      } catch {
        done(new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.", 400));
      }
    },
  );

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  const licenseAuth = {
    db: deps.db ?? null,
    apiSigningSecret: config.apiSigningSecret,
    timestampSkewSeconds: config.authTimestampSkewSeconds,
    rateLimitPerMinute: config.validateRateLimitPerMinute,
    cache: createLicenseValidationCache(deps.cache ?? new NoopCacheStore()),
  };

  await registerHealthRoutes(app);
  registerLicenseRoutes(app, licenseAuth);
  registerDiscoveryRoutes(app, licenseAuth);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      apiError("NOT_FOUND", "The requested resource does not exist.", request.id),
    );
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, "api_error");
      } else {
        request.log.warn({ code: error.code }, "api_error");
      }
      reply.status(error.statusCode).send(apiError(error.code, error.message, request.id));
      return;
    }

    request.log.error({ err: error }, "unhandled_error");
    const statusCode = statusCodeFrom(error);
    const code = statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
    const message =
      statusCode >= 500 ? "An unexpected error occurred." : messageFrom(error);
    reply.status(statusCode).send(apiError(code, message, request.id));
  });

  return app;
}
