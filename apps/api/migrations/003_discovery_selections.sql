-- Short-lived, tenant/site-scoped discovery selections (T-016).
-- Phase 1 revalidation is PostgreSQL normalized_offers only (T-013 remains BLOCKED).
-- This is not WooCommerce order metadata and is not a checkout record.

CREATE TABLE discovery_selections (
  selection_id TEXT NOT NULL CHECK (
    char_length(selection_id) BETWEEN 8 AND 128
    AND selection_id ~ '^[A-Za-z0-9._-]+$'
  ),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  site_id TEXT NOT NULL REFERENCES site_activations (site_id),
  offer_id TEXT NOT NULL CHECK (offer_id ~ '^off_'),
  offer_retrieved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, site_id, selection_id)
);

CREATE INDEX discovery_selections_tenant_site_idx
  ON discovery_selections (tenant_id, site_id);

CREATE INDEX discovery_selections_expires_at_idx
  ON discovery_selections (expires_at);
