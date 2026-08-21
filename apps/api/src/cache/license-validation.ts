import {
  licenseIdNeedle,
  licenseValidateCacheKey,
  licenseValidateTenantPrefix,
  licenseValidateSitePrefix,
  type LicenseCacheIdentity,
} from "./keys.js";
import { LICENSE_VALIDATE_TTL_SECONDS, ttlSecondsForLicense } from "./policy.js";
import type { CacheStore } from "./store.js";

export type { LicenseCacheIdentity } from "./keys.js";

export type LicenseCacheRecord = {
  activationUsed: number;
  usage: {
    period_start: string;
    search_requests: number;
    connector_calls: number;
  };
};

type StoredLicenseCacheRecord = LicenseCacheRecord & { v: 1 };

export type LicenseValidationCache = {
  get(identity: LicenseCacheIdentity, usageDay: string): Promise<LicenseCacheRecord | null>;
  set(
    identity: LicenseCacheIdentity,
    record: LicenseCacheRecord,
    expiresAt: Date | null,
    now: Date,
  ): Promise<void>;
  invalidateSite(
    identity: Pick<LicenseCacheIdentity, "tenantId" | "siteId" | "licenseId">,
  ): Promise<void>;
  invalidateLicense(tenantId: string, licenseId: string): Promise<void>;
};

function isRecord(value: unknown): value is StoredLicenseCacheRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  if (row.v !== 1 || typeof row.activationUsed !== "number" || !Number.isInteger(row.activationUsed)) {
    return false;
  }
  const usage = row.usage;
  if (usage === null || typeof usage !== "object" || Array.isArray(usage)) {
    return false;
  }
  const usageRow = usage as Record<string, unknown>;
  return (
    typeof usageRow.period_start === "string" &&
    typeof usageRow.search_requests === "number" &&
    Number.isInteger(usageRow.search_requests) &&
    typeof usageRow.connector_calls === "number" &&
    Number.isInteger(usageRow.connector_calls)
  );
}

export function parseLicenseCacheRecord(
  raw: string,
  usageDay: string,
): LicenseCacheRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  if (parsed.usage.period_start !== usageDay) {
    return null;
  }
  return {
    activationUsed: parsed.activationUsed,
    usage: {
      period_start: parsed.usage.period_start,
      search_requests: parsed.usage.search_requests,
      connector_calls: parsed.usage.connector_calls,
    },
  };
}

export function createLicenseValidationCache(
  store: CacheStore,
  ttlSeconds: number = LICENSE_VALIDATE_TTL_SECONDS,
): LicenseValidationCache {
  return {
    async get(identity, usageDay) {
      try {
        const raw = await store.get(licenseValidateCacheKey(identity));
        if (raw === null) {
          return null;
        }
        return parseLicenseCacheRecord(raw, usageDay);
      } catch {
        return null;
      }
    },

    async set(identity, record, expiresAt, now) {
      try {
        const payload: StoredLicenseCacheRecord = { v: 1, ...record };
        await store.set(
          licenseValidateCacheKey(identity),
          JSON.stringify(payload),
          ttlSecondsForLicense(expiresAt, now, ttlSeconds),
        );
      } catch {
        // Fail open: license validation continues via PostgreSQL.
      }
    },

    async invalidateSite(identity) {
      try {
        const keys = await store.keysByPrefix(licenseValidateSitePrefix(identity));
        if (keys.length > 0) {
          await store.del(keys);
        }
      } catch {
        // TTL remains the backstop if invalidation fails.
      }
    },

    async invalidateLicense(tenantId, licenseId) {
      try {
        const keys = await store.keysByPrefix(licenseValidateTenantPrefix(tenantId));
        const matching = keys.filter((key) => key.includes(licenseIdNeedle(licenseId)));
        if (matching.length > 0) {
          await store.del(matching);
        }
      } catch {
        // TTL remains the backstop if invalidation fails.
      }
    },
  };
}
