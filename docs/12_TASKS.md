# Prodexa AI — Tasks

## Now

- [ ] Inspect existing repository structure before implementation.
- [ ] Inspect Hostinger resources, DNS, domains, and existing deployment state through Hostinger MCP.
- [ ] Confirm whether `prodexaai.cloud` is configured and identify any existing services before creating subdomains.
- [ ] Select and document backend stack.
- [ ] Select hosting architecture based on the verified Hostinger state.
- [ ] Define normalized offer schema in implementation language.
- [ ] Define authentication strategy.
- [ ] Define license database model.
- [ ] Define cache strategy.
- [ ] Build API health endpoint.
- [ ] Build license validation endpoint.
- [ ] Build discovery search endpoint.
- [ ] Build first connector.
- [ ] Build WordPress plugin skeleton.

## Next

- [ ] Add WooCommerce order metadata.
- [ ] Add pricing engine.
- [ ] Add ranking baseline.
- [ ] Add source freshness handling.
- [ ] Add connector health monitoring.
- [ ] Add integration tests.
- [ ] Add load/performance tests.

## Later

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
