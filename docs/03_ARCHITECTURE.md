# Prodexa AI — Architecture

## 1. Architectural Goal

Keep WordPress lightweight while moving expensive and reusable discovery work into a hosted backend. The architecture must support the owner's pilot today and multi-tenant SaaS tomorrow.

## 2. High-Level Components

```text
Customer Browser
      |
      v
WordPress / WooCommerce
      |
      | HTTPS + authenticated API
      v
Prodexa API
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
      +--> Ranking Engine
      +--> Pricing Engine
      +--> License Service
      +--> Usage / Audit Service
      |
      v
Source Websites / Official APIs
```

## 3. WordPress Responsibilities

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

## 4. Backend Responsibilities

The backend is responsible for:

- Authentication and tenant identification.
- License validation.
- Rate limiting.
- Search orchestration.
- Parallel source retrieval.
- Connector execution.
- Data normalization.
- Product matching.
- Ranking.
- Pricing verification.
- Caching.
- Usage tracking.
- Error handling.
- Audit logs.

## 5. Data Flow

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

### Order

1. Customer selects an offer.
2. WordPress creates the normal WooCommerce order.
3. Plugin sends/records a server-verifiable discovery reference.
4. Private source metadata is stored with the order.
5. Customer pays through the merchant checkout.
6. Authorized admin reviews source URL and source price.
7. Merchant manually fulfills the order.

## 6. Multi-Tenancy

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

## 7. Caching Strategy

Caching should exist at several safe layers:

- Query/result cache.
- Source product cache.
- Normalized offer cache.
- Connector-specific cache where appropriate.

Cache entries must include timestamps and freshness information.

Financial values must be revalidated when necessary before final order confirmation.

## 8. Reliability Strategy

Each connector should have:

- Timeout.
- Retry policy where safe.
- Circuit breaker/health state.
- Error classification.
- Rate-limit handling.

A connector failure should normally reduce result coverage rather than crash the whole request.

## 9. Security Boundaries

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

## 10. AI Boundary

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

## 11. Technology Selection

Technology choices remain open until implementation planning. The selected stack must support:

- Async/concurrent HTTP retrieval.
- Background jobs.
- Fast cache access.
- PostgreSQL or equivalent durable storage where needed.
- Strong API authentication.
- Observability.
- Horizontal scaling.

Do not lock a framework merely for convenience before validating the workload.

## 12. Scaling Path

### Pilot

One hosted API service + managed database/cache + small connector set.

### Growth

Separate worker processes from API nodes, introduce queues, dedicated cache, and connector-level scaling.

### SaaS Scale

Multi-tenant orchestration, usage metering, distributed queues, connector workers, observability, and autoscaling.

## 13. Architecture Change Rule

Any change that moves responsibility between WordPress, API, connector, storage, or AI layers must be documented in `BUSINESS_DECISIONS.md` and this file before implementation is considered complete.
