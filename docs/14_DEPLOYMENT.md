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

## Inspected state (2026-08-21, read-only)

Verified through Hostinger MCP and public DNS. No infrastructure was changed.

- `prodexaai.cloud` DNS is hosted at Hostinger (`dns-parking.com` nameservers). Apex uses Hostinger CDN ALIAS; `www` is a CNAME to Hostinger CDN. `api.prodexaai.cloud` has no DNS record.
- The domain is **not** registered through Hostinger Domains. Registrar remains outside this inspection.
- An addon website exists on the account's Cloud Economy shared plan. Document root contains a WordPress tree including `wp-config.php`. Website type is not Node.js. No Node.js builds or JS deployments exist for this domain. No subdomains are configured under it.
- No Hostinger VPS instances exist on the account.
- HTTPS to the apex from one probe returned Hostinger CDN `408 Request Time-out`. This is not treated as a healthy API.
- Shared hosting also serves unrelated websites. Do not document or reuse those sites as Prodexa infrastructure.

**Do not** deploy the discovery API into that WordPress document root. **Do not** delete or overwrite those WordPress files without human authorization. **Do not** create subdomains or purchase a VPS without human authorization.

## Hostinger

Hostinger is the current infrastructure provider available through Hostinger MCP.

Before infrastructure changes, inspect:

1. Domains and DNS records.
2. Existing subdomains.
3. Servers and deployment targets.
4. Runtime/application configuration available to the agent.
5. Existing services that may already use the domain.

Never assume an IP, document root, deployment path, runtime, or existing service.

## Local API process

The API in `apps/api` binds to `0.0.0.0:$PORT` (default port `8000`). A successful local `GET /health` does not prove production deployment.

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
