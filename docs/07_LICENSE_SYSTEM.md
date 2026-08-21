# Prodexa AI — License & Subscription System

## Objective

Prodexa is intended to become a subscription-based SaaS. License enforcement must therefore be controlled by the Prodexa backend rather than by a local plugin-only check.

## License Model

A license should be associated with:

- License ID.
- Customer/tenant ID.
- Plan ID.
- Status.
- Start date.
- Expiry date.
- Activation limit.
- Activated site/domain records.
- Usage limits.
- Connector permissions.
- Created/updated timestamps.

## Statuses

Suggested statuses:

- `active`
- `trial`
- `expired`
- `suspended`
- `revoked`
- `pending`

## Activation Flow

1. Customer installs plugin.
2. Customer enters license key.
3. Plugin sends activation request to Prodexa API.
4. API authenticates request and validates license.
5. API checks activation/domain limits.
6. API creates an activation record.
7. Plugin receives limited activation state.

## Domain Binding

A license may be restricted to one or more approved domains according to the plan.

The system should normalize domains safely and account for common WordPress environments such as staging sites without creating an easy bypass.

## Expiration

The backend is authoritative for expiration.

The plugin may cache a short-lived license status for resilience, but cached authorization must not allow indefinite operation after expiry.

## Suspension/Revoke

An operator must be able to suspend or revoke a license without publishing a new plugin version.

Protected API access must check the effective license state.

## Subscription Integration

Billing provider selection is intentionally open. When selected, billing events should update the Prodexa license service through verified server-to-server webhooks.

Never trust a browser redirect as proof of payment.

## Usage Metering

Track at least:

- Search requests.
- Source/connector calls.
- API errors.
- Active sites.
- Optional AI usage.

Usage records should be attributable to a tenant/license and request ID.

## Security

- Never put the master license database credentials in the plugin.
- Never expose signing secrets to WordPress visitors.
- Rotate credentials.
- Rate-limit activation attempts.
- Log activation/revocation events.
- Detect suspicious repeated activations.

## Commercial Plans

Initial plan names and prices are not locked. The architecture should support multiple plans without requiring plugin rewrites.

Possible plan dimensions:

- Number of sites.
- Search quota.
- Connector access.
- Cache/freshness options.
- AI features.
- Support level.

## Offline Behavior

The system should tolerate brief Prodexa API outages without destroying the merchant storefront. However, offline grace periods must be bounded and must not undermine subscription enforcement.

## Pilot implementation

Durable tables live in PostgreSQL (`tenants`, `plans`, `licenses`, `site_activations`, `usage_counters`, `request_nonces`). `POST /v1/license/validate` is the first license API and uses HMAC site authentication (DEC-018). Activation and deactivation endpoints are not implemented yet; tests seed activations directly. Staging hosts are not auto-trusted — they must be activated as their own domain.
