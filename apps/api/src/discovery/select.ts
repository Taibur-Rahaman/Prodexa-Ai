import type { SqlClient } from "../db/sql.js";
import { ApiError } from "../http/errors.js";
import { isOfferAvailability } from "../domain/offer.js";

export const SELECTION_TTL_MINUTES = 15;
export const OFFER_ID_PATTERN = /^off_[A-Za-z0-9._-]{1,120}$/;
export const SELECTION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

const SELECTABLE_AVAILABILITY = new Set(["in_stock", "preorder", "unknown"]);

export type SelectInput = {
  offerId: string;
  selectionId: string;
};

export type CustomerDiscoverySelection = {
  selection_id: string;
  offer_id: string;
  expires_at: string;
};

type SelectBody = {
  offer_id?: unknown;
  selection_id?: unknown;
  tenant_id?: unknown;
};

type OfferRow = {
  offer_id: string;
  retrieved_at: Date | string;
  availability: string;
  expired: unknown;
};

type SelectionRow = {
  selection_id: string;
  offer_id: string;
  expires_at: Date | string;
  expired: unknown;
};

function asIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function toCustomer(row: {
  selection_id: string;
  offer_id: string;
  expires_at: Date | string;
}): CustomerDiscoverySelection {
  return {
    selection_id: row.selection_id,
    offer_id: row.offer_id,
    expires_at: asIso(row.expires_at),
  };
}

function readBody(body: unknown): SelectBody {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Request body must be a JSON object.", 400);
  }
  return body as SelectBody;
}

function readOfferId(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", "offer_id is required.", 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "offer_id is required.", 400);
  }
  if (!OFFER_ID_PATTERN.test(trimmed)) {
    throw new ApiError("VALIDATION_ERROR", "offer_id is invalid.", 400);
  }
  return trimmed;
}

function readSelectionId(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", "selection_id is required.", 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "selection_id is required.", 400);
  }
  if (!SELECTION_ID_PATTERN.test(trimmed)) {
    throw new ApiError("VALIDATION_ERROR", "selection_id is invalid.", 400);
  }
  return trimmed;
}

export function parseSelectBody(body: unknown): SelectInput {
  const payload = readBody(body);
  return {
    offerId: readOfferId(payload.offer_id),
    selectionId: readSelectionId(payload.selection_id),
  };
}

function interpretExisting(
  existing: SelectionRow,
  requestedOfferId: string,
): CustomerDiscoverySelection {
  if (existing.offer_id !== requestedOfferId) {
    throw new ApiError(
      "SELECTION_CONFLICT",
      "selection_id is already bound to a different offer.",
      409,
    );
  }
  if (asBool(existing.expired)) {
    throw new ApiError("SELECTION_EXPIRED", "The selection has expired.", 410);
  }
  return toCustomer(existing);
}

async function findSelection(
  db: SqlClient,
  input: { tenantId: string; siteId: string; selectionId: string },
): Promise<SelectionRow | null> {
  const result = await db.query<SelectionRow>(
    `
    SELECT
      selection_id,
      offer_id,
      expires_at,
      (expires_at <= now()) AS expired
    FROM discovery_selections
    WHERE tenant_id = $1
      AND site_id = $2
      AND selection_id = $3
    `,
    [input.tenantId, input.siteId, input.selectionId],
  );
  return result.rows[0] ?? null;
}

async function findSelectableOffer(
  db: SqlClient,
  input: { tenantId: string; offerId: string },
): Promise<OfferRow> {
  const result = await db.query<OfferRow>(
    `
    SELECT
      offer_id,
      retrieved_at,
      availability,
      (expires_at IS NOT NULL AND expires_at <= now()) AS expired
    FROM normalized_offers
    WHERE offer_id = $1
      AND tenant_id = $2
    `,
    [input.offerId, input.tenantId],
  );
  const offer = result.rows[0];
  if (!offer) {
    throw new ApiError("OFFER_NOT_FOUND", "The offer was not found.", 404);
  }
  if (
    asBool(offer.expired) ||
    !isOfferAvailability(offer.availability) ||
    !SELECTABLE_AVAILABILITY.has(offer.availability)
  ) {
    throw new ApiError("OFFER_NOT_SELECTABLE", "The offer is not selectable.", 422);
  }
  return offer;
}

async function insertSelection(
  db: SqlClient,
  input: {
    tenantId: string;
    siteId: string;
    offerId: string;
    selectionId: string;
    offerRetrievedAt: string;
  },
): Promise<CustomerDiscoverySelection | null> {
  const result = await db.query<{
    selection_id: string;
    offer_id: string;
    expires_at: Date | string;
  }>(
    `
    INSERT INTO discovery_selections (
      selection_id,
      tenant_id,
      site_id,
      offer_id,
      offer_retrieved_at,
      created_at,
      expires_at
    ) VALUES (
      $1, $2, $3, $4, $5, now(), now() + interval '15 minutes'
    )
    ON CONFLICT (tenant_id, site_id, selection_id) DO NOTHING
    RETURNING selection_id, offer_id, expires_at
    `,
    [input.selectionId, input.tenantId, input.siteId, input.offerId, input.offerRetrievedAt],
  );
  const row = result.rows[0];
  return row ? toCustomer(row) : null;
}

export async function createDiscoverySelection(
  db: SqlClient,
  input: {
    tenantId: string;
    siteId: string;
    offerId: string;
    selectionId: string;
  },
): Promise<CustomerDiscoverySelection> {
  return db.transact(async (tx) => {
    const existing = await findSelection(tx, input);
    if (existing) {
      return interpretExisting(existing, input.offerId);
    }

    const offer = await findSelectableOffer(tx, {
      tenantId: input.tenantId,
      offerId: input.offerId,
    });

    const inserted = await insertSelection(tx, {
      ...input,
      offerRetrievedAt: asIso(offer.retrieved_at),
    });
    if (inserted) {
      return inserted;
    }

    const raced = await findSelection(tx, input);
    if (!raced) {
      throw new ApiError(
        "INTERNAL_ERROR",
        "The request could not be processed.",
        500,
      );
    }
    return interpretExisting(raced, input.offerId);
  });
}
