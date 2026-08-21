import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults to 0.0.0.0:8000 in development", () => {
    const config = loadConfig({ NODE_ENV: "development" });
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(8000);
    expect(config.env).toBe("development");
  });

  it("rejects an invalid PORT", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(/PORT/);
  });

  it("leaves DATABASE_URL and API_SIGNING_SECRET unset until provided", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.databaseUrl).toBeNull();
    expect(config.apiSigningSecret).toBeNull();
  });
});
