# Prodexa AI — Tasks

## Loop log

| Loop | Date | Result | Notes |
| --- | --- | --- | --- |
| 1 | 2026-08-21 | COMPLETE | Inspected Hostinger (read-only). Locked stack (DEC-014–017). Shipped local `GET /health` + `/v1/health`. |
| 2 | 2026-08-21 | COMPLETE | PostgreSQL license model + HMAC `POST /v1/license/validate`. Hostinger inspected read-only; no infra change. |
| 3 | 2026-08-21 | COMPLETE | Optional Redis cache for license validation extras (`REDIS_URL`). HMAC/replay/status stay on PostgreSQL. Hostinger unchanged. |
| 4 | 2026-08-21 | COMPLETE | HMAC `POST /v1/discovery/search` against tenant-scoped PostgreSQL `normalized_offers`. No connectors/Hostinger change. |
| 6 | 2026-08-21 | COMPLETE | WordPress plugin skeleton in `plugins/prodexa-ai/`. T-013 remains BLOCKED. Hostinger unchanged. |
| 7 | 2026-08-21 | COMPLETE | Storefront `[prodexa_search]` proxies HMAC `POST /v1/discovery/search`. T-013 remains BLOCKED. Hostinger unchanged. |
| 8 | 2026-08-21 | BLOCKED | `POST /v1/discovery/select` contract was undefined. No implementation. |
| 10 | 2026-08-21 | COMPLETE | WooCommerce order metadata stores HMAC-validated `selection_id` (DEC-020). T-013 remains BLOCKED. Hostinger unchanged. |
| 11 | 2026-08-21 | NEEDS_DECISION | Pricing engine blocked until DEC-021–025 were locked. No implementation. |
| 12 | 2026-08-21 | COMPLETE | Locked DEC-021–025. Phase 1 stored PostgreSQL price; no dynamic engine or quote API. T-013 remains BLOCKED. Hostinger unchanged. |

## Completed

### T-001 — Inspect repository
- **Priority:** P1
- **Status:** done
- **Files:** repo tree (docs-only until loop 1)
- **Tests:** n/a
- **Docs:** this file, `10_MEMORY.md`

### T-002 — Inspect Hostinger / DNS / deploy state
- **Priority:** P1
- **Status:** done (read-only)
- **Files:** none mutated on Hostinger
- **Tests:** public DNS + HTTPS probe
- **Docs:** `14_DEPLOYMENT.md`, `02_BUSINESS_DECISIONS.md` DEC-016

### T-003 — Confirm `prodexaai.cloud`
- **Priority:** P1
- **Status:** done
- **Result:** DNS at Hostinger; not registered via Hostinger Domains; WordPress on apex; `api.prodexaai.cloud` does not exist

### T-004 — Select backend stack
- **Priority:** P1
- **Status:** done
- **Docs:** DEC-014, `03_ARCHITECTURE.md`

### T-005 — Select hosting architecture
- **Priority:** P1
- **Status:** done
- **Docs:** DEC-015, DEC-016, `14_DEPLOYMENT.md`

### T-006 — Normalized offer schema in TypeScript
- **Priority:** P2
- **Status:** done
- **Files:** `apps/api/src/domain/offer.ts`
- **Tests:** `apps/api/src/offer.test.ts`

### T-007 — Define authentication strategy
- **Priority:** P1
- **Status:** done (DEC-017 + DEC-018 HMAC implemented for license validate)
- **Docs:** DEC-017, DEC-018, `04_API.md`

### T-010 — API health endpoint
- **Priority:** P1
- **Status:** done (local only; not deployed)
- **Files:** `apps/api/src/routes/health.ts`, `apps/api/src/app.ts`
- **Tests:** `apps/api/src/health.test.ts`

### T-008 — License database model (PostgreSQL)
- **Priority:** P1
- **Status:** done (local schema/migrations; no production database)
- **Files:** `apps/api/migrations/001_license_schema.sql`, `apps/api/src/db/`
- **Tests:** `apps/api/src/license.validate.test.ts`
- **Docs:** `07_LICENSE_SYSTEM.md`, `03_ARCHITECTURE.md`

### T-009 — Site authentication + `POST /v1/license/validate`
- **Priority:** P1
- **Status:** done (local only; not deployed)
- **Files:** `apps/api/src/routes/license.ts`, `apps/api/src/license/validate.ts`, `apps/api/src/auth/`
- **Tests:** `apps/api/src/license.validate.test.ts`, HMAC/domain/license unit tests
- **Docs:** `04_API.md`, DEC-018

### T-011 — Cache strategy (Redis)
- **Priority:** P2
- **Status:** done (local optional Redis; no production Redis provisioned)
- **Files:** `apps/api/src/cache/`, `apps/api/src/license/validate.ts`, `apps/api/src/index.ts`
- **Tests:** `apps/api/src/cache/*.test.ts`, `apps/api/src/license.cache.test.ts`
- **Docs:** `03_ARCHITECTURE.md`, `04_API.md`

### T-012 — Discovery search endpoint
- **Priority:** P2
- **Status:** done (local only; not deployed; no connectors)
- **Files:** `apps/api/migrations/002_normalized_offers.sql`, `apps/api/src/routes/discovery.ts`, `apps/api/src/discovery/`
- **Tests:** `apps/api/src/discovery.search.test.ts`, `apps/api/src/discovery/query.test.ts`
- **Docs:** `04_API.md`, `03_ARCHITECTURE.md`

### T-014 — WordPress plugin skeleton
- **Priority:** P2
- **Status:** done (plugin client only; not deployed; apex WordPress on `prodexaai.cloud` untouched)
- **Files:** `plugins/prodexa-ai/`
- **Tests:** `php plugins/prodexa-ai/tests/run.php` (HMAC, sanitizer, settings, HTTP client, nonce/capability, bootstrap)
- **Docs:** `05_WORDPRESS_PLUGIN.md`, `03_ARCHITECTURE.md`

### T-015 — Storefront discovery UI
- **Priority:** P2
- **Status:** done (plugin client only; not deployed; apex WordPress on `prodexaai.cloud` untouched)
- **Files:** `plugins/prodexa-ai/includes/class-discovery.php`, `plugins/prodexa-ai/includes/class-storefront.php`, `plugins/prodexa-ai/assets/`, `plugins/prodexa-ai/templates/storefront-search.php`
- **Tests:** `php plugins/prodexa-ai/tests/run.php` (discovery projection, storefront nonce/HMAC proxy, XSS/secret scans)
- **Docs:** `05_WORDPRESS_PLUGIN.md`, `03_ARCHITECTURE.md`

### T-016 — Discovery select endpoint
- **Priority:** P2
- **Status:** done (local only; not deployed; no connectors; no WooCommerce metadata)
- **Files:** `apps/api/migrations/003_discovery_selections.sql`, `apps/api/src/discovery/select.ts`, `apps/api/src/routes/discovery.ts`
- **Tests:** `apps/api/src/discovery.select.test.ts`, `apps/api/src/discovery/select-input.test.ts`
- **Docs:** `04_API.md`, DEC-019, `03_ARCHITECTURE.md`

### T-017 — WooCommerce order metadata
- **Priority:** P2
- **Status:** done (plugin client only; not deployed; apex WordPress on `prodexaai.cloud` untouched)
- **Files:** `plugins/prodexa-ai/includes/class-selection.php`, `plugins/prodexa-ai/includes/class-woocommerce.php`, `plugins/prodexa-ai/includes/class-storefront.php`, `plugins/prodexa-ai/includes/class-api-client.php`
- **Tests:** `php plugins/prodexa-ai/tests/run.php` (valid/expired/invalid/tenant-mismatch attach, select HMAC proxy, untrusted client meta stripped)
- **Docs:** `05_WORDPRESS_PLUGIN.md`, DEC-020, `03_ARCHITECTURE.md`, `08_SECURITY.md`

### T-018 — Phase 1 stored-price authority
- **Priority:** P2
- **Status:** done (no pricing engine; no quote endpoint; local only)
- **Files:** `apps/api/src/discovery/stored-price.ts`, `apps/api/src/discovery/search.ts`, `apps/api/src/discovery/select.ts`, plugin selection/order metadata (unchanged trust model)
- **Tests:** `apps/api/src/discovery/stored-price.test.ts`, search/select client-price ignore tests, plugin select/order meta price stripping
- **Docs:** DEC-021–025, `04_API.md`, `03_ARCHITECTURE.md`, `05_WORDPRESS_PLUGIN.md`

## Now

- [ ] **T-013** Build first permitted connector. P2 — **BLOCKED**: first connector source is not decided. Do not guess a connector.

## Next

- [ ] Add ranking baseline.
- [ ] Add source freshness handling.
- [ ] Add connector health monitoring.
- [ ] Add integration tests.
- [ ] Add load/performance tests.

## Later

- [ ] Add pricing engine / markup / quote API — **deferred** (DEC-022, DEC-025) until a future locked decision. Do not invent formulas.
- [ ] Dedicated Hostinger VPS/Docker for API (human authorization required).
- [ ] Decide fate of WordPress currently on apex `prodexaai.cloud` (human decision; do not delete).
- [ ] Create API hostname/subdomain only after runtime exists (human authorization).
- [ ] Build admin portal.
- [ ] Add subscription billing.
- [ ] Add usage metering.
- [ ] Add self-service customer onboarding.
- [ ] Package commercial release.

## Task Rules

Each implementation task should have:

- Clear objective.
- Relevant source-of-truth documents.
- Acceptance criteria.
- Test expectation.
- Any decision dependency.

Do not mark a task complete based only on code generation. It is complete after verification.

Infrastructure tasks must additionally record:

- affected domain/subdomain
- Hostinger resource
- pre-change state
- post-change verification
- whether human authorization was required
