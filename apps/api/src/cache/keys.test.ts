import { describe, expect, it } from "vitest";
import {
  LICENSE_VALIDATE_CACHE_PREFIX,
  licenseIdNeedle,
  licenseValidateCacheKey,
  licenseValidateSitePrefix,
  licenseValidateTenantPrefix,
} from "./keys.js";

const identity = {
  tenantId: "tenant-a",
  siteId: "sit_11111111-1111-1111-1111-111111111111",
  licenseId: "license-a",
  planId: "plan-a",
  planVersion: "1710000000000",
};

describe("license cache keys", () => {
  it("includes tenant, site, license, and plan/version", () => {
    const key = licenseValidateCacheKey(identity);
    expect(key.startsWith(`${LICENSE_VALIDATE_CACHE_PREFIX}:`)).toBe(true);
    expect(key).toContain(identity.tenantId);
    expect(key).toContain(identity.siteId);
    expect(key).toContain(identity.licenseId);
    expect(key).toContain(identity.planId);
    expect(key.endsWith(`:${identity.planVersion}`)).toBe(true);
  });

  it("changes when the plan version changes", () => {
    const next = licenseValidateCacheKey({ ...identity, planVersion: "1710000000999" });
    expect(next).not.toBe(licenseValidateCacheKey(identity));
  });

  it("scopes site invalidation to tenant + site + license", () => {
    const prefix = licenseValidateSitePrefix(identity);
    expect(licenseValidateCacheKey(identity).startsWith(prefix)).toBe(true);
    expect(prefix).toContain(identity.tenantId);
    expect(prefix).toContain(identity.siteId);
    expect(prefix).toContain(identity.licenseId);
  });

  it("scopes license invalidation to the tenant prefix plus license needle", () => {
    expect(licenseValidateTenantPrefix(identity.tenantId)).toBe(
      `${LICENSE_VALIDATE_CACHE_PREFIX}:${identity.tenantId}:`,
    );
    expect(licenseValidateCacheKey(identity).includes(licenseIdNeedle(identity.licenseId))).toBe(
      true,
    );
  });
});
