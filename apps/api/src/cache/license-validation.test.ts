import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "../test/memory-cache.js";
import {
  createLicenseValidationCache,
  parseLicenseCacheRecord,
} from "./license-validation.js";
import { licenseValidateCacheKey } from "./keys.js";

const identity = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  siteId: "sit_22222222-2222-2222-2222-222222222222",
  licenseId: "33333333-3333-3333-3333-333333333333",
  planId: "44444444-4444-4444-4444-444444444444",
  planVersion: "1700000000000",
};

const record = {
  activationUsed: 1,
  usage: {
    period_start: "2026-08-21",
    search_requests: 3,
    connector_calls: 4,
  },
};

describe("license validation cache", () => {
  it("stores and returns a hit for the same usage day", async () => {
    const store = new MemoryCacheStore();
    const cache = createLicenseValidationCache(store, 60);
    expect(await cache.get(identity, "2026-08-21")).toBeNull();

    await cache.set(identity, record, null, new Date("2026-08-21T12:00:00.000Z"));
    expect(await cache.get(identity, "2026-08-21")).toEqual(record);
  });

  it("treats a different usage day as a miss", async () => {
    const store = new MemoryCacheStore();
    const cache = createLicenseValidationCache(store, 60);
    await cache.set(identity, record, null, new Date("2026-08-21T12:00:00.000Z"));
    expect(await cache.get(identity, "2026-08-22")).toBeNull();
  });

  it("invalidates by site prefix and by license id", async () => {
    const store = new MemoryCacheStore();
    const cache = createLicenseValidationCache(store, 60);
    const otherSite = {
      ...identity,
      siteId: "sit_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    };
    await cache.set(identity, record, null, new Date("2026-08-21T12:00:00.000Z"));
    await cache.set(otherSite, record, null, new Date("2026-08-21T12:00:00.000Z"));

    await cache.invalidateSite(identity);
    expect(await cache.get(identity, "2026-08-21")).toBeNull();
    expect(await cache.get(otherSite, "2026-08-21")).toEqual(record);

    await cache.invalidateLicense(otherSite.tenantId, otherSite.licenseId);
    expect(await cache.get(otherSite, "2026-08-21")).toBeNull();
  });

  it("does not persist secrets in cache payloads", async () => {
    const store = new MemoryCacheStore();
    const cache = createLicenseValidationCache(store, 60);
    await cache.set(identity, record, null, new Date("2026-08-21T12:00:00.000Z"));
    const raw = store.snapshot().get(licenseValidateCacheKey(identity));
    expect(raw).toBeDefined();
    expect(raw).not.toMatch(/secret|password|BEGIN /i);
  });

  it("returns miss when the store throws", async () => {
    const cache = createLicenseValidationCache({
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => {
        throw new Error("redis down");
      },
      del: async () => {
        throw new Error("redis down");
      },
      keysByPrefix: async () => {
        throw new Error("redis down");
      },
    });
    await expect(cache.get(identity, "2026-08-21")).resolves.toBeNull();
    await expect(
      cache.set(identity, record, null, new Date("2026-08-21T12:00:00.000Z")),
    ).resolves.toBeUndefined();
  });
});

describe("parseLicenseCacheRecord", () => {
  it("rejects malformed JSON and missing version", () => {
    expect(parseLicenseCacheRecord("not-json", "2026-08-21")).toBeNull();
    expect(parseLicenseCacheRecord(JSON.stringify({ activationUsed: 1 }), "2026-08-21")).toBeNull();
  });
});
