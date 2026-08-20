# Prodexa AI — Business Decisions

This document is the decision ledger for choices that materially affect product behavior, business model, security, architecture, or customer experience.

## How to Use This File

Every material change should record:

- Decision ID.
- Date.
- Status.
- Decision.
- Why it was made.
- Alternatives considered.
- Consequences.

AI tools must not silently reverse a locked decision.

## DEC-001 — Pilot Before SaaS

**Status:** LOCKED  
**Decision:** Prodexa will first be validated on the owner's own commerce operation. Only after the workflow is stable will it be packaged and sold as a subscription SaaS.

**Why:** Real-world usage will validate search quality, pricing, latency, source reliability, fulfillment workflow, and operating cost before commercial launch.

## DEC-002 — Hosted Backend API

**Status:** LOCKED  
**Decision:** The WordPress plugin will communicate with a separately hosted Prodexa API rather than performing multi-source discovery directly inside WordPress.

**Why:** This reduces WordPress load, allows parallel source retrieval, centralizes caching and connector logic, and makes the platform reusable by future clients and non-WordPress clients.

## DEC-003 — WordPress Plugin as Client

**Status:** LOCKED  
**Decision:** The WordPress plugin is an integration/client layer, not the core discovery engine.

**Why:** The same backend should eventually serve multiple WordPress sites and other clients.

## DEC-004 — No Permanent Product Import by Default

**Status:** LOCKED  
**Decision:** Discovered external products should not automatically become permanent WooCommerce products.

**Why:** The core value is dynamic discovery and presentation while avoiding uncontrolled catalog duplication and stale records.

## DEC-005 — Customer Pays Merchant

**Status:** LOCKED FOR MVP  
**Decision:** Customer payment is collected through the merchant's existing checkout/payment system.

**Why:** This keeps checkout familiar and allows the merchant to control the customer relationship.

## DEC-006 — Manual Fulfillment

**Status:** LOCKED FOR MVP  
**Decision:** After payment, the merchant manually purchases/redeems the selected source product and fulfills the customer order.

**Why:** It reduces early automation risk and lets the business validate the model before building external purchasing integrations.

## DEC-007 — Server-Side Pricing

**Status:** LOCKED  
**Decision:** Merchant fees/margins and final payable pricing must be calculated or verified server-side.

**Why:** Browser-side calculations can be manipulated and cannot be trusted for commerce.

## DEC-008 — Remote License Enforcement

**Status:** LOCKED  
**Decision:** Prodexa will use server-side subscription/license validation so a copied plugin cannot operate indefinitely without authorization.

**Why:** The product is intended to become subscription software, so licensing must remain under the operator's control.

## DEC-009 — AI Is Assistive, Not Authoritative

**Status:** LOCKED  
**Decision:** AI may assist product matching, classification, ranking, and extraction, but deterministic validation remains authoritative for price, currency, source URL, request integrity, and order totals.

**Why:** AI can hallucinate or misinterpret external data and must not directly control financial outcomes.

## DEC-010 — Source Compliance

**Status:** LOCKED  
**Decision:** Connectors must respect source permissions, APIs, terms, robots rules where applicable, rate limits, licensing, and applicable law. Prodexa will not bypass authentication, CAPTCHAs, paywalls, anti-bot systems, or technical access controls.

**Why:** The platform must be commercially sustainable and legally/technically responsible.

## DEC-011 — Admin Source Transparency

**Status:** LOCKED

**Decision:** Authorized administrators must be able to identify the source URL and source pricing information needed to fulfill an order.

**Why:** Manual fulfillment requires traceability.

**Customer disclosure caveat:** Required source attribution, licensing, or other disclosures must not be hidden when a source or law requires them.

## DEC-012 — AI Documentation Memory

**Status:** LOCKED  
**Decision:** Architecture, product, UI, and business changes must be reflected in the appropriate Markdown source-of-truth documents.

**Why:** Cursor and other AI tools need durable context and a clear reason for every material change.

## Change Protocol

Before changing a locked decision:

1. Stop implementation.
2. Explain the conflict.
3. Create/update the decision entry with the reason.
4. Update affected architecture/PRD documents.
5. Only then modify implementation.

## Future Decisions

New decisions must use the next available `DEC-NNN` identifier and must never rewrite history without preserving the reason for the change.
