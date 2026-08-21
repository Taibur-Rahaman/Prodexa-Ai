# Prodexa AI — Roadmap

## Phase 0 — Foundation

- [x] Project vision.
- [x] PRD.
- [x] Business decision ledger.
- [x] Architecture definition.
- [x] API specification baseline.
- [x] WordPress plugin specification baseline.
- [x] Connector framework definition.
- [x] License system definition.
- [x] Security baseline.
- [x] AI development rules.
- [x] Project memory.

## Phase 1 — Pilot MVP

- [x] Select backend stack (TypeScript / Node.js / Fastify).
- [x] Select hosting architecture (local now; dedicated VPS/Docker later; do not use apex WordPress as API).
- [x] Implement Prodexa API skeleton (health only).
- [x] Implement tenant/site identity.
- [x] Implement license validation.
- [x] Implement cache layer.
- [x] Implement discovery search endpoint (PostgreSQL lexical index; no connectors yet).
- [x] Implement discovery select endpoint (PostgreSQL selection reference; no connectors).
- [ ] Implement connector interface.
- [ ] Implement first permitted connector.
- [x] Implement normalized offer schema (TypeScript types + validator).
- [ ] Implement deterministic pricing.
- [ ] Implement ranking baseline.
- [x] Implement WordPress plugin skeleton.
- [x] Integrate storefront discovery UI.
- [x] Integrate WooCommerce order metadata.
- [ ] Add end-to-end tests.
- [ ] Run pilot on owner's store.

## Phase 2 — Pilot Hardening

- [ ] Improve matching accuracy.
- [ ] Add more permitted connectors.
- [ ] Improve cache/freshness strategy.
- [ ] Add connector health monitoring.
- [ ] Add usage metering.
- [ ] Improve admin diagnostics.
- [ ] Security review.
- [ ] Performance/load testing.

## Phase 3 — SaaS Readiness

- [ ] Multi-tenant admin portal.
- [ ] Subscription billing integration.
- [ ] Self-service license provisioning.
- [ ] Plan/quota management.
- [ ] Customer onboarding.
- [ ] Documentation portal.
- [ ] Automated release process.
- [ ] Commercial plugin packaging.

## Phase 4 — Growth

- [ ] Connector marketplace/process.
- [ ] Advanced semantic matching.
- [ ] Search analytics.
- [ ] More storefront integrations.
- [ ] Queue/worker scaling.
- [ ] Advanced observability.

## Rule

Roadmap items are plans, not commitments. A roadmap change should be recorded in `CHANGELOG.md` when it materially changes product direction.
