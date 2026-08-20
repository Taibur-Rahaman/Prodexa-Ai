# Prodexa AI — WordPress Plugin Specification

## Purpose

The Prodexa WordPress plugin connects a merchant's WordPress/WooCommerce site to the hosted Prodexa API.

## Responsibilities

- License activation and status display.
- Secure API configuration.
- Storefront search/discovery integration.
- Product result rendering.
- Offer selection.
- WooCommerce checkout integration.
- Private order metadata.
- Merchant settings.
- Diagnostics and safe error handling.

## Non-Responsibilities

The plugin must not:

- Crawl many external websites directly during a customer request.
- Store connector credentials.
- Decide final pricing independently.
- Trust browser-supplied price values.
- Contain the entire discovery/matching engine.

## Proposed Structure

```text
prodexa-ai/
├── prodexa-ai.php
├── includes/
│   ├── class-plugin.php
│   ├── class-api-client.php
│   ├── class-license.php
│   ├── class-search.php
│   ├── class-checkout.php
│   ├── class-order-meta.php
│   └── class-admin.php
├── assets/
│   ├── css/
│   └── js/
├── templates/
├── languages/
└── readme.txt
```

The exact structure may change during implementation, but responsibility boundaries should remain stable.

## License Behavior

On activation:

1. Merchant enters license key.
2. Plugin sends license/site information to Prodexa API.
3. Server validates subscription.
4. Server returns only the minimum information needed by the plugin.
5. Plugin stores non-secret activation state securely.

On normal use:

- Plugin uses a short-lived or rotatable credential model.
- Server remains authoritative.
- Expired/revoked licenses cannot access protected discovery services.

## Customer Search

The plugin should integrate with the merchant's existing search UX where possible instead of forcing a completely separate storefront.

Search requests should be debounced on the client where appropriate, but server-side rate limiting remains mandatory.

## Result Rendering

Only customer-safe fields should be rendered to visitors.

Private fields must remain server/admin-only.

Required disclosures from external sources must be preserved when applicable.

## WooCommerce Integration

When a customer selects an offer, the plugin must create a server-verifiable reference before checkout.

The order should contain private metadata such as:

- Prodexa request ID.
- Offer ID.
- Source URL.
- External product ID.
- Source price snapshot.
- Merchant sale price.
- Pricing rule/version.
- Retrieval timestamp.

Sensitive secrets must never be stored in plain WooCommerce order metadata.

## Failure Behavior

If Prodexa API is unavailable:

- Existing WordPress/WooCommerce functionality must continue working.
- The plugin should show a user-friendly discovery error or hide only the Prodexa result component.
- No fatal PHP error should take down the storefront.

## Performance

- Do not perform synchronous multi-source scraping in WordPress.
- Use asynchronous API calls where appropriate.
- Cache safe plugin configuration locally.
- Avoid repeated API calls for identical UI states.
- Keep frontend JavaScript lightweight.

## Compatibility

The plugin should target supported WordPress and WooCommerce versions defined at release time. Compatibility claims must be tested rather than assumed.

## Security

Follow WordPress security practices:

- Nonces for admin actions.
- Capability checks.
- Input validation/sanitization.
- Output escaping.
- Prepared database queries where custom queries are necessary.
- Secure HTTP transport.
- Secret rotation.

## Commercialization

The plugin is intended to become a distributable subscription product. The architecture must therefore separate public plugin code from server-side proprietary logic.
