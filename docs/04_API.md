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

Production base URL will be selected during deployment and documented in environment configuration. Do not hard-code a production domain in source code.

## 3. Versioning

Initial API namespace:

`/v1/`

Breaking changes require a new API version or an explicit migration strategy.

## 4. Search Endpoint

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

## 5. Offer Selection

`POST /v1/discovery/select`

The selection endpoint creates a server-verifiable reference to the selected offer. It must revalidate important offer data before allowing it to become the source of an order.

## 6. License Endpoints

Examples:

- `POST /v1/license/activate`
- `POST /v1/license/validate`
- `POST /v1/license/deactivate`

License endpoints must enforce domain/site binding and server-side subscription status.

## 7. Usage

`GET /v1/usage`

Returns usage for the authenticated tenant/site only.

## 8. Admin Endpoints

Admin endpoints are private and require stronger authentication and authorization. Examples:

- `GET /v1/admin/licenses`
- `POST /v1/admin/licenses`
- `POST /v1/admin/licenses/{id}/suspend`
- `POST /v1/admin/licenses/{id}/renew`
- `GET /v1/admin/connectors`
- `GET /v1/admin/health`

## 9. Error Format

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

## 10. Idempotency

Mutation endpoints that may be retried should support idempotency keys.

## 11. Rate Limiting

Rate limits will be defined by plan and endpoint. The server must return a clear machine-readable error when a tenant exceeds its allowance.

## 12. Authentication

The exact authentication scheme is intentionally open. It must support:

- Site identity.
- Credential rotation.
- Revocation.
- Expiration where appropriate.
- Replay resistance for sensitive requests.

Never use a single global API secret embedded in the distributed WordPress plugin.

## 13. Webhooks / Future

Future versions may expose webhooks for license changes, connector status, or fulfillment events. Webhook signatures must be verified before processing.
