import { describe, expect, it } from "vitest";
import { LICENSE_VALIDATE_TTL_SECONDS, ttlSecondsForLicense } from "./policy.js";

describe("license cache TTL policy", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("uses the configured TTL when the license has no expiry", () => {
    expect(ttlSecondsForLicense(null, now)).toBe(LICENSE_VALIDATE_TTL_SECONDS);
  });

  it("caps TTL to remaining time before license expiry", () => {
    const expiresAt = new Date("2026-08-21T12:00:10.000Z");
    expect(ttlSecondsForLicense(expiresAt, now, 60)).toBe(10);
  });

  it("uses a 1 second floor when the license is already expired", () => {
    const expiresAt = new Date("2026-08-21T11:00:00.000Z");
    expect(ttlSecondsForLicense(expiresAt, now, 60)).toBe(1);
  });
});
