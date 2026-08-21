# Prodexa AI — Security

## Security Objective

Protect merchant data, source credentials, license integrity, customer order data, and the Prodexa service itself.

## Trust Boundaries

1. Customer browser — untrusted.
2. WordPress site/plugin — merchant-controlled but potentially compromised.
3. Prodexa API — trusted application boundary.
4. Source systems — external/untrusted data providers.
5. Prodexa admin — highly privileged.

## Core Rules

- Never trust browser prices, source IDs, or authorization claims.
- Validate all external input.
- Escape output.
- Use HTTPS.
- Keep secrets server-side.
- Use least-privilege credentials.
- Separate tenant data.
- Rate-limit public endpoints.
- Log security events without secrets.
- Rotate credentials.

## WordPress Security

- Use WordPress nonces for state-changing admin actions.
- Check capabilities before privileged operations.
- Sanitize input and escape output.
- Use prepared statements for custom database queries.
- Avoid arbitrary remote code execution paths.
- Do not trust plugin settings as authorization proof.

## API Security

Every protected request must establish:

- Tenant/site identity.
- Authentication.
- License status.
- Request validity.
- Rate-limit eligibility.

Sensitive operations should use short-lived or rotatable credentials and replay-resistant request design.

Plugin-to-API calls use HMAC-SHA256 site credentials (DEC-018). Logs may include site id and license decision codes but must never include `x-prodexa-signature`, site secrets, or `API_SIGNING_SECRET`. `POST /v1/discovery/search` and `POST /v1/discovery/select` are protected the same way. Customer search payloads must not include `source_url`, `source_id`, site secrets, or other-tenant rows. Select responses must not include `tenant_id`, `site_id`, `source_url`, or `source_id`. Offer ownership is taken from PostgreSQL for the authenticated tenant; the client cannot assert tenant or offer ownership.

The WordPress plugin treats browser and checkout-supplied values as untrusted. WooCommerce order metadata may store only `_prodexa_selection_id` and `_prodexa_selection_expires_at` copied from a successful HMAC `POST /v1/discovery/select` replay (DEC-020). That metadata is not authoritative for price, product identity beyond the selection reference, license, tenant, or payment. Checkout fields and extra session keys named `prodexa_` / `_prodexa_` must not become trusted Prodexa state. A client-supplied Prodexa price must never become trusted Prodexa state (DEC-021). Phase 1 offer price is PostgreSQL `normalized_offers.price` (DEC-022, DEC-024).

Redis, when configured, may store license validation extras (activation counts and usage snapshots) only. It must never store site secrets, `API_SIGNING_SECRET`, HMAC signatures, or license keys. License status, HMAC, and nonce replay remain on PostgreSQL so a stale cache cannot authorize a revoked site beyond the next DB status read.

## Source Security

External source content is untrusted. Do not execute scripts, HTML, or arbitrary instructions received from a source as trusted application logic.

Normalize and sanitize external titles, descriptions, URLs, images, and structured data before rendering.

## AI Security

External content may contain prompt injection attempts. Source text must never be allowed to redefine Prodexa system instructions, security policy, tool permissions, or pricing rules.

AI outputs must be validated before use.

## Financial Integrity

The final payable amount must be calculated or verified server-side (DEC-007). Phase 1 verifies the stored PostgreSQL offer price (DEC-021–025). There is no quote endpoint and no client-authoritative price.

Never accept a client-provided source price as authoritative without checking its corresponding server-side offer/reference.

## Privacy

Store only information needed for product discovery, licensing, operations, fulfillment, and legal obligations.

Do not expose private source metadata to customers unless disclosure is required.

## Logging

Logs may include:

- Request ID.
- Tenant ID.
- Connector ID.
- Error class.
- Timing.
- License decision.

Logs must not include passwords, private API keys, signing secrets, or full payment credentials.

## Incident Response

For a suspected security incident:

1. Identify affected tenant/system.
2. Revoke/rotate credentials where needed.
3. Disable compromised connector/license if appropriate.
4. Preserve relevant audit information.
5. Patch the vulnerability.
6. Test the fix.
7. Document the incident and decision.

## Security Changes

Any change that weakens a security boundary requires explicit documentation in `BUSINESS_DECISIONS.md` and review before release.
