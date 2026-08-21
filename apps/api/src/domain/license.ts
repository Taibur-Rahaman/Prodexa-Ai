export type LicenseStatus =
  | "active"
  | "trial"
  | "expired"
  | "suspended"
  | "revoked"
  | "pending";

export type SiteActivationStatus = "active" | "revoked";

export const LICENSE_STATUSES = [
  "active",
  "trial",
  "expired",
  "suspended",
  "revoked",
  "pending",
] as const;

export type PlanUsageLimits = {
  search_requests_per_day: number | null;
  connector_calls_per_day: number | null;
};

export type LicenseSnapshot = {
  tenantId: string;
  licenseId: string;
  siteId: string;
  siteStatus: SiteActivationStatus;
  boundDomain: string;
  requestDomain: string;
  licenseStatus: LicenseStatus;
  startsAt: Date;
  expiresAt: Date | null;
  activationLimit: number;
  activationUsed: number;
  plan: {
    id: string;
    code: string;
    name: string;
  };
  features: Record<string, boolean>;
  usageLimits: PlanUsageLimits;
  usage: {
    period_start: string;
    search_requests: number;
    connector_calls: number;
  };
  requestedFeature: string | null;
};

export type LicenseDenial = {
  ok: false;
  code: string;
  message: string;
  statusCode: number;
};

export type LicenseGrant = {
  ok: true;
  tenant_id: string;
  license_id: string;
  site_id: string;
  plan: {
    id: string;
    code: string;
    name: string;
  };
  status: LicenseStatus;
  starts_at: string;
  expires_at: string | null;
  activation: {
    domain: string;
    limit: number;
    used: number;
  };
  features: Record<string, boolean>;
  usage: {
    period_start: string;
    search_requests: { used: number; limit: number | null };
    connector_calls: { used: number; limit: number | null };
  };
};

export type LicenseDecision = LicenseGrant | LicenseDenial;

export const LICENSE_MESSAGES = {
  SITE_REVOKED: "This site activation is revoked.",
  DOMAIN_MISMATCH: "The site domain does not match this license activation.",
  LICENSE_REVOKED: "The Prodexa license has been revoked.",
  LICENSE_SUSPENDED: "The Prodexa license is suspended.",
  LICENSE_PENDING: "The Prodexa license is not yet active.",
  LICENSE_EXPIRED: "The Prodexa license is not active.",
  ACTIVATION_LIMIT_EXCEEDED: "This license has exceeded its activation limit.",
  FEATURE_NOT_ENTITLED: "The requested feature is not included in this plan.",
  USAGE_LIMIT_EXCEEDED: "This license has exceeded its usage allowance.",
} as const;

function utcDateString(value: Date): string {
  return value.toISOString();
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function evaluateLicense(snapshot: LicenseSnapshot, now: Date): LicenseDecision {
  if (snapshot.siteStatus === "revoked") {
    return {
      ok: false,
      code: "SITE_REVOKED",
      message: LICENSE_MESSAGES.SITE_REVOKED,
      statusCode: 403,
    };
  }

  if (snapshot.requestDomain !== snapshot.boundDomain) {
    return {
      ok: false,
      code: "DOMAIN_MISMATCH",
      message: LICENSE_MESSAGES.DOMAIN_MISMATCH,
      statusCode: 403,
    };
  }

  if (snapshot.licenseStatus === "revoked") {
    return {
      ok: false,
      code: "LICENSE_REVOKED",
      message: LICENSE_MESSAGES.LICENSE_REVOKED,
      statusCode: 403,
    };
  }

  if (snapshot.licenseStatus === "suspended") {
    return {
      ok: false,
      code: "LICENSE_SUSPENDED",
      message: LICENSE_MESSAGES.LICENSE_SUSPENDED,
      statusCode: 403,
    };
  }

  if (snapshot.licenseStatus === "pending" || now < snapshot.startsAt) {
    return {
      ok: false,
      code: "LICENSE_PENDING",
      message: LICENSE_MESSAGES.LICENSE_PENDING,
      statusCode: 403,
    };
  }

  const expiredByStatus = snapshot.licenseStatus === "expired";
  const expiredByTime = snapshot.expiresAt !== null && now >= snapshot.expiresAt;
  if (expiredByStatus || expiredByTime) {
    return {
      ok: false,
      code: "LICENSE_EXPIRED",
      message: LICENSE_MESSAGES.LICENSE_EXPIRED,
      statusCode: 403,
    };
  }

  if (snapshot.activationUsed > snapshot.activationLimit) {
    return {
      ok: false,
      code: "ACTIVATION_LIMIT_EXCEEDED",
      message: LICENSE_MESSAGES.ACTIVATION_LIMIT_EXCEEDED,
      statusCode: 403,
    };
  }

  if (snapshot.requestedFeature) {
    if (snapshot.features[snapshot.requestedFeature] !== true) {
      return {
        ok: false,
        code: "FEATURE_NOT_ENTITLED",
        message: LICENSE_MESSAGES.FEATURE_NOT_ENTITLED,
        statusCode: 403,
      };
    }

    if (
      snapshot.requestedFeature === "discovery.search" &&
      snapshot.usageLimits.search_requests_per_day !== null &&
      snapshot.usage.search_requests >= snapshot.usageLimits.search_requests_per_day
    ) {
      return {
        ok: false,
        code: "USAGE_LIMIT_EXCEEDED",
        message: LICENSE_MESSAGES.USAGE_LIMIT_EXCEEDED,
        statusCode: 403,
      };
    }
  }

  const effectiveStatus: LicenseStatus =
    snapshot.licenseStatus === "trial" ? "trial" : "active";

  return {
    ok: true,
    tenant_id: snapshot.tenantId,
    license_id: snapshot.licenseId,
    site_id: snapshot.siteId,
    plan: snapshot.plan,
    status: effectiveStatus,
    starts_at: utcDateString(snapshot.startsAt),
    expires_at: snapshot.expiresAt ? utcDateString(snapshot.expiresAt) : null,
    activation: {
      domain: snapshot.boundDomain,
      limit: snapshot.activationLimit,
      used: snapshot.activationUsed,
    },
    features: snapshot.features,
    usage: {
      period_start: snapshot.usage.period_start || utcDay(now),
      search_requests: {
        used: snapshot.usage.search_requests,
        limit: snapshot.usageLimits.search_requests_per_day,
      },
      connector_calls: {
        used: snapshot.usage.connector_calls,
        limit: snapshot.usageLimits.connector_calls_per_day,
      },
    },
  };
}

export function parseFeatureMap(value: unknown): Record<string, boolean> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const features: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "boolean") {
      features[key] = entry;
    }
  }
  return features;
}

function parseLimit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export function parseUsageLimits(value: unknown): PlanUsageLimits {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { search_requests_per_day: null, connector_calls_per_day: null };
  }
  const record = value as Record<string, unknown>;
  return {
    search_requests_per_day: parseLimit(record.search_requests_per_day),
    connector_calls_per_day: parseLimit(record.connector_calls_per_day),
  };
}
