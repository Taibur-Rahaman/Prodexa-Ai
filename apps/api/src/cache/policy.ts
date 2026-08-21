/** Positive license evaluation extras. Short enough that revocation is felt quickly via DB status. */
export const LICENSE_VALIDATE_TTL_SECONDS = 60;

/** Minimum Redis TTL so expired-but-still-queried rows do not live as long as a healthy grant. */
export const LICENSE_VALIDATE_MIN_TTL_SECONDS = 1;

export function ttlSecondsForLicense(
  expiresAt: Date | null,
  now: Date,
  configuredTtlSeconds: number = LICENSE_VALIDATE_TTL_SECONDS,
): number {
  const configured = Math.max(LICENSE_VALIDATE_MIN_TTL_SECONDS, configuredTtlSeconds);
  if (expiresAt === null) {
    return configured;
  }
  const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (remaining <= 0) {
    return LICENSE_VALIDATE_MIN_TTL_SECONDS;
  }
  return Math.max(LICENSE_VALIDATE_MIN_TTL_SECONDS, Math.min(configured, remaining));
}
