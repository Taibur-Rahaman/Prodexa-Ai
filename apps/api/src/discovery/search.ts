import {
  isOfferAvailability,
  toCustomerDiscoveryOffer,
  type CustomerDiscoveryOffer,
} from "../domain/offer.js";
import type { SqlClient } from "../db/sql.js";

type OfferRow = {
  offer_id: string;
  title: string;
  image_url: string | null;
  price: number | string;
  currency: string;
  availability: string;
  retrieved_at: Date | string;
};

export type DiscoverySearchInput = {
  tenantId: string;
  tokens: string[];
  currency: string | null;
  page: number;
  limit: number;
};

function asIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function asPrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("invalid_offer_price");
  }
  return parsed;
}

export async function searchNormalizedOffers(
  db: SqlClient,
  input: DiscoverySearchInput,
): Promise<CustomerDiscoveryOffer[]> {
  const params: unknown[] = [input.tenantId];
  const tokenClauses: string[] = [];

  for (const token of input.tokens) {
    const index = params.length + 1;
    tokenClauses.push(
      `(position(lower($${index}) in lower(o.title)) > 0 OR (o.description IS NOT NULL AND position(lower($${index}) in lower(o.description)) > 0))`,
    );
    params.push(token);
  }

  let currencyClause = "";
  if (input.currency) {
    const index = params.length + 1;
    currencyClause = ` AND o.currency = $${index}`;
    params.push(input.currency);
  }

  const limitIndex = params.length + 1;
  const offsetIndex = params.length + 2;
  params.push(input.limit, (input.page - 1) * input.limit);

  const result = await db.query<OfferRow>(
    `
    SELECT
      o.offer_id,
      o.title,
      o.image_url,
      o.price,
      o.currency,
      o.availability,
      o.retrieved_at
    FROM normalized_offers o
    WHERE o.tenant_id = $1
      AND ${tokenClauses.join(" AND ")}
      ${currencyClause}
    ORDER BY o.offer_id ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    params,
  );

  const offers: CustomerDiscoveryOffer[] = [];
  for (const row of result.rows) {
    if (!isOfferAvailability(row.availability)) {
      continue;
    }
    offers.push(
      toCustomerDiscoveryOffer({
        offer_id: row.offer_id,
        title: row.title,
        image_url: row.image_url,
        price: asPrice(row.price),
        currency: row.currency.trim(),
        availability: row.availability,
        retrieved_at: asIso(row.retrieved_at),
      }),
    );
  }
  return offers;
}
