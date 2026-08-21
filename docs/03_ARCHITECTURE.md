# Prodexa AI — Architecture

## 1. Architectural Goal

Keep WordPress lightweight while moving expensive and reusable discovery work into a hosted backend. The architecture must support the owner's pilot today and multi-tenant SaaS tomorrow.

## 2. Canonical Backend Infrastructure

Prodexa's canonical backend/infrastructure domain is:

`prodexaai.cloud`

The domain is reserved for backend services and infrastructure. Service subdomains must be introduced only when required and verified first.

Potential future service boundaries include `api.prodexaai.cloud`, `admin.prodexaai.cloud`, `auth.prodexaai.cloud`, `hooks.prodexaai.cloud`, and `status.prodexaai.cloud`. These names do not imply that the services currently exist.

Hostinger is the current infrastructure provider available through Hostinger MCP. Infrastructure state must be inspected before any DNS, server, deployment, or runtime change.

## 3. High-Level Components

```text
Customer Browser
      |
      v
WordPress / WooCommerce
      |
      | HTTPS + authenticated API
      v
Prodexa API (prodexaai.cloud / verified API subdomain)
      |
      +--> Cache
      |
      +--> Discovery Orchestrator
      |       |
      |       +--> Connector A
      |       +--> Connector B
      |       +--> Connector C
      |
      +--> Normalizer
      +--> Product Matcher
      +--> Ranking Engine   ← Phase 1: unused. Search order is `ORDER BY offer_id ASC` (DEC-026).
      +--> Pricing Engine   ← Phase 1: unused. Stored `normalized_offers.price` is authoritative (DEC-021–025).
      +--> License Service
      +--> Usage / Audit Service
      |
      v
Source Websites / Official APIs
```

## 4. WordPress Responsibilities

The plugin is responsible for:

- Configuration.
- License activation.
- Secure API communication.
- Search/discovery UI integration.
- Result rendering.
- Checkout integration.
- Private order metadata.
- Merchant-facing settings.
- Graceful fallback when Prodexa is unavailable.

The plugin must not contain source credentials or perform unrestricted multi-source crawling.

Pilot implementation (T-014 / T-015 / T-017): the client lives in `plugins/prodexa-ai/`. It ships bootstrap, Settings API configuration, sealed site credentials, an HMAC HTTP client, `GET /v1/health`, a display-only `POST /v1/license/validate` refresh, a storefront `[prodexa_search]` UI that proxies `POST /v1/discovery/search`, offer select via HMAC `POST /v1/discovery/select`, and WooCommerce order metadata for the validated selection reference. HMAC secrets stay in PHP. Payment, product sync, ranking, and connectors are not implemented. Ranking is not a Phase 1 MVP contract (DEC-026). There is no dynamic pricing engine (DEC-022, DEC-025). Cached license state in WordPress is never treated as authorization. Order meta is never treated as authorization for price, license, tenant, or payment. Client-supplied Prodexa prices are never trusted (DEC-021).

## 5. Backend Responsibilities

The backend is responsible for:

- Authentication and tenant identification.
- License validation.
- Rate limiting.
- Search orchestration.
- Parallel source retrieval.
- Connector execution.
- Data normalization.
- Product matching.
- Ranking (Phase 1: unused — DEC-026; search remains `ORDER BY offer_id ASC`).
- Pricing verification (Phase 1: stored PostgreSQL `normalized_offers.price`; no dynamic engine — DEC-021–025).
- Caching.
- Usage tracking.
- Error handling.
- Audit logs.

## 6. Data Flow

### Search

1. Browser submits query through WordPress.
2. WordPress plugin sends a signed/authenticated request to Prodexa API.
3. API validates license, tenant, request, and quota.
4. API checks cache.
5. If necessary, Discovery Orchestrator runs eligible connectors in parallel.
6. Connector results are normalized.
7. Matching and ranking are performed.
8. Pricing rules are applied server-side.
9. Response is returned to WordPress.
10. WordPress renders customer-safe fields.

Pilot implementation of steps 1–3 and 10: the plugin shortcode collects the query in the browser, WordPress AJAX relays it, and PHP sends a site-HMAC `POST /v1/discovery/search`. The browser never holds the site secret. Pilot implementation of step 5–8: connectors, ranking, and a dynamic pricing engine are not implemented (DEC-022, DEC-025, DEC-026). `POST /v1/discovery/search` queries the tenant-scoped PostgreSQL `normalized_offers` index with parameterized lexical AND-match, stable `ORDER BY offer_id ASC` (DEC-026), and `display_price` equal to the stored offer price (DEC-021, DEC-024). An empty index returns an empty page. Tenant isolation uses the authenticated site's `tenant_id`, never a client-supplied id. Client-supplied prices are ignored.

### Offer selection

1. Client submits `offer_id` plus a client-generated `selection_id`.
2. API authenticates the site (HMAC) and takes tenant from that site.
3. API revalidates the offer in PostgreSQL `normalized_offers` (tenant-scoped; no connector call).
4. API persists a 15-minute selection that later checkout can verify.
5. Response returns only `selection_id`, `offer_id`, and `expires_at`.

Pilot implementation (T-016 / DEC-019): `POST /v1/discovery/select` follows this flow.

### Order

1. Customer selects an offer.
2. Plugin creates a server-verifiable selection (`POST /v1/discovery/select`) and holds it in the WooCommerce session as untrusted pending state.
3. WordPress creates the normal WooCommerce order.
4. Before Prodexa metadata is persisted, the plugin revalidates by replaying `POST /v1/discovery/select` (tenant from HMAC site identity).
5. Private order metadata stores only `_prodexa_selection_id` and `_prodexa_selection_expires_at` from the API response (DEC-020).
6. Customer pays through the merchant checkout (not implemented in the plugin).
7. Authorized admin can later use the selection reference; source URL and source price remain backend-authoritative.
8. Merchant manually fulfills the order.

Pilot implementation of steps 1–5 (T-017): invalid/expired/other-tenant selections fail checkout and do not write Prodexa meta. Payment, priced line-item creation, and a dynamic pricing engine are not implemented. The Prodexa offer price remains the stored PostgreSQL value (DEC-021–025); WooCommerce does not override it.

## 7. Multi-Tenancy

Each SaaS customer must have an isolated tenant context.

Tenant-bound data includes:

- License.
- Site/domain.
- API credentials.
- Plan.
- Usage.
- Search configuration.
- Pricing rules.
- Connector permissions.
- Order/discovery references.

A tenant must never be able to query another tenant's private data.

## 8. Caching Strategy

Caching should exist at several safe layers:

- Query/result cache.
- Source product cache.
- Normalized offer cache.
- Connector-specific cache where appropriate.

Cache entries must include timestamps and freshness information.

Financial values must be revalidated when necessary before final order confirmation.

License validation may cache post-auth evaluation extras (activation counts and usage snapshots) in Redis. HMAC, nonce replay, site secrets, and license/site status always come from PostgreSQL. Redis is optional: if `REDIS_URL` is unset or Redis is unavailable, validation continues from PostgreSQL. Cache keys are `prodexa:v1:license:validate:{tenant}:{site}:{license}:{planId}:{planVersion}` with a 60-second TTL, capped by remaining license lifetime. Plan updates change `planVersion` (`plans.updated_at`) and miss the old key. Operators should also delete by site/license prefix after status changes; TTL is the backstop. Discovery search reads tenant-scoped `normalized_offers` from PostgreSQL. Redis query/result caches for search are not implemented; `meta.cached` is always false. Discovery select persists to PostgreSQL `discovery_selections`; there is no Redis selection cache.

## 9. Reliability Strategy

Each connector should have:

- Timeout.
- Retry policy where safe.
- Circuit breaker/health state.
- Error classification.
- Rate-limit handling.

A connector failure should normally reduce result coverage rather than crash the whole request.

## 10. Security Boundaries

### Public

- Customer search input.
- Customer-safe normalized product results.

### Authenticated Merchant

- Site configuration.
- License status.
- Own usage.
- Own order metadata.

### Prodexa Operator

- Global license management.
- Connector management.
- System health.
- Global usage and operational logs.

Secrets must never cross from backend to browser.

## 11. AI Boundary

AI may be used for:

- Semantic query understanding.
- Product similarity.
- Attribute extraction.
- Duplicate/variant grouping.
- Ranking assistance.

AI must not be trusted alone for:

- Final price.
- Currency conversion without deterministic validation.
- License authorization.
- Payment totals.
- Source permission checks.
- Security decisions.

## 12. Technology Selection

Locked for the pilot (see `02_BUSINESS_DECISIONS.md` DEC-014, DEC-015, DEC-016, DEC-017, DEC-018):

- **API:** TypeScript, Node.js 22+, Fastify, repository path `apps/api`.
- **Plugin:** PHP 8.2+ on the merchant WordPress/WooCommerce site (client only). Repository path `plugins/prodexa-ai`. No production API hostname is hard-coded. Storefront search/select proxy HMAC to the API. WooCommerce order meta is the selection reference only (DEC-020).
- **Durable store:** PostgreSQL (not shared Hostinger MySQL used by other sites). Tenant-scoped `normalized_offers` is the pilot discovery search corpus and the Phase 1 offer-price source (DEC-024). Tenant/site-scoped `discovery_selections` holds 15-minute select references.
- **Cache:** Redis via `REDIS_URL` (optional). Production uses a real Redis client (`ioredis`). License validation does not depend on Redis; PostgreSQL remains authoritative for HMAC, replay, and license status.
- **Auth (plugin → API):** per-site HMAC-SHA256 (DEC-018); secrets stay server-side and never in the browser.
- **Local run:** `HOST=0.0.0.0` and `PORT` from the environment. License persistence needs `DATABASE_URL` (PostgreSQL) and `API_SIGNING_SECRET`. Redis is optional (`REDIS_URL`).
- **Production:** dedicated VPS/Docker or equivalent isolated Node runtime after human authorization. The inspected apex WordPress site on `prodexaai.cloud` is not the API.
- **Replay / nonce store (pilot):** PostgreSQL `request_nonces`. Redis remains the canonical cache and is not required for license validation.

The stack must continue to support:

- Async/concurrent HTTP retrieval.
- Background jobs.
- Fast cache access.
- Strong API authentication.
- Observability.
- Horizontal scaling.

## 13. Scaling Path

### Pilot

One hosted API service + managed database/cache + small connector set.

### Growth

Separate worker processes from API nodes, introduce queues, dedicated cache, and connector-level scaling.

### SaaS Scale

Multi-tenant orchestration, usage metering, distributed queues, connector workers, observability, and autoscaling.

## 14. Infrastructure Change Rule

Any change involving `prodexaai.cloud`, DNS, deployment targets, servers, or runtime infrastructure must be inspected and verified before it is treated as complete. Destructive production infrastructure changes require explicit human authorization.

## 15. Architecture Change Rule

Any change that moves responsibility between WordPress, API, connector, storage, infrastructure, or AI layers must be documented in `BUSINESS_DECISIONS.md` and this file before implementation is considered complete.
