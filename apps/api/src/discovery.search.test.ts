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
    searchUsed?: number;
    features?: Record<string, boolean>;
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
  const features = overrides.features ?? { "discovery.search": true };

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
      JSON.stringify(features),
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
      "2026-01-01T00:00:00.000Z",
      overrides.expiresAt === undefined ? "2027-01-01T00:00:00.000Z" : overrides.expiresAt,
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

async function seedOffer(
  tenantId: string,
  offer: {
    offer_id: string;
    title: string;
    description?: string | null;
    price?: number;
    currency?: string;
    source_url?: string;
  },
): Promise<void> {
  await db.query(
    `
    INSERT INTO normalized_offers (
      offer_id, tenant_id, source_id, source_url, external_product_id,
      title, description, image_url, price, currency, availability,
      variants, retrieved_at, expires_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, 'unknown',
      '[]'::jsonb, $11, NULL
    )
    `,
    [
      offer.offer_id,
      tenantId,
      "src_fixture",
      offer.source_url ?? "https://source.example/private/product",
      "ext-1",
      offer.title,
      offer.description === undefined ? null : offer.description,
      "https://example.com/image.jpg",
      offer.price ?? 1000,
      offer.currency ?? "BDT",
      "2026-08-21T00:00:00.000Z",
    ],
  );
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

function signedSearch(
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
      path: "/v1/discovery/search",
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

describe("POST /v1/discovery/search", () => {
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
      TRUNCATE TABLE request_nonces, usage_counters, normalized_offers, site_activations, licenses, plans, tenants
      RESTART IDENTITY CASCADE
    `);
  });

  it("returns matching tenant offers in the customer-safe contract", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000001",
      title: "Bata Gift Card Bangladesh",
    });
    await seedOffer(fixture.otherTenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000099",
      title: "Bata Gift Card Bangladesh",
      source_url: "https://other-tenant.example/secret",
    });

    const request = signedSearch(fixture, {
      query: "bata gift card bangladesh",
      page: 1,
      limit: 10,
      context: { country: "BD", currency: "BDT" },
      tenant_id: fixture.otherTenantId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: request.headers,
      payload: request.body,
    });
    const body = response.json() as {
      request_id: string;
      results: Array<Record<string, unknown>>;
      meta: { cached: boolean; count: number };
    };

    expect(response.statusCode).toBe(200);
    expect(body.request_id).toMatch(/^req_/);
    expect(body.meta).toEqual({ cached: false, count: 1 });
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      offer_id: "off_00000000-0000-4000-8000-000000000001",
      title: "Bata Gift Card Bangladesh",
      image_url: "https://example.com/image.jpg",
      display_price: 1000,
      currency: "BDT",
      availability: "unknown",
      freshness: { retrieved_at: "2026-08-21T00:00:00.000Z" },
    });
    expect(JSON.stringify(body)).not.toMatch(/source_url|source_id|secret|private\/product/i);
    expect(JSON.stringify(body)).not.toContain(fixture.otherTenantId);
    expect(JSON.stringify(body)).not.toContain(fixture.siteSecret);
  });

  it("returns an empty page when nothing matches", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000002",
      title: "Unrelated item",
    });
    const request = signedSearch(fixture, { query: "bata gift card" });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().results).toEqual([]);
    expect(response.json().meta).toEqual({ cached: false, count: 0 });
  });

  it("paginates matching offers in stable offer_id order", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000013",
      title: "Gift card C",
    });
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000011",
      title: "Gift card A",
    });
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000012",
      title: "Gift card B",
    });

    const page1Req = signedSearch(fixture, { query: "gift card", page: 1, limit: 2 });
    const page1 = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: page1Req.headers,
      payload: page1Req.body,
    });
    const page2Req = signedSearch(fixture, { query: "gift card", page: 2, limit: 2 });
    const page2 = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: page2Req.headers,
      payload: page2Req.body,
    });

    expect(page1.statusCode).toBe(200);
    expect(page2.statusCode).toBe(200);
    expect(page1.json().results.map((row: { offer_id: string }) => row.offer_id)).toEqual([
      "off_00000000-0000-4000-8000-000000000011",
      "off_00000000-0000-4000-8000-000000000012",
    ]);
    expect(page1.json().meta.count).toBe(2);
    expect(page2.json().results.map((row: { offer_id: string }) => row.offer_id)).toEqual([
      "off_00000000-0000-4000-8000-000000000013",
    ]);
    expect(page2.json().meta.count).toBe(1);
  });

  it("rejects invalid queries, pagination, and context", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();

    const missing = signedSearch(fixture, { page: 1 });
    const missingResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: missing.headers,
      payload: missing.body,
    });
    expect(missingResponse.statusCode).toBe(400);
    expect(missingResponse.json().error.code).toBe("VALIDATION_ERROR");

    const blank = signedSearch(fixture, { query: "   " });
    const blankResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: blank.headers,
      payload: blank.body,
    });
    expect(blankResponse.statusCode).toBe(400);

    const page = signedSearch(fixture, { query: "gift", page: 0 });
    const pageResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: page.headers,
      payload: page.body,
    });
    expect(pageResponse.statusCode).toBe(400);

    const limit = signedSearch(fixture, { query: "gift", limit: 21 });
    const limitResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: limit.headers,
      payload: limit.body,
    });
    expect(limitResponse.statusCode).toBe(400);

    const country = signedSearch(fixture, {
      query: "gift",
      context: { country: "Bangladesh" },
    });
    const countryResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: country.headers,
      payload: country.body,
    });
    expect(countryResponse.statusCode).toBe(400);
  });

  it("rejects missing, forged, and replayed signatures", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const unsigned = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ query: "gift" }),
    });
    expect(unsigned.statusCode).toBe(401);
    expect(unsigned.json().error.code).toBe("UNAUTHENTICATED");

    const forged = signedSearch(fixture, { query: "gift" }, { signature: "ab".repeat(32) });
    const forgedResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: forged.headers,
      payload: forged.body,
    });
    expect(forgedResponse.statusCode).toBe(401);

    const first = signedSearch(fixture, { query: "gift" }, { nonce: "search-replay-1" });
    const ok = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: first.headers,
      payload: first.body,
    });
    expect(ok.statusCode).toBe(200);
    const replay = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: first.headers,
      payload: first.body,
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe("AUTH_REPLAY");
  });

  it("enforces license, feature, and search quota before querying offers", async () => {
    const app = await createLicensedApp();

    const expired = await seed({ expiresAt: "2020-01-01T00:00:00.000Z" });
    const expiredReq = signedSearch(expired, { query: "gift" });
    const expiredResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: expiredReq.headers,
      payload: expiredReq.body,
    });
    expect(expiredResponse.statusCode).toBe(403);
    expect(expiredResponse.json().error.code).toBe("LICENSE_EXPIRED");

    const unentitled = await seed({ features: { "discovery.search": false } });
    const unentitledReq = signedSearch(unentitled, { query: "gift" });
    const unentitledResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: unentitledReq.headers,
      payload: unentitledReq.body,
    });
    expect(unentitledResponse.statusCode).toBe(403);
    expect(unentitledResponse.json().error.code).toBe("FEATURE_NOT_ENTITLED");

    const overQuota = await seed({ searchUsed: 10 });
    const overQuotaReq = signedSearch(overQuota, { query: "gift" });
    const overQuotaResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: overQuotaReq.headers,
      payload: overQuotaReq.body,
    });
    expect(overQuotaResponse.statusCode).toBe(403);
    expect(overQuotaResponse.json().error.code).toBe("USAGE_LIMIT_EXCEEDED");
  });

  it("treats query metacharacters as literals rather than SQL", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000021",
      title: "Ordinary gift card",
    });
    const request = signedSearch(fixture, { query: "' OR 1=1 --" });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().results).toEqual([]);
  });

  it("returns 503 when the store is not configured", async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: "test", PORT: "8000" }));
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/search",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ query: "gift" }),
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("STORE_UNAVAILABLE");
  });
});
