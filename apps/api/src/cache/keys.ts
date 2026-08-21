export const LICENSE_VALIDATE_CACHE_PREFIX = "prodexa:v1:license:validate";

export type LicenseCacheIdentity = {
  tenantId: string;
  siteId: string;
  licenseId: string;
  planId: string;
  planVersion: string;
};

export function licenseValidateCacheKey(identity: LicenseCacheIdentity): string {
  return [
    LICENSE_VALIDATE_CACHE_PREFIX,
    identity.tenantId,
    identity.siteId,
    identity.licenseId,
    identity.planId,
    identity.planVersion,
  ].join(":");
}

export function licenseValidateSitePrefix(
  identity: Pick<LicenseCacheIdentity, "tenantId" | "siteId" | "licenseId">,
): string {
  return [
    LICENSE_VALIDATE_CACHE_PREFIX,
    identity.tenantId,
    identity.siteId,
    identity.licenseId,
    "",
  ].join(":");
}

export function licenseValidateTenantPrefix(tenantId: string): string {
  return `${LICENSE_VALIDATE_CACHE_PREFIX}:${tenantId}:`;
}

export function licenseIdNeedle(licenseId: string): string {
  return `:${licenseId}:`;
}
