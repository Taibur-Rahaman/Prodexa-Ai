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

`POST /v1/discovery/search`

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
    "cached": true,
    "count": 1
  }
}
```

Customer responses must not contain private source credentials, internal tenant data, or hidden operational secrets.

## 6. Offer Selection

`POST /v1/discovery/select`

The selection endpoint creates a server-verifiable reference to the selected offer. It must revalidate important offer data before allowing it to become the source of an order.

## 7. License Endpoints

Implemented:

- `POST /v1/license/validate`

Not implemented:

- `POST /v1/license/activate`
- `POST /v1/license/deactivate`

Validate is a protected site-authenticated endpoint. The server is authoritative for tenant, license, activation, expiration, status, feature entitlement, usage snapshot, and revocation. Clients must not send `tenant_id` as authorization; any such field is ignored.

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

Mutation endpoints that may be retried should support idempotency keys.

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
