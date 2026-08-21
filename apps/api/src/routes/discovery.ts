import type { FastifyInstance, FastifyRequest } from "fastify";
import { AUTH_UNAUTHENTICATED, validateLicensedSite } from "../license/validate.js";
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_PAGE,
  SEARCH_MAX_LIMIT,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_TOKEN_MAX,
  tokenizeSearchQuery,
} from "../discovery/query.js";
import { searchNormalizedOffers } from "../discovery/search.js";
import type { LicenseValidationCache } from "../cache/license-validation.js";
import type { SqlClient } from "../db/sql.js";
import { ApiError, apiError } from "../http/errors.js";

const SITE_ID_PATTERN = /^sit_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

type SearchBody = {
  query?: unknown;
  page?: unknown;
  limit?: unknown;
  context?: unknown;
  tenant_id?: unknown;
};

function headerString(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requestPath(request: FastifyRequest): string {
  return new URL(request.url, "http://localhost").pathname;
}

function readBody(body: unknown): SearchBody {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Request body must be a JSON object.", 400);
  }
  return body as SearchBody;
}

function readQuery(value: unknown): string[] {
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", "A search query is required.", 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "A search query is required.", 400);
  }
  if (trimmed.length > SEARCH_QUERY_MAX_LENGTH) {
    throw new ApiError("VALIDATION_ERROR", "Search query is too long.", 400);
  }
  const tokens = tokenizeSearchQuery(trimmed);
  if (tokens.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "A search query is required.", 400);
  }
  if (tokens.length > SEARCH_TOKEN_MAX) {
    throw new ApiError("VALIDATION_ERROR", "Search query has too many terms.", 400);
  }
  return tokens;
}

function readPositiveInt(value: unknown, fallback: number, maximum: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw new ApiError("VALIDATION_ERROR", `${name} is invalid.`, 400);
  }
  return value;
}

function readContext(value: unknown): { currency: string | null } {
  if (value === undefined) {
    return { currency: null };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", "context must be an object.", 400);
  }
  const context = value as { country?: unknown; currency?: unknown };
  if (context.country !== undefined) {
    if (typeof context.country !== "string" || !COUNTRY_PATTERN.test(context.country)) {
      throw new ApiError("VALIDATION_ERROR", "context.country must be an ISO 3166-1 alpha-2 code.", 400);
    }
  }
  if (context.currency === undefined) {
    return { currency: null };
  }
  if (typeof context.currency !== "string" || !CURRENCY_PATTERN.test(context.currency)) {
    throw new ApiError("VALIDATION_ERROR", "context.currency must be an ISO 4217 code.", 400);
  }
  return { currency: context.currency.toUpperCase() };
}

export function registerDiscoveryRoutes(
  app: FastifyInstance,
  deps: {
    db: SqlClient | null;
    apiSigningSecret: string | null;
    timestampSkewSeconds: number;
    rateLimitPerMinute: number;
    cache: LicenseValidationCache;
  },
): void {
  app.post("/v1/discovery/search", async (request, reply) => {
    if (!deps.db || !deps.apiSigningSecret) {
      throw new ApiError(
        "STORE_UNAVAILABLE",
        "Discovery search is unavailable.",
        503,
      );
    }

    const siteId = headerString(request, "x-prodexa-site-id");
    const timestamp = headerString(request, "x-prodexa-timestamp");
    const nonce = headerString(request, "x-prodexa-nonce");
    const signature = headerString(request, "x-prodexa-signature");

    if (!siteId || !timestamp || !nonce || !signature || !SITE_ID_PATTERN.test(siteId)) {
      throw AUTH_UNAUTHENTICATED;
    }

    const payload = readBody(request.body);
    const tokens = readQuery(payload.query);
    const page = readPositiveInt(payload.page, SEARCH_DEFAULT_PAGE, 10_000, "page");
    const limit = readPositiveInt(payload.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT, "limit");
    const context = readContext(payload.context);

    const decision = await validateLicensedSite(
      deps.db,
      deps.apiSigningSecret,
      {
        siteId,
        timestamp,
        nonce,
        signature,
        method: request.method,
        path: requestPath(request),
        rawBody: request.rawBody ?? "",
        requestedFeature: "discovery.search",
      },
      {
        timestampSkewSeconds: deps.timestampSkewSeconds,
        rateLimitPerMinute: deps.rateLimitPerMinute,
        cache: deps.cache,
      },
    );

    if (!decision.ok) {
      return reply.status(decision.statusCode).send(
        apiError(decision.code, decision.message, request.id),
      );
    }

    const results = await searchNormalizedOffers(deps.db, {
      tenantId: decision.tenant_id,
      tokens,
      currency: context.currency,
      page,
      limit,
    });

    return {
      request_id: request.id,
      results,
      meta: {
        cached: false,
        count: results.length,
      },
    };
  });
}
