# Prodexa AI — Project Memory

## Purpose

This is a compact durable memory file for AI coding agents. It records current state, not every historical detail.

## Current Product

Prodexa AI is being built as a product-discovery engine with a WordPress/WooCommerce plugin and hosted backend API.

## Current Stage

Pilot / MVP. Last completed autonomous loop: **15**. Loop 14 locked DEC-026 (ranking deferred). Loop 15 locked DEC-027 (license activate/deactivate). Milestone: Phase 1 — Pilot MVP (in progress).

## Locked Architecture

- WordPress plugin = client/integration layer.
- Hosted Prodexa API = discovery/control layer.
- Connectors = isolated source integrations.
- Discovery data is not automatically imported as permanent WooCommerce products.
- Customer pays merchant through existing checkout.
- Initial fulfillment is manual.
- License enforcement is server-side.
- API runtime: TypeScript / Node.js 22+ / Fastify (`apps/api`).
- Durable store: PostgreSQL (not shared Hostinger MySQL).
- Cache: Redis via optional `REDIS_URL` (ioredis). License validate caches activation/usage extras; HMAC/replay/status stay on PostgreSQL. App starts without Redis.
- Plugin→API auth: per-site HMAC-SHA256 (DEC-018); secrets encrypted at rest; no browser-held site secret.
- Canonical domain `prodexaai.cloud`; `api.prodexaai.cloud` does not exist.
- License validation is local-only: PostgreSQL model + `POST /v1/license/validate` with optional Redis cache (T-011). Activate/deactivate are implemented (T-019 / DEC-027): HMAC-authenticated, server-resolved tenant/license, `licenses.activation_limit`, inactive state = `site_activations.status = revoked`, no billing.
- Discovery search is local-only: HMAC `POST /v1/discovery/search` against tenant-scoped PostgreSQL `normalized_offers` (T-012). No connectors or Redis search cache. Order is `ORDER BY offer_id ASC`. Ranking is **deferred** (DEC-026): not a Phase 1 MVP contract; no score, rank field, sort parameter, ranking API, ML/AI ranking, connector-based ranking, price-based ranking, or personalization. Phase 1 `display_price` is stored `normalized_offers.price` (DEC-021–025). No dynamic pricing engine or quote endpoint.
- Discovery select is local-only: HMAC `POST /v1/discovery/select` against PostgreSQL `normalized_offers` + `discovery_selections` (T-016 / DEC-019). 15-minute TTL. No connector revalidation, ranking, or price in the select response. Client-supplied price is ignored.
- WordPress plugin is in `plugins/prodexa-ai/` (T-014 / T-015 / T-017): settings, sealed site credentials, HMAC client, health check, display-only license refresh, storefront `[prodexa_search]`, HMAC `POST /v1/discovery/select`, and WooCommerce order metadata for `_prodexa_selection_id` + `_prodexa_selection_expires_at` (DEC-020). Order meta is not authoritative for price, license, tenant, or payment. Client-supplied Prodexa prices are never trusted (DEC-021). Payment, product sync, and connectors are not implemented. Plugin does not yet call activate/deactivate.
- **T-013 remains BLOCKED:** first connector source is not decided. Do not guess a connector.
- Dynamic pricing engine / markup / quote API is **deferred** (DEC-022, DEC-025).
- Ranking is **deferred** (DEC-026). Do not add ranking code or change discovery order.

## Locked Product Principles

- Fast storefront.
- Cache aggressively where safe.
- Parallelize external retrieval in backend.
- Keep secrets server-side.
- Keep source/order traceability for authorized admins.
- AI assists but does not control financial truth.
- Do not bypass source access controls.

## Hostinger (inspected 2026-08-21, no changes)

- DNS for `prodexaai.cloud` is at Hostinger. Domain is not registered through Hostinger Domains.
- Shared Cloud Economy addon site exists. WordPress files including `wp-config.php` are present. That tree is **not** the Prodexa API.
- No VPS. No API subdomain. No Node.js deployment on this domain.
- Apex HTTPS probe returned CDN 408. Do not treat production API as live.
- Do not delete/overwrite the apex WordPress files or create subdomains without human authorization.
- Do not deploy discovery into that WordPress document root.
- Loop 2 re-inspected read-only: same DNS (no `api` record), no VPS, no JS deployments, WordPress tree still on apex. No Hostinger mutations.

## Documentation Protocol

When a meaningful decision changes, update:

1. Relevant source-of-truth document.
2. `02_BUSINESS_DECISIONS.md` if material.
3. `CHANGELOG.md`.
4. `TASKS.md` when work status changes.

## Current Unknowns

- Next unblocked Phase 1 task after T-019 (remaining TASKS items lack acceptance criteria; T-013 still BLOCKED; plugin wire-up for activate/deactivate not scheduled).
- AI provider/model.
- Billing provider.
- First production connector set.
- Production API hostname (not created).
- Dedicated VPS/Docker (does not exist; purchase needs human authorization).
- Whether the existing apex WordPress install on `prodexaai.cloud` should remain.

## AI Working Style

Use minimal context necessary. Prefer reading the relevant document rather than loading the whole repository. Never assume an undocumented decision is locked.

## Current Rule for UI Changes

No broad redesign. Change only what the request requires and preserve the established design unless the user explicitly asks for a redesign.
