import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

async function createApp() {
  const app = await buildApp(loadConfig({ NODE_ENV: "test", PORT: "8000" }));
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) {
      await app.close();
    }
  }
});

describe("health endpoints", () => {
  it("returns liveness on GET /health", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "prodexa-api",
      api_version: "v1",
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("returns the same payload on GET /v1/health", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/v1/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "prodexa-api" });
  });

  it("echoes a caller-supplied request id", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "req_test_123" },
    });

    expect(response.headers["x-request-id"]).toBe("req_test_123");
  });

  it("does not expose secrets or stack traces on unknown routes", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/v1/does-not-exist" });
    const body = response.json();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.request_id).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toMatch(/password|secret|api[_-]?key/i);
  });
});
