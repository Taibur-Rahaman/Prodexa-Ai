# Prodexa AI — Deployment & Infrastructure

## Canonical Backend Domain

`prodexaai.cloud` is the canonical backend/infrastructure domain.

Possible service subdomains include:

- `api.prodexaai.cloud` — API
- `admin.prodexaai.cloud` — administrative backend UI
- `auth.prodexaai.cloud` — authentication service
- `hooks.prodexaai.cloud` — webhook service
- `status.prodexaai.cloud` — health/status surface

These are possibilities, not pre-created services. Verify actual DNS and deployment state before using or creating them.

## Hostinger

Hostinger is the current infrastructure provider available through Hostinger MCP.

Before infrastructure changes, inspect:

1. Domains and DNS records.
2. Existing subdomains.
3. Servers and deployment targets.
4. Runtime/application configuration available to the agent.
5. Existing services that may already use the domain.

Never assume an IP, document root, deployment path, runtime, or existing service.

## Environment Separation

Keep local, development, staging, and production configuration separate. Real production credentials must never be committed to Git or placed in documentation.

## Deployment Verification

A backend deployment is not complete until the actual deployed service is verified. Where available, verify:

- DNS resolution.
- TLS/HTTPS.
- health endpoint.
- API response behavior.
- authentication boundary.
- CORS policy.
- logs/errors.

A successful local build alone does not prove deployment success.

## Destructive Changes

Deleting services, DNS records, domains, production data, or credentials requires explicit human authorization.

## Documentation Rule

Any material infrastructure change must update this document and, where relevant, `docs/02_BUSINESS_DECISIONS.md`, `docs/03_ARCHITECTURE.md`, `docs/12_TASKS.md`, and `docs/13_CHANGELOG.md`.
