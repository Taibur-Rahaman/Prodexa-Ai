# Prodexa AI — Tasks

## Loop log

| Loop | Date | Result | Notes |
| --- | --- | --- | --- |
| 1 | 2026-08-21 | COMPLETE | Inspected Hostinger (read-only). Locked stack (DEC-014–017). Shipped local `GET /health` + `/v1/health`. |

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
- **Status:** done (documented, not implemented)
- **Docs:** DEC-017, `04_API.md`

### T-010 — API health endpoint
- **Priority:** P1
- **Status:** done (local only; not deployed)
- **Files:** `apps/api/src/routes/health.ts`, `apps/api/src/app.ts`
- **Tests:** `apps/api/src/health.test.ts`

## Now

- [ ] **T-008** Define license database model (PostgreSQL) and migrations. P1
- [ ] **T-009** Implement site authentication + `POST /v1/license/validate`. P1
- [ ] **T-011** Implement cache strategy (Redis) when search/license persistence lands. P2
- [ ] **T-012** Build discovery search endpoint. P2
- [ ] **T-013** Build first permitted connector. P2
- [ ] **T-014** Build WordPress plugin skeleton. P2

## Next

- [ ] Add WooCommerce order metadata.
- [ ] Add pricing engine.
- [ ] Add ranking baseline.
- [ ] Add source freshness handling.
- [ ] Add connector health monitoring.
- [ ] Add integration tests.
- [ ] Add load/performance tests.

## Later

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
