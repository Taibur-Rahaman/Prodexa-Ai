# Prodexa AI — Connector Framework

## Purpose

Connectors are isolated integrations that retrieve product information from permitted external sources.

## Connector Principles

- One connector = one source/integration boundary.
- Connector credentials stay server-side.
- Connector failures are isolated.
- Connector behavior is observable.
- Rate limits are respected.
- Source terms, permissions, APIs, and applicable law must be respected.
- No connector may bypass access controls or anti-bot mechanisms.

## Common Interface

A connector should conceptually support:

```text
search(query, context) -> raw offers
get_product(reference) -> raw product, if permitted
normalize(raw) -> normalized offer
health() -> connector health
```

Implementation language is TypeScript on the Prodexa API (DEC-014).

## Normalized Offer

Every connector should produce a common representation containing, where available:

- Source ID.
- Source URL.
- External product ID.
- Title.
- Description.
- Image URL.
- Price.
- Currency.
- Availability.
- Variants.
- Retrieved timestamp.
- Freshness/expiry information.

## Connector Registry

The platform should maintain a registry containing:

- Connector ID.
- Display name.
- Enabled/disabled state.
- Supported regions.
- Supported capabilities.
- Credential status.
- Rate-limit configuration.
- Health status.

## Source Priority

Search should not assume that one source is always best. Ranking must consider product relevance, price, freshness, availability confidence, and source reliability.

## Compliance Gate

A connector must not be enabled for production until its retrieval method has been reviewed for:

- Source authorization/permission.
- API/terms compliance.
- Rate limits.
- Data licensing.
- Required attribution/disclosures.
- Privacy implications.

## Failure Handling

Classify failures such as:

- Timeout.
- Rate limited.
- Temporary server error.
- Product not found.
- Access denied.
- Invalid source response.
- Connector configuration error.

Do not retry access-denied or policy-blocked responses indefinitely.

## Adding a Connector

1. Document the source and permission basis.
2. Define supported data fields.
3. Implement connector interface.
4. Add normalization tests.
5. Add timeout/rate-limit behavior.
6. Add health checks.
7. Add fixture-based tests.
8. Validate ranking output.
9. Update this document and `BUSINESS_DECISIONS.md` if architecture changes.
10. Enable in staging before production.
