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
- Trust browser-supplied price values (DEC-021).
- Contain the entire discovery/matching engine.
- Override the Prodexa offer price in WooCommerce (DEC-021).

## Proposed Structure

```text
plugins/prodexa-ai/
├── prodexa-ai.php
├── uninstall.php
├── readme.txt
├── includes/
│   ├── class-plugin.php
│   ├── class-activator.php
│   ├── class-deactivator.php
│   ├── class-settings.php
│   ├── class-admin.php
│   ├── class-api-client.php
│   ├── class-hmac.php
│   ├── class-license.php
│   ├── class-discovery.php
│   ├── class-selection.php
│   ├── class-storefront.php
│   ├── class-woocommerce.php
│   ├── class-sanitizer.php
│   ├── class-secrets.php
│   └── class-http-result.php
├── assets/
│   ├── css/search.css
│   └── js/search.js
├── templates/
│   ├── admin-settings.php
│   └── storefront-search.php
└── tests/
```

Checkout payment, product sync, and a dynamic pricing engine are not implemented (DEC-022, DEC-025). Order metadata is the validated selection reference only (DEC-020). Client-supplied Prodexa prices are never trusted (DEC-021). Phase 1 offer price is PostgreSQL `normalized_offers.price`.

## Skeleton (T-014)

Shipped in `plugins/prodexa-ai/`:

- Bootstrap with PHP 8.2+ activation check; deactivation keeps options; uninstall deletes settings and sealed secrets.
- Settings API page (capability `manage_options`): API base URL, timeout, site ID, site secret, license key.
- Site secret and license key are encrypted at rest with a key derived from WordPress salts. Password fields are never prefilled. Secrets are never localized into JavaScript.
- HTTP client with timeouts, no redirects, HMAC-SHA256 for protected routes (DEC-018). `GET /v1/health` is unsigned. `POST /v1/license/validate`, `POST /v1/discovery/search`, and `POST /v1/discovery/select` are signed when credentials exist.
- Cached license snapshot is operator display only. `Prodexa_AI_License::cached_state_authorizes_access()` is always false. The API remains authoritative.
- `POST /v1/license/activate` and `POST /v1/license/deactivate` are not called; stored license keys wait for those endpoints.

## Storefront search (T-015)

Merchants place `[prodexa_search]` on a page (optional `limit`, 1–20, default 10). The shortcode renders a search input, loading/empty/error regions, customer-safe result cards, and next/previous pagination. `meta.count` is the current page size, not a total, so “next” is shown when that page is full.

Visitor browsers POST to `admin-ajax.php` (`prodexa_ai_search`, `wp_ajax_` and `wp_ajax_nopriv_`) with a CSRF nonce only. PHP signs `POST /v1/discovery/search` with the existing site HMAC client. Site secrets, license keys, and HMAC headers are never localized into JavaScript. The plugin projects only the customer-safe offer fields the API already returns: `offer_id`, `title`, `image_url`, `display_price`, `currency`, `availability`, `freshness.retrieved_at`. Private fields (`source_url`, `source_id`, `tenant_id`) are dropped even if present. If WooCommerce is active, `context.currency` is taken from the store currency; browsers cannot supply currency, country, or `tenant_id`.

Search runs on submit (not live-as-you-type) so identical UI states do not spam the quota. License, tenant, entitlement, and daily search quota remain authoritative on the API. If the API is down or rejects the request, the component shows a customer-safe error; the rest of WordPress continues.

Not in this release: product sync, connectors, ranking, payment, AI UI, or a dynamic pricing engine.

## Offer selection and WooCommerce metadata (T-017 / DEC-020)

Result cards include a Select control. Visitor browsers POST only `offer_id` plus the existing storefront CSRF nonce to `admin-ajax.php` (`prodexa_ai_select`, `wp_ajax_` and `wp_ajax_nopriv_`). PHP mints `selection_id` and signs `POST /v1/discovery/select`. Browsers cannot supply `selection_id`, price, currency, country, or `tenant_id` as trusted input. HMAC secrets stay in PHP.

On a successful select, the plugin stores the API-returned `selection_id`, `offer_id`, and `expires_at` in the WooCommerce session as an untrusted pending handle. `offer_id` is kept only so checkout can replay the existing select contract; it is not written to the order.

Before WooCommerce persists Prodexa order metadata, the plugin revalidates by replaying HMAC `POST /v1/discovery/select` with the pending `selection_id` and `offer_id` (DEC-019 idempotent repeat). There is no GET selection endpoint. Hooks: `woocommerce_checkout_create_order` (classic, before `$order->save()`) and `woocommerce_store_api_checkout_update_order_from_request` (Store API). On HTTP 200, the order receives only:

- `_prodexa_selection_id`
- `_prodexa_selection_expires_at`

copied from the API response. These keys are protected meta. They are not authoritative for price, product identity beyond the selection reference, license, tenant, or payment.

Checkout POST fields matching `prodexa_` / `_prodexa_` are stripped. Client-supplied extra session keys (price, tenant, source URL) are dropped. Invalid, expired (`410`), unknown/other-tenant offer (`404`), or conflict (`409`) selections fail checkout deterministically with a customer-safe error and do not persist Prodexa metadata. Orders with no pending selection are unchanged. If the API is down during a pending selection, checkout of that selection fails; other store functionality continues.

Not implemented: payment, WooCommerce price/totals changes, product sync, connectors, ranking, AI UI, or a dynamic pricing engine. WooCommerce does not persist or trust a client-supplied Prodexa price (DEC-021).

Run `php plugins/prodexa-ai/tests/run.php` (no WordPress install required). Do not deploy the plugin onto apex `prodexaai.cloud` without human authorization.

## License Behavior

On activation (target flow; `POST /v1/license/activate` is not implemented yet):

1. Merchant enters license key.
2. Plugin sends license/site information to Prodexa API.
3. Server validates subscription.
4. Server returns only the minimum information needed by the plugin.
5. Plugin stores non-secret activation state securely.

The T-014 skeleton stores the license key sealed on the merchant server and can refresh status via `POST /v1/license/validate`. It does not treat a stored key or cached snapshot as authorization.

On normal use:

- Plugin uses a short-lived or rotatable credential model.
- Server remains authoritative.
- Expired/revoked licenses cannot access protected discovery services.

## Customer Search

The plugin should integrate with the merchant's existing search UX where possible instead of forcing a completely separate storefront.

Pilot UI is the `[prodexa_search]` shortcode (T-015). Search requests run on submit. Server-side rate limiting remains mandatory.

## Result Rendering

Only customer-safe fields should be rendered to visitors. The storefront UI renders the existing discovery contract fields only.

Private fields must remain server/admin-only.

Required disclosures from external sources must be preserved when applicable.

## WooCommerce Integration

When a customer selects an offer, the plugin creates a server-verifiable reference before checkout via HMAC `POST /v1/discovery/select` (DEC-019). Checkout revalidates that reference before writing order meta (DEC-020).

Pilot order metadata is only:

- `_prodexa_selection_id`
- `_prodexa_selection_expires_at`

A longer fulfillment trace (request ID, source URL, source/merchant prices, pricing rule, retrieval timestamp) is not stored in this release. Order meta is not authoritative for those values. Sensitive secrets must never be stored in plain WooCommerce order metadata.

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

PHP 8.2+ is the expected plugin runtime on merchant sites. Requires WordPress 6.4+. WooCommerce order-metadata hooks are implemented (DEC-020); payment, a dynamic pricing engine, and product sync are not. The WordPress tree currently present on apex `prodexaai.cloud` is not the Prodexa plugin and must not be overwritten without human authorization.

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
