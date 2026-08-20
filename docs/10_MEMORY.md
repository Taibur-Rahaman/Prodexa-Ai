# Prodexa AI — Project Memory

## Purpose

This is a compact durable memory file for AI coding agents. It records current state, not every historical detail.

## Current Product

Prodexa AI is being built as a product-discovery engine with a WordPress/WooCommerce plugin and hosted backend API.

## Current Stage

Pilot-first. The first goal is to validate the system on the owner's own commerce operation before commercial SaaS launch.

## Locked Architecture

- WordPress plugin = client/integration layer.
- Hosted Prodexa API = discovery/control layer.
- Connectors = isolated source integrations.
- Discovery data is not automatically imported as permanent WooCommerce products.
- Customer pays merchant through existing checkout.
- Initial fulfillment is manual.
- License enforcement is server-side.

## Locked Product Principles

- Fast storefront.
- Cache aggressively where safe.
- Parallelize external retrieval in backend.
- Keep secrets server-side.
- Keep source/order traceability for authorized admins.
- AI assists but does not control financial truth.
- Do not bypass source access controls.

## Documentation Protocol

When a meaningful decision changes, update:

1. Relevant source-of-truth document.
2. `02_BUSINESS_DECISIONS.md` if material.
3. `CHANGELOG.md`.
4. `TASKS.md` when work status changes.

## Current Unknowns

- Backend framework.
- Hosting provider.
- Cache provider.
- Database details.
- AI provider.
- Billing provider.
- First production connector set.

## AI Working Style

Use minimal context necessary. Prefer reading the relevant document rather than loading the whole repository. Never assume an undocumented decision is locked.

## Current Rule for UI Changes

No broad redesign. Change only what the request requires and preserve the established design unless the user explicitly asks for a redesign.
