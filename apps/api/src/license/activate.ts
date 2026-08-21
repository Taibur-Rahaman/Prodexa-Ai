import type { LicenseValidationCache } from "../cache/license-validation.js";
import type { SqlClient } from "../db/sql.js";
import type { LicenseStatus } from "../domain/license.js";
import { ApiError } from "../http/errors.js";
import {
  authenticateSiteRequest,
  type AuthenticateSiteInput,
} from "./authenticate.js";

export type ActivateLicenseInput = AuthenticateSiteInput & {
  bodySiteId: string;
  now?: Date;
};

export type ActivateLicenseOptions = {
  timestampSkewSeconds: number;
  rateLimitPerMinute: number;
  cache?: LicenseValidationCache | null;
};

export type ActivateLicenseResult = {
  activated: true;
  site_id: string;
};

function assertLicenseActivatable(
  status: LicenseStatus,
  startsAt: Date,
  expiresAt: Date | null,
  now: Date,
): void {
  if (status === "revoked" || status === "suspended" || status === "pending") {
    throw new ApiError(
      "LICENSE_NOT_ACTIVATABLE",
      "The Prodexa license cannot be activated.",
      422,
    );
  }

  if (now < startsAt) {
    throw new ApiError(
      "LICENSE_NOT_ACTIVATABLE",
      "The Prodexa license cannot be activated.",
      422,
    );
  }

  const expiredByStatus = status === "expired";
  const expiredByTime = expiresAt !== null && now >= expiresAt;
  if (expiredByStatus || expiredByTime) {
    throw new ApiError(
      "LICENSE_NOT_ACTIVATABLE",
      "The Prodexa license cannot be activated.",
      422,
    );
  }

  if (status !== "active" && status !== "trial") {
    throw new ApiError(
      "LICENSE_NOT_ACTIVATABLE",
      "The Prodexa license cannot be activated.",
      422,
    );
  }
}

/**
 * Binds the authenticated site to its server-resolved license (DEC-027).
 * Idempotent when the same tenant + site + license is already active.
 * Uses licenses.activation_limit; does not invent quotas.
 */
export async function activateLicensedSite(
  db: SqlClient,
  masterSecret: string,
  input: ActivateLicenseInput,
  options: ActivateLicenseOptions,
): Promise<ActivateLicenseResult> {
  const now = input.now ?? new Date();

  const result = await db.transact(async (tx) => {
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
        rateLimitMessage: "Too many license activation requests.",
      },
      now,
    );

    if (input.bodySiteId !== site.siteId) {
      throw new ApiError(
        "SITE_MISMATCH",
        "The site identity does not match the authenticated site.",
        403,
      );
    }

    assertLicenseActivatable(site.licenseStatus, site.startsAt, site.expiresAt, now);

    if (site.siteStatus === "active") {
      return {
        activated: true as const,
        site_id: site.siteId,
        tenantId: site.tenantId,
        licenseId: site.licenseId,
        changed: false,
      };
    }

    const activeOthers = await tx.query<{ n: number | string }>(
      `
      SELECT COUNT(*)::int AS n
      FROM site_activations
      WHERE license_id = $1
        AND tenant_id = $2
        AND status = 'active'
        AND site_id <> $3
      `,
      [site.licenseId, site.tenantId, site.siteId],
    );
    const used = typeof activeOthers.rows[0]?.n === "number"
      ? activeOthers.rows[0].n
      : Number.parseInt(String(activeOthers.rows[0]?.n ?? 0), 10);

    if (used >= site.activationLimit) {
      throw new ApiError(
        "ACTIVATION_LIMIT_EXCEEDED",
        "This license has reached its activation limit.",
        409,
      );
    }

    const updated = await tx.query(
      `
      UPDATE site_activations
      SET
        status = 'active',
        activated_at = $1,
        updated_at = $1
      WHERE site_id = $2
        AND tenant_id = $3
        AND license_id = $4
        AND status = 'revoked'
      `,
      [now.toISOString(), site.siteId, site.tenantId, site.licenseId],
    );

    if (updated.rowCount === 0) {
      throw new ApiError(
        "ASSOCIATION_NOT_FOUND",
        "The license/site association was not found.",
        404,
      );
    }

    return {
      activated: true as const,
      site_id: site.siteId,
      tenantId: site.tenantId,
      licenseId: site.licenseId,
      changed: true,
    };
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateLicense(result.tenantId, result.licenseId);
  }

  return { activated: result.activated, site_id: result.site_id };
}
