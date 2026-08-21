import { describe, expect, it } from "vitest";
import {
  evaluateLicense,
  LICENSE_MESSAGES,
  parseFeatureMap,
  parseUsageLimits,
  type LicenseSnapshot,
} from "./license.js";

const now = new Date("2026-08-21T12:00:00.000Z");

function snapshot(overrides: Partial<LicenseSnapshot> = {}): LicenseSnapshot {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    licenseId: "22222222-2222-2222-2222-222222222222",
    siteId: "sit_33333333-3333-3333-3333-333333333333",
    siteStatus: "active",
    boundDomain: "shop.example.com",
    requestDomain: "shop.example.com",
    licenseStatus: "active",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    activationLimit: 1,
    activationUsed: 1,
    plan: { id: "44444444-4444-4444-4444-444444444444", code: "pilot", name: "Pilot" },
    features: { "discovery.search": true, "ai.assist": false },
    usageLimits: { search_requests_per_day: 1000, connector_calls_per_day: 5000 },
    usage: { period_start: "2026-08-21", search_requests: 2, connector_calls: 1 },
    requestedFeature: null,
    ...overrides,
  };
}

describe("evaluateLicense", () => {
  it("grants an active in-window license with entitlements and usage", () => {
    const decision = evaluateLicense(snapshot(), now);
    expect(decision.ok).toBe(true);
    if (!decision.ok) {
      return;
    }
    expect(decision.tenant_id).not.toBe(decision.site_id);
    expect(decision.status).toBe("active");
    expect(decision.features["discovery.search"]).toBe(true);
    expect(decision.usage.search_requests).toEqual({ used: 2, limit: 1000 });
  });

  it("rejects revoked sites, domain mismatches, and terminal license states", () => {
    expect(evaluateLicense(snapshot({ siteStatus: "revoked" }), now)).toMatchObject({
      code: "SITE_REVOKED",
      message: LICENSE_MESSAGES.SITE_REVOKED,
      statusCode: 403,
    });
    expect(evaluateLicense(snapshot({ requestDomain: "other.example.com" }), now)).toMatchObject({
      code: "DOMAIN_MISMATCH",
    });
    expect(evaluateLicense(snapshot({ licenseStatus: "revoked" }), now)).toMatchObject({
      code: "LICENSE_REVOKED",
    });
    expect(evaluateLicense(snapshot({ licenseStatus: "suspended" }), now)).toMatchObject({
      code: "LICENSE_SUSPENDED",
    });
    expect(evaluateLicense(snapshot({ licenseStatus: "pending" }), now)).toMatchObject({
      code: "LICENSE_PENDING",
    });
    expect(evaluateLicense(snapshot({ licenseStatus: "expired" }), now)).toMatchObject({
      code: "LICENSE_EXPIRED",
      message: LICENSE_MESSAGES.LICENSE_EXPIRED,
    });
  });

  it("treats clock expiry as authoritative even when stored status is still active", () => {
    const decision = evaluateLicense(
      snapshot({ expiresAt: new Date("2026-08-21T00:00:00.000Z") }),
      now,
    );
    expect(decision).toMatchObject({ code: "LICENSE_EXPIRED", statusCode: 403 });
  });

  it("enforces feature entitlement and search usage only when a feature is requested", () => {
    expect(
      evaluateLicense(snapshot({ requestedFeature: "ai.assist" }), now),
    ).toMatchObject({ code: "FEATURE_NOT_ENTITLED" });
    expect(
      evaluateLicense(
        snapshot({
          requestedFeature: "discovery.search",
          usage: { period_start: "2026-08-21", search_requests: 1000, connector_calls: 0 },
        }),
        now,
      ),
    ).toMatchObject({ code: "USAGE_LIMIT_EXCEEDED" });
    expect(
      evaluateLicense(
        snapshot({
          usage: { period_start: "2026-08-21", search_requests: 1000, connector_calls: 0 },
        }),
        now,
      ).ok,
    ).toBe(true);
  });

  it("rejects activation counts that exceed the license limit", () => {
    expect(
      evaluateLicense(snapshot({ activationUsed: 3, activationLimit: 1 }), now),
    ).toMatchObject({ code: "ACTIVATION_LIMIT_EXCEEDED" });
  });
});

describe("plan parsers", () => {
  it("keeps only boolean feature flags and integer limits", () => {
    expect(parseFeatureMap({ "discovery.search": true, extra: "yes" })).toEqual({
      "discovery.search": true,
    });
    expect(parseUsageLimits({ search_requests_per_day: 10, connector_calls_per_day: -1 })).toEqual({
      search_requests_per_day: 10,
      connector_calls_per_day: null,
    });
  });
});
