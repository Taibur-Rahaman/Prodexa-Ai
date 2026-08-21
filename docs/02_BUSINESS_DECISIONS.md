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

**Consequences:** `POST /v1/license/validate`, `POST /v1/license/activate`, `POST /v1/license/deactivate`, `POST /v1/discovery/search`, and `POST /v1/discovery/select` use this scheme (DEC-018, DEC-027). Usage remains unimplemented. No fake license API is provided.

## DEC-018 — Plugin-to-API HMAC Wire Format

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Protected plugin-to-API requests authenticate a site with HMAC-SHA256. Required headers: `x-prodexa-site-id`, `x-prodexa-timestamp`, `x-prodexa-nonce`, `x-prodexa-signature`, plus `x-request-id`. The canonical string is `v1`, HTTP method, path, timestamp, nonce, SHA-256 of the raw body, and site id, joined by newlines. Site secrets are stored encrypted at rest using `API_SIGNING_SECRET`. Replay is rejected via a timestamp skew window and a per-site nonce table in PostgreSQL. Browser JavaScript must not hold the site secret. A single global plugin secret is forbidden.

**Why:** DEC-017 deferred the wire format until license endpoints shipped. HMAC provides site identity, rotation (re-issue site secret), revocation (site or license status), expiration (timestamp window), and replay resistance without introducing Redis or a token store in this loop.

**Alternatives considered:** Short-lived site bearer tokens (also allowed by DEC-017; deferred to keep validation from depending on a token issuer). Redis nonce cache (canonical cache remains Redis per DEC-015, but T-011 is a later task; durable replay records fit PostgreSQL).

**Consequences:** `POST /v1/license/activate` and `POST /v1/license/deactivate` reuse the same HMAC/nonce checks (DEC-027). `POST /v1/discovery/search` and `POST /v1/discovery/select` reuse the same HMAC/nonce checks; those bodies have no `domain` field, so license evaluation uses the site's stored activation domain. Tests use an in-process PostgreSQL engine (PGlite) against the same SQL as production `pg`. Production license, offer-index, and selection data must use PostgreSQL via `DATABASE_URL`, never an in-memory map.

## DEC-019 — Discovery Select Contract

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** `POST /v1/discovery/select` creates a 15-minute server-verifiable selection for an offer from discovery search. The request is `{ offer_id, selection_id }`. Tenant comes only from HMAC site identity; `tenant_id` in the body is ignored. `selection_id` is the idempotency key within the authenticated tenant/site. Repeat of a valid request returns the existing active selection; reusing the key for a different offer is `409`; an expired key is `410`. Phase 1 revalidates against PostgreSQL `normalized_offers` only. External connectors are not called while T-013 is blocked. The response is customer-safe: `selection_id`, `offer_id`, `expires_at`. No pricing recalculation, ranking, checkout, payment, Redis selection cache, or WooCommerce order metadata.

**Why:** Loop 8 correctly blocked because this contract was undefined. The selection reference must exist before checkout metadata. Connector-backed live revalidation cannot be guessed.

**Alternatives considered:** Live connector revalidation in this loop (rejected — T-013 blocked); accepting client-supplied tenant/offer ownership (rejected); writing WooCommerce order metadata in the same loop (rejected — separate task).

**Consequences:** The WordPress plugin uses this selection reference at checkout (DEC-020). Connector-backed revalidation needs a new decision after T-013 is unblocked. This endpoint still does not write WooCommerce order metadata.

## DEC-020 — WooCommerce Order Metadata Is a Selection Reference

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** WooCommerce order metadata stores only the HMAC-validated discovery selection reference: `_prodexa_selection_id` and `_prodexa_selection_expires_at`, copied from `POST /v1/discovery/select`. PHP mints `selection_id`. Checkout revalidates by replaying that existing endpoint with the pending `selection_id` and `offer_id`. There is no GET selection API. Order meta is not authoritative for price, product identity beyond the selection reference, license, tenant, or payment. Client-supplied checkout fields, cart fields, and extra session keys are untrusted. `offer_id` may be held in the WooCommerce session only as untrusted input to the replay.

**Why:** Loop 10 must attach a server-verifiable reference without inventing a new API contract and without treating WordPress as the source of financial or tenant truth.

**Alternatives considered:** GET `/v1/discovery/selection` (rejected — not in DEC-019); storing source URL, prices, or offer identity on the order (rejected — backend remains authoritative; `selection_id` is the handle).

**Consequences:** Payment, WooCommerce totals, product sync, and connectors remain unimplemented. T-013 stays BLOCKED. Connector-backed live revalidation still needs a later decision.

## DEC-021 — Pricing Authority

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Prodexa backend is authoritative for the offer price. WooCommerce must never trust a client-supplied Prodexa price. WooCommerce does not independently calculate or override the Prodexa offer price.

**Why:** DEC-007 requires merchant fees/margins and payable pricing to be calculated or verified server-side. Browser, checkout POST, session, and plugin fields can be manipulated. Loop 11 correctly blocked a pricing engine until this authority was locked.

**Alternatives considered:** Trusting WooCommerce or browser `display_price` (rejected); letting WooCommerce recalculate or override the Prodexa offer price (rejected).

**Consequences:** Order metadata, checkout POST, cart fields, and extra session keys cannot become the Prodexa offer price. Phase 1 satisfies DEC-007 by verifying the stored PostgreSQL offer price (DEC-022, DEC-024). This does not reverse DEC-007. Merchant markup formulas remain future work.

## DEC-022 — Pricing Rules

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Phase 1 has NO dynamic pricing engine. `normalized_offers.price` is the authoritative stored offer price. No percentage/fixed markup rules yet. No invented formulas.

**Why:** PRD FR-07 describes future merchant fee/margin rules, but no markup, tax, or formula was authorized. Inventing one would put an unaudited amount into commerce.

**Alternatives considered:** Percentage markup (rejected — not decided); fixed fee (rejected); treating the PRD fee/margin example as a locked formula (rejected).

**Consequences:** Customer `display_price` equals stored `normalized_offers.price` with no transformation. A later locked decision is required before any markup engine. DEC-007 remains in force for that future engine. TASKS "Add pricing engine" is deferred.

## DEC-023 — Currency / Tax / Discounts / Fees

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Phase 1 Prodexa does not calculate tax, discounts, payment fees, or additional checkout fees. Preserve the offer's stored currency. WooCommerce remains responsible for its existing checkout/tax mechanics unless a future locked decision changes this.

**Why:** Tax and payment fees belong to the merchant checkout (DEC-005). Prodexa must not invent them. Currency conversion was not authorized.

**Alternatives considered:** A Prodexa tax engine (rejected); FX conversion (rejected); applying WooCommerce tax to a client-supplied Prodexa price (rejected — DEC-021).

**Consequences:** Stored currency is returned unchanged. WooCommerce tax on ordinary catalog checkout is unchanged. Prodexa does not inject priced line items in this phase. How WooCommerce tax would apply to a future Prodexa-priced line item needs a later decision.

## DEC-024 — Price Source

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Phase 1 price source is PostgreSQL `normalized_offers`. No live connector price because T-013 remains BLOCKED. Future connector-backed live price requires a separate decision.

**Why:** T-013 is blocked; live connector prices cannot be guessed. Search and select already use the tenant-scoped offer index.

**Alternatives considered:** Live connector fetch at search or select (rejected — T-013 blocked); client-supplied source price (rejected — DEC-021).

**Consequences:** Search `display_price` and any server-side price resolution read `normalized_offers`. Connector-backed live price needs a new decision after T-013 is unblocked. T-013 stays BLOCKED.

## DEC-025 — Pricing API

**Status:** LOCKED  
**Date:** 2026-08-21  
**Decision:** Do NOT create a pricing engine or quote endpoint in Phase 1. Existing discovery/search/select remain the current contract. Selected offer price is resolved server-side from PostgreSQL when required. Do not expose a client-authoritative price.

**Why:** A quote API would invent a contract. Search already returns customer-safe `display_price` from the stored offer. Select remains a selection reference (DEC-019) and must not become a price channel.

**Alternatives considered:** `POST /v1/pricing/quote` (rejected); adding price to the select response (rejected — would change DEC-019); trusting a plugin-supplied price at checkout (rejected).

**Consequences:** No `/v1/pricing` routes. Select response stays `selection_id`, `offer_id`, `expires_at`. Server-side code may read `normalized_offers.price` for the authenticated tenant when a later flow needs the offer price. Clients cannot submit a trusted price.

## DEC-026 — Phase 1 Ranking

**Status:** LOCKED  
**Date:** 2026-08-22  
**Decision:** Ranking is NOT a Phase 1 MVP contract. Discovery search remains deterministic PostgreSQL ordering: `ORDER BY offer_id ASC`. No ranking score. No rank field. No sort parameter. No ranking API. No ML/AI ranking. No connector/live-data dependency. No price-based ranking. No personalization or sponsored ranking. Ranking may be introduced later under a new explicit decision and API/task contract.

**Why:** Loop 13 correctly blocked because ranking signals, sort contract, and API fields were unspecified. Inventing a ranking model would change customer-visible search order without an authorized contract.

**Alternatives considered:** Relevance ranking (rejected — not specified); price competitiveness ranking (rejected — no price-based ranking in Phase 1; DEC-022 has no pricing engine); ML/AI ranking (rejected — DEC-009 plus no ranking contract); client `sort` parameter (rejected); sponsored or personalized ranking (rejected).

**Consequences:** Do not modify discovery search behavior. Do not add ranking code. TASKS "Add ranking baseline" is deferred. T-013 stays BLOCKED. Search continues to return lexical AND-match results in stable `offer_id` order.

## DEC-027 — License Activation Lifecycle

**Status:** LOCKED  
**Date:** 2026-08-22  
**Decision:** License activation and deactivation use HMAC site authentication and the existing PostgreSQL `site_activations` / `licenses.activation_limit` model.

Activation is `POST /v1/license/activate` with body `{ "site_id": "<authenticated site identity>" }`. Tenant and license identity are resolved server-side from the authenticated site. Clients must never control `tenant_id`. Activation verifies the license exists, is valid, and is allowed to activate. It is idempotent for the same tenant + site + license. Activation limits use `licenses.activation_limit` (already defined). Inactive site status in the existing schema is `revoked`. No new billing/subscription/payment behavior.

Deactivation is `POST /v1/license/deactivate` with the same body shape. It is tenant-scoped via HMAC, idempotent when already inactive, and must not delete the site row, license, or historical usage records. Existing inactive state is `site_activations.status = 'revoked'`.

Responses are `{ "activated": true, "site_id": "…" }` and `{ "deactivated": true, "site_id": "…" }`. Errors: `400` invalid request, `401` auth failure, `403` authorization/site mismatch, `404` association not found where applicable, `409` activation limit/conflict, `422` license not activatable. Secrets and license keys are never returned. `POST /v1/license/validate` semantics are unchanged.

**Why:** Loop 15 requires a minimum activation/deactivation lifecycle. The site credential and license binding already exist in PostgreSQL; inventing bootstrap-from-license-key, new quotas, or billing would invent contracts.

**Alternatives considered:** Creating a new `inactive` site status (rejected — existing model uses `active`/`revoked`); inventing activation quotas beyond `licenses.activation_limit` (rejected); accepting client `tenant_id` (rejected); changing validate semantics (rejected).

**Consequences:** Activate/deactivate require a pre-provisioned `site_activations` row (HMAC identity). Bootstrap provisioning that mints site secrets from a license key remains a later task. T-013 stays BLOCKED. No billing/payment.

## Change Protocol

Before changing a locked decision:

1. Stop implementation.
2. Explain the conflict.
3. Create/update the decision entry with the reason.
4. Update affected architecture/PRD documents.
5. Only then modify implementation.

## Future Decisions

New decisions must use the next available `DEC-NNN` identifier and must never rewrite history without preserving the reason for the change.
