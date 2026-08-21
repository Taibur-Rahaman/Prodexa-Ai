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

## DEC-013 — Canonical Backend Infrastructure Domain

**Status:** LOCKED  
**Decision:** `prodexaai.cloud` is the canonical Prodexa backend/infrastructure domain. Hostinger is the current infrastructure provider available through Hostinger MCP. Backend service subdomains are created only when required by the architecture and verified before use.

**Why:** A stable canonical infrastructure domain gives the backend a consistent operational identity while allowing API, admin, webhook, and health services to be separated later without prematurely creating unnecessary services.

**Consequences:** Infrastructure changes must be inspected before modification and verified afterward. DNS/server/deployment state must never be guessed. Destructive production infrastructure changes require explicit human authorization.

## DEC-014 — Backend Runtime

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** The Prodexa API is implemented in TypeScript on Node.js 22+, using Fastify. The WordPress plugin remains PHP and is a client only.

**Why:** Architecture requires concurrent HTTP, a versioned JSON API, and a runtime separate from WordPress. Hostinger Cloud Economy on this account already runs Node.js applications, so the same language family can be operated later without putting discovery inside PHP request execution.

**Alternatives considered:** Python/FastAPI (strong for later AI matching, but not required for the API skeleton and less aligned with existing Hostinger Node.js operations); PHP API on the apex WordPress host (conflicts with DEC-002/DEC-003).

**Consequences:** Shared types and API tests live under `apps/api`. AI matching may still call an external model over HTTP; AI remains assistive (DEC-009).

## DEC-015 — Pilot Data Stores

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** PostgreSQL is the canonical durable store. Redis is the canonical cache. Local development will introduce them when license/search persistence is implemented. Shared Hostinger MySQL used by other sites on the same plan must not be reused as the Prodexa system of record.

**Why:** Architecture requires durable tenant/license data and fast cache. The inspected Hostinger plan exposes MySQL shared with unrelated websites and has no Redis or PostgreSQL service. Mixing Prodexa tenant data into that shared MySQL estate is a tenant-isolation and blast-radius risk.

**Alternatives considered:** SQLite (insufficient for multi-tenant SaaS path); Hostinger shared MySQL (available, but not isolated enough for the system of record).

**Consequences:** Production API deploy waits for a dedicated data plane (VPS/Docker or equivalent). Human authorization is required before purchasing a VPS or creating databases.

## DEC-016 — Hosting Topology After Inspection

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Develop and test the API locally. Do not deploy the discovery API into the WordPress document root on `prodexaai.cloud`. Do not create `api.prodexaai.cloud` or other subdomains until a dedicated runtime exists and a human authorizes DNS/hosting changes. Pilot production target is a dedicated Hostinger VPS/Docker (or equivalent isolated Node.js runtime), which did not exist at inspection.

**Why:** Read-only Hostinger inspection on 2026-08-21 found: DNS for `prodexaai.cloud` at Hostinger; the domain is not registered through Hostinger Domains; an addon website on Cloud Economy shared hosting with a WordPress install (including `wp-config.php`); no VPS; no `api.prodexaai.cloud` record; no Node.js deployment on this domain. Apex HTTP from this network returned Hostinger CDN 408. Putting connectors and license authority inside that WordPress tree would violate DEC-002.

**Alternatives considered:** Convert the existing apex WordPress site into the API (rejected); auto-create `api.prodexaai.cloud` (rejected — subdomain creation requires human authorization).

**Consequences:** The WordPress files already on the apex are not treated as the Prodexa API. They must not be deleted or overwritten without explicit human authorization. `api.prodexaai.cloud` is still a possible future name only.

## DEC-017 — Site Authentication Scheme

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Protected plugin-to-API calls authenticate a site (not a browser user) with a server-side credential pair: site/license identity plus a secret that never ships to visitors. Requests use HTTPS and include a request ID. The exact wire format (HMAC headers vs short-lived site tokens) will be documented in `04_API.md` when the license endpoints are implemented. Browser JavaScript must not hold the site secret. A single global secret must not be embedded in the distributed plugin.

**Why:** API spec requires site identity, rotation, and revocation. License enforcement is server-side (DEC-008). WordPress is an untrusted client from the API's perspective.

**Alternatives considered:** Shared plugin-wide API key (rejected); trusting WordPress capability checks as Prodexa authorization (rejected).

**Consequences:** License validation, discovery, and usage endpoints remain unimplemented until this scheme is built. No fake license API is provided in the meantime.

## Change Protocol

Before changing a locked decision:

1. Stop implementation.
2. Explain the conflict.
3. Create/update the decision entry with the reason.
4. Update affected architecture/PRD documents.
5. Only then modify implementation.

## Future Decisions

New decisions must use the next available `DEC-NNN` identifier and must never rewrite history without preserving the reason for the change.
