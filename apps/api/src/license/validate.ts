import { decryptSecret } from "../auth/secret-box.js";
import { signSiteRequest, signaturesMatch, timestampIsFresh } from "../auth/site-hmac.js";
import type { SqlClient } from "../db/sql.js";
import { isUniqueViolation } from "../db/sql.js";
import {
  evaluateLicense,
  parseFeatureMap,
  parseUsageLimits,
  type LicenseDecision,
  type LicenseStatus,
  type SiteActivationStatus,
} from "../domain/license.js";
import { ApiError } from "../http/errors.js";

type SiteLicenseRow = {
  site_id: string;
  tenant_id: string;
  license_id: string;
  domain: string;
  secret_encrypted: string;
  site_status: string;
  license_status: string;
  starts_at: Date | string;
  expires_at: Date | string | null;
  activation_limit: number | string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  features: unknown;
  usage_limits: unknown;
};

type CountRow = { n: number | string };
type UsageRow = {
  search_requests: number | string;
  connector_calls: number | string;
};

export const AUTH_UNAUTHENTICATED = new ApiError(
  "UNAUTHENTICATED",
  "Authentication failed.",
  401,
);

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function asInt(value: number | string): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function asStatus(value: string): LicenseStatus {
  return value as LicenseStatus;
}

function asSiteStatus(value: string): SiteActivationStatus {
  return value === "revoked" ? "revoked" : "active";
}

export type ValidateLicenseInput = {
  siteId: string;
  timestamp: string;
  nonce: string;
  signature: string;
  method: string;
  path: string;
  rawBody: string;
  domain: string;
  requestedFeature: string | null;
  now?: Date;
};

export async function validateLicensedSite(
  db: SqlClient,
  masterSecret: string,
  input: ValidateLicenseInput,
  options: { timestampSkewSeconds: number; rateLimitPerMinute: number },
): Promise<LicenseDecision> {
  const now = input.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (!timestampIsFresh(input.timestamp, nowSeconds, options.timestampSkewSeconds)) {
    throw new ApiError(
      "AUTH_EXPIRED",
      "The request timestamp is outside the allowed window.",
      401,
    );
  }

  if (input.nonce.length < 8 || input.nonce.length > 128) {
    throw AUTH_UNAUTHENTICATED;
  }

  return db.transact(async (tx) => {
    const loaded = await tx.query<SiteLicenseRow>(
      `
      SELECT
        s.site_id,
        s.tenant_id,
        s.license_id,
        s.domain,
        s.secret_encrypted,
        s.status AS site_status,
        l.status AS license_status,
        l.starts_at,
        l.expires_at,
        l.activation_limit,
        p.id AS plan_id,
        p.code AS plan_code,
        p.name AS plan_name,
        p.features,
        p.usage_limits
      FROM site_activations s
      INNER JOIN licenses l
        ON l.id = s.license_id
        AND l.tenant_id = s.tenant_id
      INNER JOIN plans p
        ON p.id = l.plan_id
      WHERE s.site_id = $1
      `,
      [input.siteId],
    );

    const row = loaded.rows[0];
    if (!row) {
      throw AUTH_UNAUTHENTICATED;
    }

    let siteSecret: string;
    try {
      siteSecret = decryptSecret(row.secret_encrypted, masterSecret);
    } catch {
      throw AUTH_UNAUTHENTICATED;
    }

    const expected = signSiteRequest(siteSecret, {
      method: input.method,
      path: input.path,
      timestamp: input.timestamp,
      nonce: input.nonce,
      body: input.rawBody,
      siteId: input.siteId,
    });

    if (!signaturesMatch(expected, input.signature)) {
      throw AUTH_UNAUTHENTICATED;
    }

    try {
      await tx.query("INSERT INTO request_nonces (site_id, nonce) VALUES ($1, $2)", [
        input.siteId,
        input.nonce,
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(
          "AUTH_REPLAY",
          "The request nonce has already been used.",
          401,
        );
      }
      throw error;
    }

    await tx.query(
      "DELETE FROM request_nonces WHERE seen_at < now() - interval '15 minutes'",
    );

    const recent = await tx.query<CountRow>(
      `
      SELECT COUNT(*)::int AS n
      FROM request_nonces
      WHERE site_id = $1
        AND seen_at > now() - interval '1 minute'
      `,
      [input.siteId],
    );
    const recentCount = asInt(recent.rows[0]?.n ?? 0);
    if (recentCount > options.rateLimitPerMinute) {
      throw new ApiError(
        "RATE_LIMITED",
        "Too many license validation requests.",
        429,
      );
    }

    const activationCount = await tx.query<CountRow>(
      `
      SELECT COUNT(*)::int AS n
      FROM site_activations
      WHERE license_id = $1
        AND tenant_id = $2
        AND status = 'active'
      `,
      [row.license_id, row.tenant_id],
    );

    const usage = await tx.query<UsageRow>(
      `
      SELECT search_requests, connector_calls
      FROM usage_counters
      WHERE license_id = $1
        AND tenant_id = $2
        AND period_start = $3
      `,
      [row.license_id, row.tenant_id, utcDay(now)],
    );
    const usageRow = usage.rows[0];

    const decision = evaluateLicense(
      {
        tenantId: row.tenant_id,
        licenseId: row.license_id,
        siteId: row.site_id,
        siteStatus: asSiteStatus(row.site_status),
        boundDomain: row.domain,
        requestDomain: input.domain,
        licenseStatus: asStatus(row.license_status),
        startsAt: asDate(row.starts_at),
        expiresAt: row.expires_at === null ? null : asDate(row.expires_at),
        activationLimit: asInt(row.activation_limit),
        activationUsed: asInt(activationCount.rows[0]?.n ?? 0),
        plan: {
          id: row.plan_id,
          code: row.plan_code,
          name: row.plan_name,
        },
        features: parseFeatureMap(row.features),
        usageLimits: parseUsageLimits(row.usage_limits),
        usage: {
          period_start: utcDay(now),
          search_requests: asInt(usageRow?.search_requests ?? 0),
          connector_calls: asInt(usageRow?.connector_calls ?? 0),
        },
        requestedFeature: input.requestedFeature,
      },
      now,
    );

    if (decision.ok) {
      await tx.query(
        `
        UPDATE site_activations
        SET last_seen_at = $1, updated_at = $1
        WHERE site_id = $2
          AND tenant_id = $3
        `,
        [now.toISOString(), row.site_id, row.tenant_id],
      );
    }

    return decision;
  });
}
