# Prodexa AI — Project Memory

## Purpose

This is a compact durable memory file for AI coding agents. It records current state, not every historical detail.

## Current Product

Prodexa AI is being built as a product-discovery engine with a WordPress/WooCommerce plugin and hosted backend API.

## Current Stage

Pilot / MVP. Last completed autonomous loop: **6**. Milestone: Phase 1 — Pilot MVP (in progress).

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
- License validation is local-only: PostgreSQL model + `POST /v1/license/validate` with optional Redis cache (T-011). Activate/deactivate are not implemented.
- Discovery search is local-only: HMAC `POST /v1/discovery/search` against tenant-scoped PostgreSQL `normalized_offers` (T-012). No connectors, ranking, pricing engine, or Redis search cache. `POST /v1/discovery/select` is not implemented.
- WordPress plugin skeleton is in `plugins/prodexa-ai/` (T-014): settings, sealed site credentials, HMAC client, health check, display-only license refresh. Storefront search, WooCommerce checkout, and connectors are not implemented.
- **T-013 remains BLOCKED:** first connector source is not decided. Do not guess a connector.

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
