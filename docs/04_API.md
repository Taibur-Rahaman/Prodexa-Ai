# Prodexa AI — API Specification

## 1. API Rules

- HTTPS only in production.
- Versioned endpoints.
- JSON request/response format.
- Authentication required for protected operations.
- Tenant and license context validated server-side.
- Public endpoints rate-limited.
- Request IDs included for traceability.
- Secrets never returned to clients.

## 2. Base URL

Local default: `http://localhost:8000` (`HOST` + `PORT`).

Production base URL will be selected during deployment and documented in environment configuration. Do not hard-code a production domain in source code. Do not use `api.prodexaai.cloud` until that hostname is verified to exist.

## 3. Versioning

Initial API namespace:

`/v1/`

Breaking changes require a new API version or an explicit migration strategy.

## 4. Health

Public liveness (no tenant data, no license check):

- `GET /health`
- `GET /v1/health`

Response:

```json
{
  "status": "ok",
  "service": "prodexa-api",
  "api_version": "v1"
}
```

Every response includes `x-request-id`. These routes must not return secrets, stack traces, or connector internals.

Authenticated operator health remains `GET /v1/admin/health` and is not implemented yet.

## 5. Search Endpoint

Implemented (local only; not deployed):

`POST /v1/discovery/search`

Protected site-HMAC endpoint (DEC-018). The server resolves tenant and license from `x-prodexa-site-id`; clients must not send `tenant_id` as authorization (ignored if present). Feature `discovery.search` is required. Daily search quota is checked and is not incremented here (usage metering remains a later task).

Headers: same as `POST /v1/license/validate` (`x-prodexa-site-id`, `x-prodexa-timestamp`, `x-prodexa-nonce`, `x-prodexa-signature`, optional `x-request-id`). Search does not send `domain` in the body; license domain binding uses the site's stored activation domain.

### Request

```json
{
  "query": "bata gift card bangladesh",
  "page": 1,
  "limit": 10,
  "context": {
    "country": "BD",
    "currency": "BDT"
  }
}
```

`query` is required (trimmed, 1–200 characters, at most 12 whitespace-separated terms). `page` defaults to 1 (minimum 1). `limit` defaults to 10 (maximum 20). `context` is optional. When `context.currency` is set, results are restricted to that ISO 4217 code. `context.country` must be ISO 3166-1 alpha-2 when present; it is accepted for connector routing later and does not filter the offer index (offers have no country field).

Pilot search is parameterized PostgreSQL lexical AND-match of query terms against `title` and `description` on the tenant-scoped `normalized_offers` table. Order is deterministic `ORDER BY offer_id ASC` (DEC-026). Ranking is not a Phase 1 MVP contract: no score, rank field, sort parameter, ranking API, ML/AI ranking, connector-based ranking, price-based ranking, or personalization. Connectors are not implemented (T-013); an empty index returns `results: []`. Search/index technology remains unlocked in the PRD; this loop does not introduce Elasticsearch or vector search. Redis query/result cache is not implemented; `meta.cached` is always `false`. Phase 1 `display_price` is the stored offer `price` (DEC-022, DEC-024). There is no pricing engine or quote endpoint (DEC-025). Client-supplied `price` / `display_price` in the search body is ignored.

### Response Shape

```json
{
  "request_id": "req_...",
  "results": [
    {
      "offer_id": "off_...",
      "title": "Example Product",
      "image_url": "https://example.com/image.jpg",
      "display_price": 1000,
      "currency": "BDT",
      "availability": "unknown",
      "freshness": {
        "retrieved_at": "2026-08-21T00:00:00Z"
      }
    }
  ],
  "meta": {
    "cached": false,
    "count": 1
  }
}
```

`meta.count` is the number of hits on this page, not a total. Customer responses must not contain private source credentials, `source_url`, `source_id`, internal tenant data, or hidden operational secrets.

Deterministic errors (standard error format):

| HTTP | code | when |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid JSON, query, page, limit, or context |
| 401 | `UNAUTHENTICATED` | missing/invalid HMAC or unknown site |
| 401 | `AUTH_EXPIRED` | timestamp outside skew window |
| 401 | `AUTH_REPLAY` | nonce already used for this site |
| 403 | `SITE_REVOKED` | site activation revoked |
| 403 | `LICENSE_REVOKED` / `LICENSE_SUSPENDED` / `LICENSE_PENDING` / `LICENSE_EXPIRED` | license not usable |
| 403 | `ACTIVATION_LIMIT_EXCEEDED` | active sites exceed limit |
| 403 | `FEATURE_NOT_ENTITLED` | plan does not include `discovery.search` |
| 403 | `USAGE_LIMIT_EXCEEDED` | daily search quota already exhausted |
| 429 | `RATE_LIMITED` | too many HMAC requests for the site |
| 503 | `STORE_UNAVAILABLE` | no PostgreSQL / signing secret configured |

## 6. Offer Selection

Implemented (local only; not deployed):

`POST /v1/discovery/select`

Creates a short-lived, server-verifiable selection reference for an offer already returned by discovery search. Phase 1 revalidates against PostgreSQL `normalized_offers` only. Connectors are not called (T-013 remains BLOCKED). Future connector-backed live revalidation requires a separate documented decision.

Protected site-HMAC endpoint (DEC-018 / DEC-019). Tenant is derived from the authenticated site. Clients must not send `tenant_id` as authorization (ignored if present). Feature `discovery.search` is required. Daily search quota is checked and is not incremented (usage metering remains a later task). HMAC per-site rate limiting may return `429`.

Headers: same as `POST /v1/license/validate` (`x-prodexa-site-id`, `x-prodexa-timestamp`, `x-prodexa-nonce`, `x-prodexa-signature`, optional `x-request-id`).

This endpoint does not recalculate price, rank results (DEC-026), start checkout, take payment, or call external connectors. It does not write WooCommerce order metadata; the WordPress plugin does that after a successful replay (DEC-020). Client-supplied `price` / `display_price` is ignored (DEC-021, DEC-025). There is no quote endpoint. When a later server-side flow needs the selected offer price, it is resolved from PostgreSQL `normalized_offers` for the authenticated tenant.

### Request

```json
{
  "offer_id": "off_...",
  "selection_id": "<client-generated idempotency key>"
}
```

`offer_id` is required (`off_` prefix, 1–120 additional `[A-Za-z0-9._-]` characters). `selection_id` is required (8–128 `[A-Za-z0-9._-]` characters) and is the idempotency key within the authenticated tenant/site.

The offer must belong to the authenticated tenant and must be currently selectable: `availability` is `in_stock`, `preorder`, or `unknown`, and `expires_at` is null or in the future. `out_of_stock` and expired offers are rejected.

### Persistence

A selection row stores at least: `selection_id`, `tenant_id`, `site_id`, `offer_id`, `offer_retrieved_at` (offer/version reference for later verification), `created_at`, `expires_at`. TTL is 15 minutes. Expired selections are invalid. Redis is not used for selections.

### Response

Customer-safe fields only. Success bodies do not include `tenant_id`, `site_id`, `source_url`, `source_id`, or other internal identifiers.

```json
{
  "selection_id": "sel_...",
  "offer_id": "off_...",
  "expires_at": "2026-08-21T00:15:00.000Z"
}
```

`expires_at` is ISO-8601. Repeat of the same valid request returns the existing active selection. Reusing `selection_id` for a different offer returns `409`. Replaying an expired `selection_id` returns `410`; the client must mint a new key. The WordPress plugin uses this idempotent repeat as the checkout verify path. There is no GET selection endpoint.

Deterministic errors (standard error format):

| HTTP | code | when |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid JSON, `offer_id`, or `selection_id` |
| 401 | `UNAUTHENTICATED` | missing/invalid HMAC or unknown site |
| 401 | `AUTH_EXPIRED` | timestamp outside skew window |
| 401 | `AUTH_REPLAY` | nonce already used for this site |
| 403 | `SITE_REVOKED` | site activation revoked |
| 403 | `LICENSE_REVOKED` / `LICENSE_SUSPENDED` / `LICENSE_PENDING` / `LICENSE_EXPIRED` | license not usable |
| 403 | `ACTIVATION_LIMIT_EXCEEDED` | active sites exceed limit |
| 403 | `FEATURE_NOT_ENTITLED` | plan does not include `discovery.search` |
| 403 | `USAGE_LIMIT_EXCEEDED` | daily search quota already exhausted |
| 404 | `OFFER_NOT_FOUND` | offer does not exist or is not visible to the tenant |
| 409 | `SELECTION_CONFLICT` | `selection_id` already bound to a different offer |
| 410 | `SELECTION_EXPIRED` | existing selection TTL elapsed |
| 422 | `OFFER_NOT_SELECTABLE` | offer inactive, expired, or otherwise not selectable |
| 429 | `RATE_LIMITED` | too many HMAC requests for the site |
| 503 | `STORE_UNAVAILABLE` | no PostgreSQL / signing secret configured |

## 7. License Endpoints

Implemented:

- `POST /v1/license/validate`
- `POST /v1/license/activate` (DEC-027)
- `POST /v1/license/deactivate` (DEC-027)

Validate is a protected site-authenticated endpoint. The server is authoritative for tenant, license, activation, expiration, status, feature entitlement, usage snapshot, and revocation. Clients must not send `tenant_id` as authorization; any such field is ignored. Activate and deactivate reuse the same HMAC/nonce model; they do not change validate semantics.

### `POST /v1/license/validate`

Headers:

- `x-prodexa-site-id` — site public id (`sit_<uuid>`)
- `x-prodexa-timestamp` — Unix seconds
- `x-prodexa-nonce` — unique request nonce
- `x-prodexa-signature` — hex HMAC-SHA256 (see Authentication)
- `x-request-id` — trace id (optional; generated if omitted)
- `content-type: application/json`

Request:

```json
{
  "domain": "shop.example.com",
  "feature": "discovery.search"
}
```

`domain` is required. `feature` is optional; when present, the plan must entitle that feature and, for `discovery.search`, the daily search quota must not already be exhausted.

Success `200`:

```json
{
  "valid": true,
  "request_id": "req_...",
  "tenant_id": "…",
  "license_id": "…",
  "site_id": "sit_…",
  "plan": {
    "id": "…",
    "code": "pilot",
    "name": "Pilot"
  },
  "status": "active",
  "starts_at": "2026-01-01T00:00:00.000Z",
  "expires_at": "2027-01-01T00:00:00.000Z",
  "activation": {
    "domain": "shop.example.com",
    "limit": 1,
    "used": 1
  },
  "features": {
    "discovery.search": true
  },
  "usage": {
    "period_start": "2026-08-21",
    "search_requests": { "used": 0, "limit": 1000 },
    "connector_calls": { "used": 0, "limit": 5000 }
  }
}
```

The response never includes license keys, site secrets, or wrapping keys.

Deterministic errors (body uses the standard error format):

| HTTP | code | when |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid JSON or domain/feature |
| 401 | `UNAUTHENTICATED` | missing/invalid HMAC or unknown site |
| 401 | `AUTH_EXPIRED` | timestamp outside skew window |
| 401 | `AUTH_REPLAY` | nonce already used for this site |
| 403 | `SITE_REVOKED` | site activation revoked |
| 403 | `DOMAIN_MISMATCH` | normalized domain ≠ activation |
| 403 | `LICENSE_REVOKED` | license revoked |
| 403 | `LICENSE_SUSPENDED` | license suspended |
| 403 | `LICENSE_PENDING` | pending or not yet started |
| 403 | `LICENSE_EXPIRED` | expired by status or `expires_at` |
| 403 | `ACTIVATION_LIMIT_EXCEEDED` | active sites exceed limit |
| 403 | `FEATURE_NOT_ENTITLED` | requested feature not on plan |
| 403 | `USAGE_LIMIT_EXCEEDED` | requested feature over quota |
| 429 | `RATE_LIMITED` | too many validate requests for the site |
| 503 | `STORE_UNAVAILABLE` | no PostgreSQL / signing secret configured |

License endpoints must enforce domain/site binding and server-side subscription status.

`POST /v1/license/validate` may read activation-count and usage snapshots from Redis after HMAC/nonce checks succeed. The JSON contract is unchanged. Cached extras TTL is 60 seconds (capped by `expires_at`). Revocation, suspension, expiry, and domain binding are re-read from PostgreSQL on every request. If Redis is unset or down, validation uses PostgreSQL only. Responses never include cache internals or secrets.

### `POST /v1/license/activate`

Binds an authorized WordPress/site installation to its existing license (DEC-027). Requires a pre-provisioned `site_activations` row so HMAC can authenticate. Tenant and license are derived server-side from that row. Clients must not send `tenant_id` as authorization (ignored if present).

Headers: same as validate (`x-prodexa-site-id`, `x-prodexa-timestamp`, `x-prodexa-nonce`, `x-prodexa-signature`, optional `x-request-id`).

Request:

```json
{
  "site_id": "sit_..."
}
```

`site_id` is required and must equal the authenticated `x-prodexa-site-id`.

Success `200`:

```json
{
  "activated": true,
  "site_id": "sit_..."
}
```

Idempotent when the same tenant + site + license is already `active`. Reactivating a `revoked` site checks `licenses.activation_limit` against other active sites for that license. Does not mint secrets, return license keys, or create billing/subscription state. Successful activation count changes invalidate Redis license-validation cache for the license when Redis is configured.

| HTTP | code | when |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid JSON or `site_id` |
| 401 | `UNAUTHENTICATED` | missing/invalid HMAC or unknown site |
| 401 | `AUTH_EXPIRED` | timestamp outside skew window |
| 401 | `AUTH_REPLAY` | nonce already used for this site |
| 403 | `SITE_MISMATCH` | body `site_id` ≠ authenticated site |
| 404 | `ASSOCIATION_NOT_FOUND` | license/site association missing after auth |
| 409 | `ACTIVATION_LIMIT_EXCEEDED` | active sites would exceed `licenses.activation_limit` |
| 422 | `LICENSE_NOT_ACTIVATABLE` | license revoked, suspended, pending, or expired |
| 429 | `RATE_LIMITED` | too many HMAC requests for the site |
| 503 | `STORE_UNAVAILABLE` | no PostgreSQL / signing secret configured |

### `POST /v1/license/deactivate`

Removes the active association between the authenticated site and its license (DEC-027). Sets `site_activations.status` to `revoked` (existing inactive state). Does not delete the site row, the license, or historical usage records.

Headers: same as validate.

Request:

```json
{
  "site_id": "sit_..."
}
```

Success `200`:

```json
{
  "deactivated": true,
  "site_id": "sit_..."
}
```

Idempotent when already inactive (`revoked`). Successful status changes invalidate Redis license-validation cache for the license when Redis is configured. Secrets are never returned.

| HTTP | code | when |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid JSON or `site_id` |
| 401 | `UNAUTHENTICATED` | missing/invalid HMAC or unknown site |
| 401 | `AUTH_EXPIRED` | timestamp outside skew window |
| 401 | `AUTH_REPLAY` | nonce already used for this site |
| 403 | `SITE_MISMATCH` | body `site_id` ≠ authenticated site |
| 404 | `ASSOCIATION_NOT_FOUND` | license/site association missing after auth |
| 429 | `RATE_LIMITED` | too many HMAC requests for the site |
| 503 | `STORE_UNAVAILABLE` | no PostgreSQL / signing secret configured |

## 8. Usage

`GET /v1/usage`

Returns usage for the authenticated tenant/site only.

## 9. Admin Endpoints

Admin endpoints are private and require stronger authentication and authorization. Examples:

- `GET /v1/admin/licenses`
- `POST /v1/admin/licenses`
- `POST /v1/admin/licenses/{id}/suspend`
- `POST /v1/admin/licenses/{id}/renew`
- `GET /v1/admin/connectors`
- `GET /v1/admin/health`

## 10. Error Format

```json
{
  "error": {
    "code": "LICENSE_EXPIRED",
    "message": "The Prodexa license is not active.",
    "request_id": "req_..."
  }
}
```

Error messages must not leak credentials, SQL details, internal stack traces, or sensitive source information.

## 11. Idempotency

Mutation endpoints that may be retried should support idempotency keys. `POST /v1/discovery/select` uses client-generated `selection_id` as the idempotency key within the authenticated tenant and site.

## 12. Rate Limiting

Rate limits will be defined by plan and endpoint. The server must return a clear machine-readable error when a tenant exceeds its allowance.

## 13. Authentication

Locked (DEC-017, DEC-018): plugin-to-API authentication is site-scoped HMAC-SHA256. The site secret is stored only on the merchant server (WordPress) and in Prodexa PostgreSQL (encrypted at rest). It must never be sent to browsers or embedded as a global plugin constant.

Canonical signature string (UTF-8, newline-separated):

```text
v1
<METHOD>
<PATH>
<TIMESTAMP>
<NONCE>
<SHA256_HEX(raw_body)>
<SITE_ID>
```

`x-prodexa-signature` is hex HMAC-SHA256 of that string using the site secret. Timestamp must be Unix seconds within `AUTH_TIMESTAMP_SKEW_SECONDS` (default 300). Nonces are single-use per site.

It supports:

- Site identity (`x-prodexa-site-id`).
- Credential rotation (replace encrypted site secret).
- Revocation (site `revoked` or license `revoked`/`suspended`).
- Expiration (license `expires_at` and request timestamp window).
- Replay resistance (timestamp + nonce).

Never use a single global API secret embedded in the distributed WordPress plugin.

## 14. Webhooks / Future

Future versions may expose webhooks for license changes, connector status, or fulfillment events. Webhook signatures must be verified before processing.
