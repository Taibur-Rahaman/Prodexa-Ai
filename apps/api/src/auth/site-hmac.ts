import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const SITE_HMAC_VERSION = "v1";

export type SiteHmacInput = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  siteId: string;
};

export function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function canonicalSiteString(input: SiteHmacInput): string {
  return [
    SITE_HMAC_VERSION,
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    hashBody(input.body),
    input.siteId,
  ].join("\n");
}

export function signSiteRequest(secret: string, input: SiteHmacInput): string {
  return createHmac("sha256", secret).update(canonicalSiteString(input)).digest("hex");
}

export function signaturesMatch(expectedHex: string, provided: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(provided, "hex");
  if (expected.length === 0 || expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

export function timestampIsFresh(
  timestamp: string,
  nowSeconds: number,
  skewSeconds: number,
): boolean {
  if (!/^[0-9]{10,12}$/.test(timestamp)) {
    return false;
  }
  const parsed = Number.parseInt(timestamp, 10);
  if (!Number.isSafeInteger(parsed)) {
    return false;
  }
  return Math.abs(nowSeconds - parsed) <= skewSeconds;
}
