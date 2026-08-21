import { decryptSecret } from "../auth/secret-box.js";
import { signSiteRequest, signaturesMatch, timestampIsFresh } from "../auth/site-hmac.js";
import type { SqlClient } from "../db/sql.js";
import { isUniqueViolation } from "../db/sql.js";
import type { LicenseStatus, SiteActivationStatus } from "../domain/license.js";
import { ApiError } from "../http/errors.js";

export const AUTH_UNAUTHENTICATED = new ApiError(
  "UNAUTHENTICATED",
  "Authentication failed.",
  401,
);

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
  plan_updated_at: Date | string;
  features: unknown;
  usage_limits: unknown;
};

export type AuthenticatedSiteContext = {
  siteId: string;
  tenantId: string;
  licenseId: string;
  domain: string;
  siteStatus: SiteActivationStatus;
  licenseStatus: LicenseStatus;
  startsAt: Date;
  expiresAt: Date | null;
  activationLimit: number;
  planId: string;
  planCode: string;
  planName: string;
  planUpdatedAt: Date;
  features: unknown;
  usageLimits: unknown;
};

export type AuthenticateSiteInput = {
  siteId: string;
  timestamp: string;
  nonce: string;
  signature: string;
  method: string;
  path: string;
  rawBody: string;
};

export type AuthenticateSiteOptions = {
  timestampSkewSeconds: number;
  rateLimitPerMinute: number;
  rateLimitMessage?: string;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function asInt(value: number | string): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function asStatus(value: string): LicenseStatus {
  return value as LicenseStatus;
}

function asSiteStatus(value: string): SiteActivationStatus {
  return value === "revoked" ? "revoked" : "active";
}

/**
 * Verifies site HMAC, consumes nonce, and loads tenant/license binding.
 * Does not evaluate license usability or site activation status.
 */
export async function authenticateSiteRequest(
  tx: SqlClient,
  masterSecret: string,
  input: AuthenticateSiteInput,
  options: AuthenticateSiteOptions,
  now: Date = new Date(),
): Promise<AuthenticatedSiteContext> {
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
      p.updated_at AS plan_updated_at,
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

  const recent = await tx.query<{ n: number | string }>(
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
      options.rateLimitMessage ?? "Too many license validation requests.",
      429,
    );
  }

  return {
    siteId: row.site_id,
    tenantId: row.tenant_id,
    licenseId: row.license_id,
    domain: row.domain,
    siteStatus: asSiteStatus(row.site_status),
    licenseStatus: asStatus(row.license_status),
    startsAt: asDate(row.starts_at),
    expiresAt: row.expires_at === null ? null : asDate(row.expires_at),
    activationLimit: asInt(row.activation_limit),
    planId: row.plan_id,
    planCode: row.plan_code,
    planName: row.plan_name,
    planUpdatedAt: asDate(row.plan_updated_at),
    features: row.features,
    usageLimits: row.usage_limits,
  };
}
