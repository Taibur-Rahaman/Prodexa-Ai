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
  otherSiteId: string;
  licenseId: string;
  siteId: string;
  siteSecret: string;
  activationId: string;
};

async function seed(
  overrides: {
    status?: string;
    siteStatus?: string;
    domain?: string;
    expiresAt?: string | null;
    startsAt?: string;
    activationLimit?: number;
    searchUsed?: number;
    secondSiteActive?: boolean;
  } = {},
): Promise<Fixture> {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const planId = randomUUID();
  const licenseId = randomUUID();
  const activationId = randomUUID();
  const siteId = `sit_${randomUUID()}`;
  const otherSiteId = `sit_${randomUUID()}`;
  const siteSecret = randomBytes(32).toString("hex");
  const domain = overrides.domain ?? "shop.example.com";
  const startsAt = overrides.startsAt ?? "2026-01-01T00:00:00.000Z";
  const expiresAt =
    overrides.expiresAt === undefined ? "2027-01-01T00:00:00.000Z" : overrides.expiresAt;
  const activationLimit = overrides.activationLimit ?? 1;

  await db.query("INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)", [
    tenantId,
    "Tenant A",
    otherTenantId,
    "Tenant B",
  ]);
  await db.query(
    `
    INSERT INTO plans (id, code, name, max_activations, features, usage_limits)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    `,
    [
      planId,
      `pilot-${planId.slice(0, 8)}`,
      "Pilot",
      activationLimit,
      JSON.stringify({ "discovery.search": true, "ai.assist": false }),
      JSON.stringify({ search_requests_per_day: 10, connector_calls_per_day: 20 }),
    ],
  );
  await db.query(
    `
    INSERT INTO licenses (
      id, tenant_id, plan_id, license_key_hash, status, starts_at, expires_at, activation_limit
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      licenseId,
      tenantId,
      planId,
      hashLicenseKey(`lic_${randomUUID()}`, MASTER),
      overrides.status ?? "active",
      startsAt,
      expiresAt,
      activationLimit,
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

  const otherPlanId = randomUUID();
  const otherLicenseId = randomUUID();
  await db.query(
    `
    INSERT INTO plans (id, code, name, max_activations, features, usage_limits)
    VALUES ($1, $2, $3, 1, $4::jsonb, $5::jsonb)
    `,
    [
      otherPlanId,
      `other-${otherPlanId.slice(0, 8)}`,
      "Other",
      JSON.stringify({ "discovery.search": true }),
      JSON.stringify({ search_requests_per_day: 10, connector_calls_per_day: 20 }),
    ],
  );
  await db.query(
    `
    INSERT INTO licenses (
      id, tenant_id, plan_id, license_key_hash, status, starts_at, expires_at, activation_limit
    ) VALUES ($1, $2, $3, $4, 'active', $5, $6, 1)
    `,
    [
      otherLicenseId,
      otherTenantId,
      otherPlanId,
      hashLicenseKey(`lic_${randomUUID()}`, MASTER),
      startsAt,
      expiresAt,
    ],
  );
  await db.query(
    `
    INSERT INTO site_activations (
      id, tenant_id, license_id, site_id, domain, secret_encrypted, status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
    `,
    [
      randomUUID(),
      otherTenantId,
      otherLicenseId,
      otherSiteId,
      "other.example.com",
      encryptSecret(randomBytes(32).toString("hex"), MASTER),
    ],
  );

  if (overrides.secondSiteActive) {
    await db.query(
      `
      INSERT INTO site_activations (
        id, tenant_id, license_id, site_id, domain, secret_encrypted, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
      `,
      [
        randomUUID(),
        tenantId,
        licenseId,
        `sit_${randomUUID()}`,
        `peer-${domain}`,
        encryptSecret(randomBytes(32).toString("hex"), MASTER),
      ],
    );
  }

  if (overrides.searchUsed !== undefined) {
    await db.query(
      `
      INSERT INTO usage_counters (
        tenant_id, license_id, period_start, search_requests, connector_calls
      ) VALUES ($1, $2, $4::date, $3, 0)
      `,
      [tenantId, licenseId, overrides.searchUsed, new Date().toISOString().slice(0, 10)],
    );
  }

  return {
    tenantId,
    otherTenantId,
    otherSiteId,
    licenseId,
    siteId,
    siteSecret,
    activationId,
  };
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
  path: string,
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
      path,
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

describe("POST /v1/license/activate and deactivate", () => {
  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    closeDb = testDb.close;
    await migrate(db);
  }, 180_000);

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
      TRUNCATE TABLE request_nonces, usage_counters, discovery_selections, normalized_offers,
        site_activations, licenses, plans, tenants
      RESTART IDENTITY CASCADE
    `);
  });

  it("activates a revoked site for a valid license", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "revoked" });
    const request = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: request.headers,
      payload: request.body,
    });
    const body = response.json() as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ activated: true, site_id: fixture.siteId });
    expect(JSON.stringify(body)).not.toMatch(/password|secret|api[_-]?key|BEGIN /i);
    expect(JSON.stringify(body)).not.toContain(fixture.siteSecret);

    const row = await db.query<{ status: string }>(
      "SELECT status FROM site_activations WHERE site_id = $1",
      [fixture.siteId],
    );
    expect(row.rows[0]?.status).toBe("active");
  });

  it("is idempotent for the same tenant + site + license", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "active" });
    const first = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
    });
    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: first.headers,
      payload: first.body,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ activated: true, site_id: fixture.siteId });

    const second = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: second.headers,
      payload: second.body,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toEqual({ activated: true, site_id: fixture.siteId });
  });

  it("rejects activation when the license is not activatable", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ status: "revoked", siteStatus: "revoked" });
    const request = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("LICENSE_NOT_ACTIVATABLE");
  });

  it("enforces tenant isolation and ignores client tenant_id", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "revoked" });
    const mismatch = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.otherSiteId,
      tenant_id: fixture.otherTenantId,
    });
    const mismatchResponse = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: mismatch.headers,
      payload: mismatch.body,
    });
    expect(mismatchResponse.statusCode).toBe(403);
    expect(mismatchResponse.json().error.code).toBe("SITE_MISMATCH");

    const ignored = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
      tenant_id: fixture.otherTenantId,
    });
    const ignoredResponse = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: ignored.headers,
      payload: ignored.body,
    });
    expect(ignoredResponse.statusCode).toBe(200);
    expect(ignoredResponse.json()).toEqual({ activated: true, site_id: fixture.siteId });

    const status = await db.query<{ tenant_id: string; status: string }>(
      "SELECT tenant_id, status FROM site_activations WHERE site_id = $1",
      [fixture.siteId],
    );
    expect(status.rows[0]?.tenant_id).toBe(fixture.tenantId);
    expect(status.rows[0]?.tenant_id).not.toBe(fixture.otherTenantId);
    expect(status.rows[0]?.status).toBe("active");
  });

  it("rejects invalid authentication", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "revoked" });
    const unsigned = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ site_id: fixture.siteId }),
    });
    expect(unsigned.statusCode).toBe(401);
    expect(unsigned.json().error.code).toBe("UNAUTHENTICATED");

    const forged = signedRequest(
      fixture,
      "/v1/license/activate",
      { site_id: fixture.siteId },
      { signature: "ab".repeat(32) },
    );
    const forgedResponse = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: forged.headers,
      payload: forged.body,
    });
    expect(forgedResponse.statusCode).toBe(401);
  });

  it("deactivates an active site without deleting historical records", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "active", searchUsed: 3 });
    const request = signedRequest(fixture, "/v1/license/deactivate", {
      site_id: fixture.siteId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/deactivate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deactivated: true, site_id: fixture.siteId });
    expect(JSON.stringify(response.json())).not.toContain(fixture.siteSecret);

    const site = await db.query<{ status: string; id: string }>(
      "SELECT id, status FROM site_activations WHERE site_id = $1",
      [fixture.siteId],
    );
    expect(site.rows).toHaveLength(1);
    expect(site.rows[0]?.id).toBe(fixture.activationId);
    expect(site.rows[0]?.status).toBe("revoked");

    const license = await db.query<{ id: string }>(
      "SELECT id FROM licenses WHERE id = $1",
      [fixture.licenseId],
    );
    expect(license.rows).toHaveLength(1);

    const usage = await db.query<{ search_requests: number | string }>(
      "SELECT search_requests FROM usage_counters WHERE license_id = $1 AND tenant_id = $2",
      [fixture.licenseId, fixture.tenantId],
    );
    expect(usage.rows).toHaveLength(1);
    expect(Number(usage.rows[0]?.search_requests)).toBe(3);
  });

  it("is idempotent when the site is already inactive", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({ siteStatus: "revoked" });
    const first = signedRequest(fixture, "/v1/license/deactivate", {
      site_id: fixture.siteId,
    });
    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/license/deactivate",
      headers: first.headers,
      payload: first.body,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ deactivated: true, site_id: fixture.siteId });

    const second = signedRequest(fixture, "/v1/license/deactivate", {
      site_id: fixture.siteId,
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/license/deactivate",
      headers: second.headers,
      payload: second.body,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toEqual({ deactivated: true, site_id: fixture.siteId });

    const site = await db.query<{ status: string }>(
      "SELECT status FROM site_activations WHERE site_id = $1",
      [fixture.siteId],
    );
    expect(site.rows[0]?.status).toBe("revoked");
  });

  it("returns 409 when activation would exceed the license activation_limit", async () => {
    const app = await createLicensedApp();
    const fixture = await seed({
      siteStatus: "revoked",
      activationLimit: 1,
      secondSiteActive: true,
    });
    const request = signedRequest(fixture, "/v1/license/activate", {
      site_id: fixture.siteId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/activate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("ACTIVATION_LIMIT_EXCEEDED");
  });
});
