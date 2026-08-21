import type { SqlClient } from "../db/sql.js";

/**
 * Phase 1 stored offer price (DEC-021, DEC-022, DEC-024).
 * PostgreSQL `normalized_offers.price` is authoritative.
 * No markup, tax, discount, fee, FX, live connector price, or quote API.
 */
export type StoredOfferPrice = {
  price: number;
  currency: string;
};

export function parseStoredOfferPrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("invalid_offer_price");
  }
  return parsed;
}

/**
 * Resolve the authenticated tenant's stored offer price from PostgreSQL.
 * Callers must not pass a client-supplied price; this function has no such parameter.
 */
export async function resolveStoredOfferPrice(
  db: SqlClient,
  input: { tenantId: string; offerId: string },
): Promise<StoredOfferPrice | null> {
  const result = await db.query<{ price: number | string; currency: string }>(
    `
    SELECT price, currency
    FROM normalized_offers
    WHERE offer_id = $1
      AND tenant_id = $2
    `,
    [input.offerId, input.tenantId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const currency = row.currency.trim();
  if (currency.length !== 3) {
    throw new Error("invalid_offer_currency");
  }
  return {
    price: parseStoredOfferPrice(row.price),
    currency,
  };
}
