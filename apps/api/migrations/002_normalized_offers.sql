-- Tenant-scoped normalized offer index for discovery search (T-012).
-- This is not a WooCommerce catalog. Connectors (T-013) will populate it;
-- tests and operators may seed rows until then.

CREATE TABLE normalized_offers (
  offer_id TEXT PRIMARY KEY CHECK (offer_id ~ '^off_'),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  external_product_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  availability TEXT NOT NULL CHECK (
    availability IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')
  ),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX normalized_offers_tenant_id_idx ON normalized_offers (tenant_id);
CREATE INDEX normalized_offers_tenant_offer_id_idx ON normalized_offers (tenant_id, offer_id);
