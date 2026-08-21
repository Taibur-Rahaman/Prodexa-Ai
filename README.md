# Prodexa AI

Hosted product-discovery platform for WordPress/WooCommerce stores.

The WordPress plugin is a client. Discovery, licensing, connectors, caching, and pricing authority live in the hosted API.

Canonical backend domain: `prodexaai.cloud`. Do not assume `api.prodexaai.cloud` exists until it is verified.

## Status

Pilot / MVP. Documentation foundation is in `docs/`. Local API: liveness plus PostgreSQL-backed `POST /v1/license/validate`. Discovery, connectors, plugin runtime, and production deploy are not implemented.

## Repository layout

- `docs/` — source of truth (constitution, PRD, architecture, API, license, security).
- `apps/api/` — TypeScript Fastify API (Node.js 22+).
- WordPress plugin — not in this repository yet.

## Local API

```bash
npm install
npm test
npm run dev
```

Liveness:

- `GET /health`
- `GET /v1/health`

License (local; requires `DATABASE_URL` + `API_SIGNING_SECRET` for a real Postgres, or `npm test` which uses PGlite):

- `POST /v1/license/validate`

Bind address comes from `HOST` (default `0.0.0.0`) and `PORT` (default `8000`). Copy `.env.example` to `.env` locally. Never commit real credentials.

## Source of truth

Start with `docs/00_CONSTITUTION.md` and `docs/02_BUSINESS_DECISIONS.md`.
