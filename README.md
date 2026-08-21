# Prodexa AI

Hosted product-discovery platform for WordPress/WooCommerce stores.

The WordPress plugin is a client. Discovery, licensing, connectors, caching, and pricing authority live in the hosted API.

Canonical backend domain: `prodexaai.cloud`. Do not assume `api.prodexaai.cloud` exists until it is verified.

## Status

Pilot / MVP. Documentation foundation is in `docs/`. Local API: liveness, PostgreSQL-backed `POST /v1/license/validate` with optional Redis cache, HMAC `POST /v1/discovery/search` against a tenant-scoped offer index, and HMAC `POST /v1/discovery/select` for 15-minute selection references. WordPress plugin in `plugins/prodexa-ai/` includes settings plus storefront `[prodexa_search]`. Connectors and production deploy are not implemented.

## Repository layout

- `docs/` — source of truth (constitution, PRD, architecture, API, license, security).
- `apps/api/` — TypeScript Fastify API (Node.js 22+).
- `plugins/prodexa-ai/` — WordPress client plugin (settings, HMAC client, storefront search UI).

## Local API

```bash
npm install
npm test
npm run dev
```

Liveness:

- `GET /health`
- `GET /v1/health`

License (local; requires `DATABASE_URL` + `API_SIGNING_SECRET` for a real Postgres, or `npm test` which uses PGlite). `REDIS_URL` is optional; validation works without Redis.

- `POST /v1/license/validate`
- `POST /v1/discovery/search` (searches tenant-scoped `normalized_offers`; empty until seeded or connectors exist)
- `POST /v1/discovery/select` (15-minute PostgreSQL selection reference; revalidates `normalized_offers` only)

Bind address comes from `HOST` (default `0.0.0.0`) and `PORT` (default `8000`). Copy `.env.example` to `.env` locally. Never commit real credentials.

## WordPress plugin

Copy `plugins/prodexa-ai/` into a WordPress `wp-content/plugins/` directory, or symlink it for local work. Settings → Prodexa AI configures the API base URL (local default `http://localhost:8000`), site ID, and site secret. Add `[prodexa_search]` on a page for storefront discovery.

```bash
php plugins/prodexa-ai/tests/run.php
```

Do not install this plugin over the apex WordPress tree on `prodexaai.cloud` without human authorization.

## Source of truth

Start with `docs/00_CONSTITUTION.md` and `docs/02_BUSINESS_DECISIONS.md`.
