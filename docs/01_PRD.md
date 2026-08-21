# Prodexa AI — Product Requirements Document

## 1. Status

**Stage:** Pilot / MVP definition  
**Primary deployment:** Owner's WordPress/WooCommerce commerce site  
**Future:** Subscription SaaS

## 2. Product Objective

Build a hosted product-discovery service and WordPress plugin that can find relevant product offers from permitted external sources, normalize and rank them, apply merchant pricing rules, and render the result inside a merchant storefront without requiring permanent import of every external product into the local WooCommerce catalog.

## 3. Functional Requirements

### FR-01 — WordPress Integration

The plugin shall:

- Provide a configurable Prodexa API endpoint.
- Authenticate requests using a site/license credential without exposing the master secret to visitors.
- Provide storefront search/discovery components.
- Receive normalized product results from Prodexa API.
- Render results using the merchant's frontend design system.
- Record necessary private source metadata against orders.
- Fail gracefully when the external API is unavailable.

### FR-02 — Product Discovery

The platform shall accept a customer product query and retrieve relevant candidate products from configured source connectors.

The engine should support multiple sources for one query rather than relying on a single source.

### FR-03 — Source Connector Framework

Each source connector shall have a consistent interface for:

- Search.
- Product detail retrieval where permitted.
- Availability/freshness information where available.
- Source URL.
- Title.
- Images.
- Price.
- Currency.
- Variant information.
- Source-specific identifiers.

A connector must be independently disableable.

### FR-04 — Normalization

Different source formats shall be converted into a common internal offer schema.

The normalized object should include at minimum:

- `source_id`
- `source_url`
- `external_product_id` when available
- `title`
- `description` when available
- `image_url`
- `price`
- `currency`
- `availability`
- `variants`
- `retrieved_at`
- `expires_at` or freshness metadata

### FR-05 — Product Matching

The system shall determine whether candidate results correspond to the customer's requested product.

Matching may use deterministic rules and AI-assisted semantic matching. AI output must not be treated as authoritative without validation.

### FR-06 — Ranking

Candidate offers shall be ranked using configurable signals such as:

- Product relevance.
- Price competitiveness.
- Availability confidence.
- Source reliability.
- Freshness.
- Merchant business rules.

The MVP should return a small, useful set of results rather than an uncontrolled list.

### FR-07 — Pricing

The merchant shall be able to configure a pricing rule that adds the merchant's applicable fee/margin to the source price.

Pricing calculations must be deterministic and auditable. The browser must never be the source of truth for the final payable amount.

Phase 1 (DEC-021–025): there is no dynamic pricing engine and no markup formula. The authoritative offer price is stored PostgreSQL `normalized_offers.price`. Markup, tax, discounts, fees, live connector price, and a quote endpoint are deferred until a later locked decision.

### FR-08 — Customer Presentation

Customers shall see products in the merchant's storefront experience.

Customer-facing UI must not expose private operational metadata such as internal source IDs, connector credentials, private API endpoints, or internal cost calculations.

Source attribution, branding, or disclosure requirements imposed by a source or applicable law must not be hidden.

### FR-09 — Checkout and Orders

Customer payment shall be collected by the merchant's existing WordPress/WooCommerce checkout.

The MVP shall not automatically purchase from the external source.

An order shall retain sufficient private metadata for authorized administrators to identify:

- Prodexa discovery/request ID.
- Selected source.
- Source product URL.
- Source product identifier where available.
- Source price at selection time.
- Merchant/customer sale price.
- Applied fee/margin rule.
- Retrieval timestamp.

### FR-10 — Manual Fulfillment

After payment, the merchant shall manually place the external order/purchase and fulfill the customer.

Automated third-party purchasing is out of MVP scope.

### FR-11 — Caching

The discovery API shall cache suitable search/product results to reduce source requests and improve response time.

Cache TTL shall be configurable by source and data type.

The system must provide a mechanism for marking stale results and must not represent stale data as guaranteed real-time availability.

### FR-12 — Licensing

The plugin shall require a valid Prodexa license.

The license service shall support:

- License creation.
- Activation.
- Domain/site association.
- Expiration.
- Suspension/revocation.
- Renewal.
- Plan limits.
- Usage tracking.

License enforcement must occur server-side. A copied plugin must not be usable indefinitely without a valid server-side license.

### FR-13 — Admin Control

Authorized Prodexa operators shall be able to inspect:

- Licensed sites.
- License status.
- Expiration dates.
- API/search usage.
- Connector status.
- Errors.
- Request IDs.

Merchant WordPress administrators shall be able to inspect their own order/source information but must not gain access to global Prodexa tenant data.

## 4. Non-Functional Requirements

### NFR-01 Performance

The WordPress plugin must not perform multi-source retrieval directly inside normal WordPress PHP request execution.

The hosted discovery API shall handle concurrent source retrieval, caching, normalization, and ranking.

The architecture should support fast responses through parallel retrieval and cache hits.

### NFR-02 Reliability

One failed source must not fail the entire discovery request when other valid sources are available.

Timeouts, retries, circuit breakers, and connector health status should be used where appropriate.

### NFR-03 Security

- Never expose connector credentials to the browser.
- Never trust client-supplied price calculations.
- Validate all external data.
- Authenticate every privileged API operation.
- Enforce tenant isolation.
- Rate-limit public discovery endpoints.
- Log security-relevant events without storing unnecessary secrets.

### NFR-04 Maintainability

Business decisions and architecture changes must be documented before or alongside implementation.

AI coding tools must follow `AI_RULES.md` and update relevant memory/decision/change documents when a locked decision changes.

## 5. User Stories

### Customer

- As a customer, I want to search for a product and see useful available offers.
- As a customer, I want the price shown on the merchant site to be clear before checkout.
- As a customer, I want a normal checkout experience.

### Merchant

- As a merchant, I want to discover products without permanently importing every external product.
- As a merchant, I want to see the private source information needed for fulfillment.
- As a merchant, I want the system to continue operating if one source is unavailable.

### Prodexa Operator

- As an operator, I want to issue and control licenses.
- As an operator, I want to control subscription validity and usage.
- As an operator, I want to add or disable connectors independently.

## 6. MVP Acceptance Criteria

- A valid licensed WordPress site can authenticate with Prodexa API.
- A customer query can return normalized offers from multiple permitted sources.
- Offers are ranked and priced using server-side rules.
- Results render inside the merchant storefront.
- Checkout uses the merchant's existing WooCommerce flow.
- Order metadata can identify the selected source for authorized admins.
- External product records are not automatically persisted as permanent WooCommerce products.
- Search results are cached where configured.
- Source failures degrade gracefully.
- An expired or revoked license prevents protected API use.
- No connector secret is delivered to the browser.

## 7. Explicit MVP Exclusions

- Automated purchasing on external websites.
- CAPTCHA or anti-bot bypass.
- Authentication bypass.
- Universal unrestricted scraping.
- Guaranteed stock accuracy where the source does not provide reliable stock data.
- Customer-visible manipulation of required source disclosures.
- Permanent storage of every discovered product.

## 8. Open Decisions

The following remain intentionally unlocked until technical validation:

- Search/index technology.
- AI provider/model.
- Initial subscription prices.
- Exact number of source connectors for the pilot.
- Exact cache TTL per source.
- Production API hostname (not created).
- Dedicated VPS purchase (human authorization required).

Locked in `02_BUSINESS_DECISIONS.md`: backend runtime (DEC-014), data stores (DEC-015), hosting topology (DEC-016), site authentication direction (DEC-017), Hostinger as current infrastructure provider (DEC-013).

Any decision that becomes irreversible or materially affects architecture must be recorded in `BUSINESS_DECISIONS.md`.
