CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  max_activations INTEGER NOT NULL CHECK (max_activations >= 0),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE licenses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  plan_id UUID NOT NULL REFERENCES plans (id),
  license_key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'trial', 'expired', 'suspended', 'revoked', 'pending')
  ),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  activation_limit INTEGER NOT NULL CHECK (activation_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX licenses_tenant_id_idx ON licenses (tenant_id);
CREATE INDEX licenses_status_idx ON licenses (status);

CREATE TABLE site_activations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  license_id UUID NOT NULL REFERENCES licenses (id),
  site_id TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_id, domain)
);

CREATE INDEX site_activations_tenant_id_idx ON site_activations (tenant_id);
CREATE INDEX site_activations_license_id_idx ON site_activations (license_id);

CREATE TABLE usage_counters (
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  license_id UUID NOT NULL REFERENCES licenses (id),
  period_start DATE NOT NULL,
  search_requests INTEGER NOT NULL DEFAULT 0 CHECK (search_requests >= 0),
  connector_calls INTEGER NOT NULL DEFAULT 0 CHECK (connector_calls >= 0),
  PRIMARY KEY (license_id, period_start)
);

CREATE INDEX usage_counters_tenant_id_idx ON usage_counters (tenant_id);

CREATE TABLE request_nonces (
  site_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, nonce)
);

CREATE INDEX request_nonces_seen_at_idx ON request_nonces (seen_at);
