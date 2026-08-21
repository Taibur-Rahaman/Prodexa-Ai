import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LicenseValidationCache } from "../cache/license-validation.js";
import { activateLicensedSite } from "../license/activate.js";
import { AUTH_UNAUTHENTICATED, validateLicensedSite } from "../license/validate.js";
import { deactivateLicensedSite } from "../license/deactivate.js";
import { normalizeDomain } from "../domain/site-domain.js";
import type { SqlClient } from "../db/sql.js";
import { ApiError, apiError } from "../http/errors.js";

const SITE_ID_PATTERN = /^sit_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FEATURE_PATTERN = /^[a-z][a-z0-9_.]{0,63}$/;

type ValidateBody = {
  domain?: unknown;
  feature?: unknown;
  tenant_id?: unknown;
  license_id?: unknown;
};

type LifecycleBody = {
  site_id?: unknown;
  tenant_id?: unknown;
  license_id?: unknown;
};

function headerString(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requestPath(request: FastifyRequest): string {
  return new URL(request.url, "http://localhost").pathname;
}

function readBody(body: unknown): ValidateBody {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Request body must be a JSON object.", 400);
  }
  return body as ValidateBody;
}

function readLifecycleBody(body: unknown): LifecycleBody {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Request body must be a JSON object.", 400);
  }
  return body as LifecycleBody;
}

function readSiteId(value: unknown): string {
  if (typeof value !== "string" || !SITE_ID_PATTERN.test(value)) {
    throw new ApiError("VALIDATION_ERROR", "A valid site_id is required.", 400);
  }
  return value;
}

function requireAuthHeaders(request: FastifyRequest): {
  siteId: string;
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const siteId = headerString(request, "x-prodexa-site-id");
  const timestamp = headerString(request, "x-prodexa-timestamp");
  const nonce = headerString(request, "x-prodexa-nonce");
  const signature = headerString(request, "x-prodexa-signature");

  if (!siteId || !timestamp || !nonce || !signature || !SITE_ID_PATTERN.test(siteId)) {
    throw AUTH_UNAUTHENTICATED;
  }

  return { siteId, timestamp, nonce, signature };
}

export function registerLicenseRoutes(
  app: FastifyInstance,
  deps: {
    db: SqlClient | null;
    apiSigningSecret: string | null;
    timestampSkewSeconds: number;
    rateLimitPerMinute: number;
    cache: LicenseValidationCache;
  },
): void {
  app.post("/v1/license/validate", async (request, reply) => {
    if (!deps.db || !deps.apiSigningSecret) {
      throw new ApiError(
        "STORE_UNAVAILABLE",
        "License validation is unavailable.",
        503,
      );
    }

    const auth = requireAuthHeaders(request);
    const payload = readBody(request.body);
    const domain = typeof payload.domain === "string" ? normalizeDomain(payload.domain) : null;
    if (!domain) {
      throw new ApiError("VALIDATION_ERROR", "A valid domain is required.", 400);
    }

    let requestedFeature: string | null = null;
    if (payload.feature !== undefined && payload.feature !== null) {
      if (typeof payload.feature !== "string" || !FEATURE_PATTERN.test(payload.feature)) {
        throw new ApiError("VALIDATION_ERROR", "Feature must be a valid feature key.", 400);
      }
      requestedFeature = payload.feature;
    }

    const decision = await validateLicensedSite(
      deps.db,
      deps.apiSigningSecret,
      {
        siteId: auth.siteId,
        timestamp: auth.timestamp,
        nonce: auth.nonce,
        signature: auth.signature,
        method: request.method,
        path: requestPath(request),
        rawBody: request.rawBody ?? "",
        domain,
        requestedFeature,
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

    return {
      valid: true,
      request_id: request.id,
      tenant_id: decision.tenant_id,
      license_id: decision.license_id,
      site_id: decision.site_id,
      plan: decision.plan,
      status: decision.status,
      starts_at: decision.starts_at,
      expires_at: decision.expires_at,
      activation: decision.activation,
      features: decision.features,
      usage: decision.usage,
    };
  });

  app.post("/v1/license/activate", async (request) => {
    if (!deps.db || !deps.apiSigningSecret) {
      throw new ApiError(
        "STORE_UNAVAILABLE",
        "License activation is unavailable.",
        503,
      );
    }

    const auth = requireAuthHeaders(request);
    const payload = readLifecycleBody(request.body);
    const bodySiteId = readSiteId(payload.site_id);

    return activateLicensedSite(
      deps.db,
      deps.apiSigningSecret,
      {
        siteId: auth.siteId,
        timestamp: auth.timestamp,
        nonce: auth.nonce,
        signature: auth.signature,
        method: request.method,
        path: requestPath(request),
        rawBody: request.rawBody ?? "",
        bodySiteId,
      },
      {
        timestampSkewSeconds: deps.timestampSkewSeconds,
        rateLimitPerMinute: deps.rateLimitPerMinute,
        cache: deps.cache,
      },
    );
  });

  app.post("/v1/license/deactivate", async (request) => {
    if (!deps.db || !deps.apiSigningSecret) {
      throw new ApiError(
        "STORE_UNAVAILABLE",
        "License deactivation is unavailable.",
        503,
      );
    }

    const auth = requireAuthHeaders(request);
    const payload = readLifecycleBody(request.body);
    const bodySiteId = readSiteId(payload.site_id);

    return deactivateLicensedSite(
      deps.db,
      deps.apiSigningSecret,
      {
        siteId: auth.siteId,
        timestamp: auth.timestamp,
        nonce: auth.nonce,
        signature: auth.signature,
        method: request.method,
        path: requestPath(request),
        rawBody: request.rawBody ?? "",
        bodySiteId,
      },
      {
        timestampSkewSeconds: deps.timestampSkewSeconds,
        rateLimitPerMinute: deps.rateLimitPerMinute,
        cache: deps.cache,
      },
    );
  });
}
