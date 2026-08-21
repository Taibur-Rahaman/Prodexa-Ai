import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, hashLicenseKey } from "./auth/secret-box.js";
import { signSiteRequest } from "./auth/site-hmac.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { migrate } from "./db/migrate.js";
import type { SqlClient } from "./db/sql.js";
import { createTestDatabase } from "./test/pglite.js";

const MASTER = "test-api-signing-secret-not-for-production";
const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

let db: SqlClient;
let closeDb: () => Promise<void>;

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) {
      await app.close();
    }
  }
});

type Fixture = {
  tenantId: string;
  otherTenantId: string;
  licenseId: string;
  siteId: string;
  siteSecret: string;
};

async function seed(
  overrides: {
    status?: string;
    siteStatus?: string;
    domain?: string;
    expiresAt?: string | null;
    startsAt?: string;
    searchUsed?: number;
  } = {},
): Promise<Fixture> {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const planId = randomUUID();
  const licenseId = randomUUID();
  const activationId = randomUUID();
  const siteId = `sit_${randomUUID()}`;
  const siteSecret = randomBytes(32).toString("hex");
  const domain = overrides.domain ?? "shop.example.com";
  const startsAt = overrides.startsAt ?? "2026-01-01T00:00:00.000Z";
  const expiresAt =
    overrides.expiresAt === undefined ? "2027-01-01T00:00:00.000Z" : overrides.expiresAt;

  await db.query("INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)", [
    tenantId,
    "Tenant A",
    otherTenantId,
    "Tenant B",
  ]);
  await db.query(
    `
    INSERT INTO plans (id, code, name, max_activations, features, usage_limits)
    VALUES ($1, $2, $3, 1, $4::jsonb, $5::jsonb)
    `,
    [
      planId,
      `pilot-${planId.slice(0, 8)}`,
      "Pilot",
      JSON.stringify({ "discovery.search": true, "ai.assist": false }),
      JSON.stringify({ search_requests_per_day: 10, connector_calls_per_day: 20 }),
    ],
  );
  await db.query(
    `
    INSERT INTO licenses (
      id, tenant_id, plan_id, license_key_hash, status, starts_at, expires_at, activation_limit
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
    `,
    [
      licenseId,
      tenantId,
      planId,
      hashLicenseKey(`lic_${randomUUID()}`, MASTER),
      overrides.status ?? "active",
      startsAt,
      expiresAt,
    ],
  );
  await db.query(
    `
    INSERT INTO site_activations (
      id, tenant_id, license_id, site_id, domain, secret_encrypted, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      activationId,
      tenantId,
      licenseId,
      siteId,
      domain,
      encryptSecret(siteSecret, MASTER),
      overrides.siteStatus ?? "active",
    ],
  );
  if (overrides.searchUsed !== undefined) {
    await db.query(
      `
      INSERT INTO usage_counters (
        tenant_id, license_id, period_start, search_requests, connector_calls
      ) VALUES ($1, $2, CURRENT_DATE, $3, 0)
      `,
      [tenantId, licenseId, overrides.searchUsed],
    );
  }

  return { tenantId, otherTenantId, licenseId, siteId, siteSecret };
}

async function createLicensedApp() {
  const app = await buildApp(
    loadConfig({
      NODE_ENV: "test",
      PORT: "8000",
      API_SIGNING_SECRET: MASTER,
    }),
    { db },
  );
  apps.push(app);
  return app;
}

function signedRequest(
  fixture: Fixture,
  bodyObject: Record<string, unknown>,
  extra?: {
    nonce?: string;
    timestamp?: string;
    signature?: string;
    siteId?: string;
  },
) {
  const body = JSON.stringify(bodyObject);
  const timestamp = extra?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = extra?.nonce ?? randomUUID();
  const siteId = extra?.siteId ?? fixture.siteId;
  const signature =
    extra?.signature ??
    signSiteRequest(fixture.siteSecret, {
      method: "POST",
      path: "/v1/license/validate",
      timestamp,
      nonce,
      body,
      siteId,
    });
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-prodexa-site-id": siteId,
      "x-prodexa-timestamp": timestamp,
      "x-prodexa-nonce": nonce,
      "x-prodexa-signature": signature,
      "x-request-id": `req_${randomUUID()}`,
    },
  };
}

describe("POST /v1/license/validate", () => {
  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    closeDb = testDb.close;
    await migrate(db);
  }, 60_000);

  afterAll(async () => {
    if (closeDb) {
      await closeDb();
    }
  }, 30_000);

  afterEach(async () => {
    if (!db) {
      return;
    }
    await db.exec(`
      TRUNCATE TABLE request_nonces, usage_counters, site_activations, licenses, plans, tenants
      RESTART IDENTITY CASCADE
    `);
  });

  it("returns 503 when the license store is not configured", async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: "test", PORT: "8000" }));
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ domain: "shop.example.com" }),
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("STORE_UNAVAILABLE");
  });

  it("validates an active licensed site and never returns the site secret", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const request = signedRequest(fixture, { domain: "https://www.shop.example.com/admin" });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: request.headers,
      payload: request.body,
    });
    const body = response.json() as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.tenant_id).toBe(fixture.tenantId);
    expect(body.license_id).toBe(fixture.licenseId);
    expect(body.site_id).toBe(fixture.siteId);
    expect(body.tenant_id).not.toBe(body.site_id);
    expect(body.status).toBe("active");
    expect((body.activation as { domain: string }).domain).toBe("shop.example.com");
    expect(JSON.stringify(body)).not.toMatch(/password|secret|api[_-]?key|BEGIN /i);
    expect(JSON.stringify(body)).not.toContain(fixture.siteSecret);
    expect(body.tenant_id).not.toBe(fixture.otherTenantId);
  });

  it("does not honor a client-supplied tenant_id", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const request = signedRequest(fixture, {
      domain: "shop.example.com",
      tenant_id: fixture.otherTenantId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().tenant_id).toBe(fixture.tenantId);
    expect(response.json().tenant_id).not.toBe(fixture.otherTenantId);
  });

  it("rejects missing, forged, and replayed signatures", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const unsigned = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ domain: "shop.example.com" }),
    });
    expect(unsigned.statusCode).toBe(401);
    expect(unsigned.json().error.code).toBe("UNAUTHENTICATED");

    const forged = signedRequest(
      fixture,
      { domain: "shop.example.com" },
      { signature: "ab".repeat(32) },
    );
    const forgedResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: forged.headers,
      payload: forged.body,
    });
    expect(forgedResponse.statusCode).toBe(401);

    const first = signedRequest(fixture, { domain: "shop.example.com" }, { nonce: "replay-nonce-1" });
    const ok = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: first.headers,
      payload: first.body,
    });
    expect(ok.statusCode).toBe(200);
    const replay = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: first.headers,
      payload: first.body,
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe("AUTH_REPLAY");
  });

  it("returns deterministic license denials for expired, revoked, and mismatched domains", async () => {
    const app = await createLicensedApp();
    const expired = await seed({ expiresAt: "2020-01-01T00:00:00.000Z" });
    const expiredRequest = signedRequest(expired, { domain: "shop.example.com" });
    const expiredResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: expiredRequest.headers,
      payload: expiredRequest.body,
    });
    expect(expiredResponse.statusCode).toBe(403);
    expect(expiredResponse.json().error.code).toBe("LICENSE_EXPIRED");

    const revoked = await seed({ status: "revoked", domain: "revoked.example.com" });
    const revokedRequest = signedRequest(revoked, { domain: "revoked.example.com" });
    const revokedResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: revokedRequest.headers,
      payload: revokedRequest.body,
    });
    expect(revokedResponse.statusCode).toBe(403);
    expect(revokedResponse.json().error.code).toBe("LICENSE_REVOKED");

    const mismatch = await seed({ domain: "bound.example.com" });
    const mismatchRequest = signedRequest(mismatch, { domain: "other.example.com" });
    const mismatchResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: mismatchRequest.headers,
      payload: mismatchRequest.body,
    });
    expect(mismatchResponse.statusCode).toBe(403);
    expect(mismatchResponse.json().error.code).toBe("DOMAIN_MISMATCH");
  });

  it("enforces requested feature entitlement against the plan", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const request = signedRequest(fixture, {
      domain: "shop.example.com",
      feature: "ai.assist",
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FEATURE_NOT_ENTITLED");
  });
});
