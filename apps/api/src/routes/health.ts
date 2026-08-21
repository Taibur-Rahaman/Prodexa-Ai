import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  const handler = async () => {
    return {
      status: "ok" as const,
      service: "prodexa-api",
      api_version: "v1",
    };
  };

  app.get("/health", handler);
  app.get("/v1/health", handler);
}
