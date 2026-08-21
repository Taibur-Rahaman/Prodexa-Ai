import type { LicenseValidationCache } from "../cache/license-validation.js";
import type { SqlClient } from "../db/sql.js";
import {
  evaluateLicense,
  parseFeatureMap,
  parseUsageLimits,
  type LicenseDecision,
} from "../domain/license.js";
import {
  AUTH_UNAUTHENTICATED,
  authenticateSiteRequest,
  type AuthenticateSiteInput,
} from "./authenticate.js";

export { AUTH_UNAUTHENTICATED };

type CountRow = { n: number | string };
type UsageRow = {
  search_requests: number | string;
  connector_calls: number | string;
};

function asInt(value: number | string): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export type ValidateLicenseInput = AuthenticateSiteInput & {
  domain?: string | null;
  requestedFeature: string | null;
  now?: Date;
};

export type ValidateLicenseOptions = {
  timestampSkewSeconds: number;
  rateLimitPerMinute: number;
  cache?: LicenseValidationCache | null;
};

export async function validateLicensedSite(
  db: SqlClient,
  masterSecret: string,
  input: ValidateLicenseInput,
  options: ValidateLicenseOptions,
): Promise<LicenseDecision> {
  const now = input.now ?? new Date();

  const loaded = await db.transact(async (tx) => {
    const site = await authenticateSiteRequest(
      tx,
      masterSecret,
      {
        siteId: input.siteId,
        timestamp: input.timestamp,
        nonce: input.nonce,
        signature: input.signature,
        method: input.method,
        path: input.path,
        rawBody: input.rawBody,
      },
      {
        timestampSkewSeconds: options.timestampSkewSeconds,
        rateLimitPerMinute: options.rateLimitPerMinute,
      },
      now,
    );

    const cacheIdentity = {
      tenantId: site.tenantId,
      siteId: site.siteId,
      licenseId: site.licenseId,
      planId: site.planId,
      planVersion: String(site.planUpdatedAt.getTime()),
    };
    const usageDay = utcDay(now);
    const cache = options.cache ?? null;
    let extras = cache ? await cache.get(cacheIdentity, usageDay) : null;
    const cacheHit = extras !== null;

    if (!extras) {
      const activationCount = await tx.query<CountRow>(
        `
        SELECT COUNT(*)::int AS n
        FROM site_activations
        WHERE license_id = $1
          AND tenant_id = $2
          AND status = 'active'
        `,
        [site.licenseId, site.tenantId],
      );

      const usage = await tx.query<UsageRow>(
        `
        SELECT search_requests, connector_calls
        FROM usage_counters
        WHERE license_id = $1
          AND tenant_id = $2
          AND period_start = $3
        `,
        [site.licenseId, site.tenantId, usageDay],
      );
      const usageRow = usage.rows[0];
      extras = {
        activationUsed: asInt(activationCount.rows[0]?.n ?? 0),
        usage: {
          period_start: usageDay,
          search_requests: asInt(usageRow?.search_requests ?? 0),
          connector_calls: asInt(usageRow?.connector_calls ?? 0),
        },
      };
    }

    const decision = evaluateLicense(
      {
        tenantId: site.tenantId,
        licenseId: site.licenseId,
        siteId: site.siteId,
        siteStatus: site.siteStatus,
        boundDomain: site.domain,
        requestDomain: input.domain ?? site.domain,
        licenseStatus: site.licenseStatus,
        startsAt: site.startsAt,
        expiresAt: site.expiresAt,
        activationLimit: site.activationLimit,
        activationUsed: extras.activationUsed,
        plan: {
          id: site.planId,
          code: site.planCode,
          name: site.planName,
        },
        features: parseFeatureMap(site.features),
        usageLimits: parseUsageLimits(site.usageLimits),
        usage: extras.usage,
        requestedFeature: input.requestedFeature,
      },
      now,
    );

    if (decision.ok && !cacheHit) {
      await tx.query(
        `
        UPDATE site_activations
        SET last_seen_at = $1, updated_at = $1
        WHERE site_id = $2
          AND tenant_id = $3
        `,
        [now.toISOString(), site.siteId, site.tenantId],
      );
    }

    return { decision, cacheIdentity, extras, cacheHit, expiresAt: site.expiresAt };
  });

  if (!loaded.cacheHit && options.cache) {
    await options.cache.set(loaded.cacheIdentity, loaded.extras, loaded.expiresAt, now);
  }

  return loaded.decision;
}
