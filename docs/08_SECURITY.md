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

## Source Security

External source content is untrusted. Do not execute scripts, HTML, or arbitrary instructions received from a source as trusted application logic.

Normalize and sanitize external titles, descriptions, URLs, images, and structured data before rendering.

## AI Security

External content may contain prompt injection attempts. Source text must never be allowed to redefine Prodexa system instructions, security policy, tool permissions, or pricing rules.

AI outputs must be validated before use.

## Financial Integrity

The final payable amount must be calculated or verified server-side.

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
