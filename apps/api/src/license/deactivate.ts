import type { LicenseValidationCache } from "../cache/license-validation.js";
import type { SqlClient } from "../db/sql.js";
import { ApiError } from "../http/errors.js";
import {
  authenticateSiteRequest,
  type AuthenticateSiteInput,
} from "./authenticate.js";

export type DeactivateLicenseInput = AuthenticateSiteInput & {
  bodySiteId: string;
  now?: Date;
};

export type DeactivateLicenseOptions = {
  timestampSkewSeconds: number;
  rateLimitPerMinute: number;
  cache?: LicenseValidationCache | null;
};

export type DeactivateLicenseResult = {
  deactivated: true;
  site_id: string;
};

/**
 * Removes the active association for the authenticated site (DEC-027).
 * Sets site_activations.status to revoked (existing inactive state).
 * Idempotent when already inactive. Does not delete site, license, or usage rows.
 */
export async function deactivateLicensedSite(
  db: SqlClient,
  masterSecret: string,
  input: DeactivateLicenseInput,
  options: DeactivateLicenseOptions,
): Promise<DeactivateLicenseResult> {
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
        rateLimitMessage: "Too many license deactivation requests.",
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

    if (site.siteStatus === "revoked") {
      return {
        deactivated: true as const,
        site_id: site.siteId,
        tenantId: site.tenantId,
        licenseId: site.licenseId,
        changed: false,
      };
    }

    const updated = await tx.query(
      `
      UPDATE site_activations
      SET status = 'revoked', updated_at = $1
      WHERE site_id = $2
        AND tenant_id = $3
        AND license_id = $4
        AND status = 'active'
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
      deactivated: true as const,
      site_id: site.siteId,
      tenantId: site.tenantId,
      licenseId: site.licenseId,
      changed: true,
    };
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateLicense(result.tenantId, result.licenseId);
  }

  return { deactivated: result.deactivated, site_id: result.site_id };
}
