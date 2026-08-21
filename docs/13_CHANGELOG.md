# Prodexa AI — Changelog

All meaningful product, architecture, business, security, infrastructure, and documentation changes should be recorded here.

## 2026-08-21 — Loop 2: PostgreSQL license model and validate API

### Added

- PostgreSQL license schema/migrations (`tenants`, `plans`, `licenses`, `site_activations`, `usage_counters`, `request_nonces`).
- Site HMAC-SHA256 authentication (DEC-018).
- Local `POST /v1/license/validate` with deterministic license/auth errors.

### Decision

Locked DEC-018 (HMAC wire format, encrypted site secrets, PostgreSQL nonce replay). Redis is still not provisioned.

### Implementation Status

License validation is tested locally (including PGlite-backed integration tests). Activate/deactivate, discovery, plugin, production deploy, and `api.prodexaai.cloud` are not claimed. Hostinger was inspected read-only; no DNS, files, or VPS changes.

## 2026-08-21 — Loop 1: API skeleton and stack lock

### Added

- TypeScript Fastify API in `apps/api` with public liveness `GET /health` and `GET /v1/health`.
- Canonical `NormalizedOffer` TypeScript type and runtime validator.
- Root README and npm workspace.

### Decision

Locked DEC-014 (Node.js/TypeScript/Fastify), DEC-015 (PostgreSQL + Redis), DEC-016 (do not deploy API into inspected apex WordPress; no unapproved subdomains/VPS), DEC-017 (site-scoped server-side plugin authentication).

### Implementation Status

Local API health is tested. License, discovery, connectors, plugin, production deploy, and `api.prodexaai.cloud` are not claimed. Hostinger was inspected only; no DNS, files, or VPS changes.

## 2026-08-21 — Autonomous Development & Backend Infrastructure Baseline

### Added

- Project constitution for non-negotiable engineering rules.
- Canonical backend/infrastructure domain: `prodexaai.cloud`.
- Hostinger MCP inspection/change-control rules.
- Deployment and infrastructure documentation.
- Low-token autonomous Cursor loop and handoff protocol.
- Explicit infrastructure safety and verification rules.

### Decision

`prodexaai.cloud` is locked as the canonical Prodexa backend/infrastructure domain. Potential service subdomains are created only when required and verified first.

### Implementation Status

Documentation and development-process foundation only. No Hostinger deployment, DNS mutation, production backend, or production data change is claimed by this entry.

## 2026-08-21 — Documentation Foundation

### Added

- Project vision.
- Product requirements.
- Business decision ledger.
- Architecture baseline.
- API specification baseline.
- WordPress plugin specification.
- Connector framework.
- License/subscription system.
- Security policy.
- AI development rules.
- AI project memory.
- Roadmap.
- Task board.

### Reason

Create a durable source of truth for AI-assisted development so Cursor and other coding agents can understand the product, preserve decisions, avoid unnecessary changes, and keep a record of why material changes happen.

### Implementation Status

Documentation foundation only. No production backend, connector, plugin runtime, payment system, or customer data migration is claimed by this entry.
