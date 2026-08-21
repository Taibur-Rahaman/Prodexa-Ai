/**
 * Canonical normalized offer produced by connectors.
 * Private source fields stay server-side; customer responses use a safer subset.
 */
export type OfferAvailability =
  | "in_stock"
  | "out_of_stock"
  | "preorder"
  | "unknown";

export type NormalizedOffer = {
  source_id: string;
  source_url: string;
  external_product_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
  availability: OfferAvailability;
  variants: unknown[];
  retrieved_at: string;
  expires_at: string | null;
};

const AVAILABILITY = new Set<OfferAvailability>([
  "in_stock",
  "out_of_stock",
  "preorder",
  "unknown",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 10) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isNormalizedOffer(value: unknown): value is NormalizedOffer {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const offer = value as Record<string, unknown>;

  if (!isNonEmptyString(offer.source_id)) {
    return false;
  }
  if (!isNonEmptyString(offer.source_url)) {
    return false;
  }
  if (offer.external_product_id !== null && !isNonEmptyString(offer.external_product_id)) {
    return false;
  }
  if (!isNonEmptyString(offer.title)) {
    return false;
  }
  if (offer.description !== null && typeof offer.description !== "string") {
    return false;
  }
  if (offer.image_url !== null && !isNonEmptyString(offer.image_url)) {
    return false;
  }
  if (typeof offer.price !== "number" || !Number.isFinite(offer.price) || offer.price < 0) {
    return false;
  }
  if (!isNonEmptyString(offer.currency) || offer.currency.length !== 3) {
    return false;
  }
  if (
    typeof offer.availability !== "string" ||
    !AVAILABILITY.has(offer.availability as OfferAvailability)
  ) {
    return false;
  }
  if (!Array.isArray(offer.variants)) {
    return false;
  }
  if (!isIsoTimestamp(offer.retrieved_at)) {
    return false;
  }
  if (offer.expires_at !== null && !isIsoTimestamp(offer.expires_at)) {
    return false;
  }

  return true;
}
