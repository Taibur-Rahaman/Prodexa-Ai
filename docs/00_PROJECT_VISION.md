# Prodexa AI — Project Vision

## 1. Vision

Prodexa AI is a product-discovery and commerce infrastructure platform for WordPress/WooCommerce stores. It is designed to help a customer discover products that are available across publicly accessible online commerce sources while keeping the customer's buying journey inside the merchant's own storefront.

The long-term product is a subscription-based SaaS with a WordPress plugin, a hosted discovery API, source connectors, licensing, and an administrator control plane.

## 2. Problem

A customer may search for a product on Google but struggle to find a suitable price, source, or availability. A merchant may also want to offer a much broader catalog without permanently importing every external product into the local WordPress database.

Prodexa AI aims to solve this by separating product discovery from permanent catalog storage:

- Discover relevant products from permitted online sources.
- Compare candidate offers and select useful variations.
- Present current product information through the merchant's storefront.
- Keep source URL and operational metadata available to authorized administrators.
- Let the merchant collect payment and fulfill the order manually at first.
- Avoid exposing unnecessary source identity to customers where the business model permits it.

## 3. Product Concept

The initial deployment will be used inside the owner's own commerce operation as a real-world pilot. Once the workflow is stable, the same infrastructure can become a commercial SaaS product for other stores.

Core components:

1. **WordPress Plugin** — storefront integration, search UI, checkout/order metadata, license activation.
2. **Prodexa API** — authenticated API layer between WordPress sites and the discovery platform.
3. **Discovery Engine** — query processing, source retrieval, normalization, matching, ranking, pricing rules, and caching.
4. **Source Connectors** — modular integrations for permitted sources and APIs.
5. **License Service** — subscription plans, domain/site activation, expiry, suspension, and usage controls.
6. **Admin Control Plane** — merchant/license/source/usage management for the Prodexa operator.

## 4. Target Users

### Primary

- WooCommerce/WordPress store owners who want broader product discovery without maintaining a massive local catalog.
- Multi-vendor commerce operators who need an external-product discovery layer.

### Secondary

- Agencies deploying Prodexa for multiple client stores.
- Future SaaS customers who need product discovery and comparison capabilities.

## 5. Initial Business Model

Prodexa will initially be validated on the owner's own commerce website. After validation, it will be offered as a subscription service.

Potential commercial controls:

- Monthly subscription.
- Annual subscription.
- Site/domain-based licensing.
- Usage limits or fair-use limits.
- Plan-specific connector access.
- Plan-specific API/search quotas.

No pricing or plan values are locked until real-world pilot data is available.

## 6. Core User Journey

1. Customer searches for a product on Google or directly on the merchant site.
2. Customer lands on or searches within the merchant storefront.
3. Prodexa receives the product query.
4. Discovery Engine retrieves relevant candidates from configured sources.
5. Candidates are normalized and matched to the requested product.
6. The engine ranks a small set of useful offers/variations, including competitive pricing where appropriate.
7. Merchant pricing/fee rules are applied.
8. Customer sees the result using the merchant's storefront UI.
9. Customer pays the merchant through the merchant's existing checkout/payment flow.
10. WordPress records the order and authorized source metadata.
11. Merchant reviews the source URL and order details in the admin area.
12. Initial fulfillment is manual: the merchant purchases/redeems the source product and fulfills the customer order.

## 7. Product Principles

- **Fast by architecture:** external retrieval must not block WordPress PHP unnecessarily.
- **Cached by default:** repeated searches should use safe cached results where freshness requirements permit.
- **Modular sources:** each source integration is isolated behind a connector interface.
- **No unnecessary local catalog duplication:** discovery data should not automatically become permanent WooCommerce products.
- **Admin transparency:** authorized operators must be able to trace an order to its source and pricing inputs.
- **Customer simplicity:** the customer should experience a normal storefront purchase flow.
- **Security first:** source credentials, license secrets, and private operational data must never be exposed to the browser.
- **AI must be controlled:** AI may assist discovery/matching, but deterministic validation must protect pricing, source identity, and order integrity.
- **Human fulfillment initially:** automated purchasing is explicitly out of MVP scope.

## 8. Important Constraints

Prodexa must only retrieve, display, or process information from sources where the merchant has permission or where the source's terms, APIs, robots rules, licensing, and applicable law permit the intended use.

The system must not be designed to bypass authentication, anti-bot protections, paywalls, access controls, rate limits, CAPTCHAs, or other technical restrictions.

Source product information must be treated as untrusted external data. Prices, availability, titles, images, and claims must be validated and freshness-aware before they affect a customer order.

## 9. MVP Success Criteria

The pilot is successful when:

- A customer can search for a product through the merchant storefront.
- Prodexa can retrieve and normalize permitted source results.
- Relevant products can be matched with acceptable accuracy.
- Results load quickly enough for normal commerce usage.
- Repeated queries benefit from caching.
- Customer checkout remains on the merchant site.
- Order records contain enough private metadata for manual fulfillment.
- No unnecessary external product records are permanently created in the merchant catalog.
- License activation and expiry can be enforced remotely.
- A source failure does not take down the WordPress storefront.

## 10. Non-Goals for MVP

- Fully automated purchasing from third-party stores.
- Bypassing anti-bot systems or access controls.
- Universal scraping of every website on the internet.
- Guaranteed real-time inventory for sources that do not expose reliable inventory data.
- Building a general-purpose AI shopping agent before the deterministic discovery workflow is stable.

## 11. Long-Term Direction

After the pilot is stable, Prodexa can evolve into a multi-tenant SaaS platform with:

- Self-service onboarding.
- Subscription billing.
- Automated license provisioning.
- Connector marketplace.
- Advanced product matching.
- Search analytics.
- Merchant dashboards.
- Usage-based billing.
- Automated or partner-based fulfillment where legally and operationally appropriate.
- Additional storefront integrations beyond WordPress.

## 12. Source of Truth

This document defines the product vision. If implementation details conflict with this vision, the conflict must be recorded in `BUSINESS_DECISIONS.md` before code is changed.
