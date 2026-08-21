import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, hashLicenseKey } from "./auth/secret-box.js";
import { signSiteRequest } from "./auth/site-hmac.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { migrate } from "./db/migrate.js";
import type { SqlClient } from "./db/sql.js";
import { createTestDatabase } from "./test/pglite.js";
import { SELECTION_TTL_MINUTES } from "./discovery/select.js";

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
    title?: string;
    availability?: string;
    expires_at?: string | null;
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
      $6, $7, $8, $9, $10, $11,
      '[]'::jsonb, $12, $13
    )
    `,
    [
      offer.offer_id,
      tenantId,
      "src_fixture",
      offer.source_url ?? "https://source.example/private/product",
      "ext-1",
      offer.title ?? "Selectable gift card",
      null,
      "https://example.com/image.jpg",
      1000,
      "BDT",
      offer.availability ?? "in_stock",
      "2026-08-21T00:00:00.000Z",
      offer.expires_at === undefined ? null : offer.expires_at,
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

function signedSelect(
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
      path: "/v1/discovery/select",
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

describe("POST /v1/discovery/select", () => {
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
      TRUNCATE TABLE
        discovery_selections,
        request_nonces,
        usage_counters,
        normalized_offers,
        site_activations,
        licenses,
        plans,
        tenants
      RESTART IDENTITY CASCADE
    `);
  });

  it("creates a customer-safe selection for a selectable tenant offer", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const offerId = "off_00000000-0000-4000-8000-000000000001";
    await seedOffer(fixture.tenantId, { offer_id: offerId });
    await seedOffer(fixture.otherTenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000099",
      source_url: "https://other-tenant.example/secret",
    });

    const request = signedSelect(fixture, {
      offer_id: offerId,
      selection_id: "sel_idempotency_key_1",
      tenant_id: fixture.otherTenantId,
    });
    const before = Date.now();
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: request.headers,
      payload: request.body,
    });
    const body = response.json() as Record<string, unknown>;
    const expiresAt = Date.parse(String(body.expires_at));

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      selection_id: "sel_idempotency_key_1",
      offer_id: offerId,
      expires_at: body.expires_at,
    });
    expect(Object.keys(body).sort()).toEqual(["expires_at", "offer_id", "selection_id"]);
    expect(expiresAt - before).toBeGreaterThan((SELECTION_TTL_MINUTES - 1) * 60 * 1000);
    expect(expiresAt - before).toBeLessThan((SELECTION_TTL_MINUTES + 1) * 60 * 1000);
    expect(JSON.stringify(body)).not.toMatch(/source_url|source_id|tenant_id|site_id|secret|private\/product/i);
    expect(JSON.stringify(body)).not.toContain(fixture.otherTenantId);
    expect(JSON.stringify(body)).not.toContain(fixture.tenantId);
    expect(JSON.stringify(body)).not.toContain(fixture.siteSecret);
  });

  it("ignores client-supplied price and does not return a price", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const offerId = "off_00000000-0000-4000-8000-000000000077";
    await seedOffer(fixture.tenantId, { offer_id: offerId });

    const request = signedSelect(fixture, {
      offer_id: offerId,
      selection_id: "sel_client_price_ignored_1",
      price: 1,
      display_price: 1,
      currency: "USD",
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: request.headers,
      payload: request.body,
    });
    const body = response.json() as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      selection_id: "sel_client_price_ignored_1",
      offer_id: offerId,
      expires_at: body.expires_at,
    });
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("display_price");
    expect(body).not.toHaveProperty("currency");
    expect(JSON.stringify(body)).not.toMatch(/"price"|"display_price"/);
  });

  it("does not select another tenant's offer", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const foreignOfferId = "off_00000000-0000-4000-8000-000000000099";
    await seedOffer(fixture.otherTenantId, { offer_id: foreignOfferId });

    const request = signedSelect(fixture, {
      offer_id: foreignOfferId,
      selection_id: "sel_cross_tenant_1",
      tenant_id: fixture.otherTenantId,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("OFFER_NOT_FOUND");
    expect(JSON.stringify(response.json())).not.toContain(fixture.otherTenantId);
    expect(JSON.stringify(response.json())).not.toMatch(/source_url|private\/product/i);

    const stored = await db.query("SELECT offer_id FROM discovery_selections");
    expect(stored.rows).toEqual([]);
  });

  it("returns 404 for a nonexistent offer", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const request = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000404",
      selection_id: "sel_missing_offer_1",
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("OFFER_NOT_FOUND");
  });

  it("rejects inactive and expired offers", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000010",
      availability: "out_of_stock",
    });
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000011",
      expires_at: "2020-01-01T00:00:00.000Z",
    });

    const inactive = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000010",
      selection_id: "sel_inactive_offer_1",
    });
    const inactiveResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: inactive.headers,
      payload: inactive.body,
    });
    expect(inactiveResponse.statusCode).toBe(422);
    expect(inactiveResponse.json().error.code).toBe("OFFER_NOT_SELECTABLE");

    const expired = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000011",
      selection_id: "sel_expired_offer_1",
    });
    const expiredResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: expired.headers,
      payload: expired.body,
    });
    expect(expiredResponse.statusCode).toBe(422);
    expect(expiredResponse.json().error.code).toBe("OFFER_NOT_SELECTABLE");
  });

  it("returns the existing active selection for an idempotent repeat", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const offerId = "off_00000000-0000-4000-8000-000000000021";
    await seedOffer(fixture.tenantId, { offer_id: offerId });
    const bodyObject = {
      offer_id: offerId,
      selection_id: "sel_repeatable_key_1",
    };

    const firstReq = signedSelect(fixture, bodyObject);
    const first = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: firstReq.headers,
      payload: firstReq.body,
    });
    const secondReq = signedSelect(fixture, bodyObject);
    const second = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: secondReq.headers,
      payload: secondReq.body,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    const count = await db.query<{ n: number | string }>(
      "SELECT COUNT(*)::int AS n FROM discovery_selections",
    );
    expect(Number(count.rows[0]?.n)).toBe(1);
  });

  it("returns 409 when selection_id is reused for a different offer", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000031",
    });
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000032",
    });

    const firstReq = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000031",
      selection_id: "sel_conflict_key_1",
    });
    const first = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: firstReq.headers,
      payload: firstReq.body,
    });
    expect(first.statusCode).toBe(200);

    const conflictReq = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000032",
      selection_id: "sel_conflict_key_1",
    });
    const conflict = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: conflictReq.headers,
      payload: conflictReq.body,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("SELECTION_CONFLICT");
  });

  it("returns 410 for an expired selection", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    const offerId = "off_00000000-0000-4000-8000-000000000041";
    await seedOffer(fixture.tenantId, { offer_id: offerId });
    await db.query(
      `
      INSERT INTO discovery_selections (
        selection_id, tenant_id, site_id, offer_id, offer_retrieved_at, created_at, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, now() - interval '20 minutes', now() - interval '5 minutes'
      )
      `,
      [
        "sel_expired_selection_1",
        fixture.tenantId,
        fixture.siteId,
        offerId,
        "2026-08-21T00:00:00.000Z",
      ],
    );

    const request = signedSelect(fixture, {
      offer_id: offerId,
      selection_id: "sel_expired_selection_1",
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(410);
    expect(response.json().error.code).toBe("SELECTION_EXPIRED");
  });

  it("rejects invalid input", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();

    const missing = signedSelect(fixture, { offer_id: "off_00000000-0000-4000-8000-000000000001" });
    const missingResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: missing.headers,
      payload: missing.body,
    });
    expect(missingResponse.statusCode).toBe(400);
    expect(missingResponse.json().error.code).toBe("VALIDATION_ERROR");

    const malformed = signedSelect(fixture, {
      offer_id: "not-an-offer",
      selection_id: "sel_idempotency_key_1",
    });
    const malformedResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: malformed.headers,
      payload: malformed.body,
    });
    expect(malformedResponse.statusCode).toBe(400);

    const shortKey = signedSelect(fixture, {
      offer_id: "off_00000000-0000-4000-8000-000000000001",
      selection_id: "short",
    });
    const shortResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: shortKey.headers,
      payload: shortKey.body,
    });
    expect(shortResponse.statusCode).toBe(400);
  });

  it("rejects missing and forged signatures", async () => {
    const app = await createLicensedApp();
    const fixture = await seed();
    await seedOffer(fixture.tenantId, {
      offer_id: "off_00000000-0000-4000-8000-000000000051",
    });

    const unsigned = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        offer_id: "off_00000000-0000-4000-8000-000000000051",
        selection_id: "sel_unauthenticated_1",
      }),
    });
    expect(unsigned.statusCode).toBe(401);
    expect(unsigned.json().error.code).toBe("UNAUTHENTICATED");

    const forged = signedSelect(
      fixture,
      {
        offer_id: "off_00000000-0000-4000-8000-000000000051",
        selection_id: "sel_forged_signature_1",
      },
      { signature: "ab".repeat(32) },
    );
    const forgedResponse = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: forged.headers,
      payload: forged.body,
    });
    expect(forgedResponse.statusCode).toBe(401);
    expect(forgedResponse.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 503 when the store is not configured", async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: "test", PORT: "8000" }));
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/discovery/select",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        offer_id: "off_00000000-0000-4000-8000-000000000051",
        selection_id: "sel_unauthenticated_1",
      }),
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("STORE_UNAVAILABLE");
  });
});
