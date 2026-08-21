import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import type { AppConfig } from "./config.js";
import { apiError } from "./http/errors.js";
import { registerHealthRoutes } from "./routes/health.js";

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

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.env === "test" ? "silent" : config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-api-key']",
          "req.headers['x-prodexa-secret']",
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

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  await registerHealthRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      apiError("NOT_FOUND", "The requested resource does not exist.", request.id),
    );
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    request.log.error({ err: error }, "unhandled_error");
    const statusCode = statusCodeFrom(error);
    const code = statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
    const message =
      statusCode >= 500
        ? "An unexpected error occurred."
        : messageFrom(error);
    reply.status(statusCode).send(apiError(code, message, request.id));
  });

  return app;
}
