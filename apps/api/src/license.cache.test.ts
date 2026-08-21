import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, hashLicenseKey } from "./auth/secret-box.js";
import { signSiteRequest } from "./auth/site-hmac.js";
import { buildApp } from "./app.js";
import { RedisCacheStore, type RedisCommandClient } from "./cache/redis-store.js";
import { loadConfig } from "./config.js";
import { migrate } from "./db/migrate.js";
import type { SqlClient } from "./db/sql.js";
import { createTestDatabase } from "./test/pglite.js";
import { MemoryCacheStore } from "./test/memory-cache.js";

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
  licenseId: string;
  siteId: string;
  siteSecret: string;
};

async function seed(): Promise<Fixture> {
  const tenantId = randomUUID();
  const planId = randomUUID();
  const licenseId = randomUUID();
  const activationId = randomUUID();
  const siteId = `sit_${randomUUID()}`;
  const siteSecret = randomBytes(32).toString("hex");

  await db.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [tenantId, "Tenant A"]);
  await db.query(
    `
    INSERT INTO plans (id, code, name, max_activations, features, usage_limits)
    VALUES ($1, $2, $3, 1, $4::jsonb, $5::jsonb)
    `,
    [
      planId,
      `pilot-${planId.slice(0, 8)}`,
      "Pilot",
      JSON.stringify({ "discovery.search": true }),
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
      "active",
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
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
      "shop.example.com",
      encryptSecret(siteSecret, MASTER),
      "active",
    ],
  );

  return { tenantId, licenseId, siteId, siteSecret };
}

function countingSql(
  client: SqlClient,
  counts: { usage: number; activations: number },
): SqlClient {
  const wrap = (inner: SqlClient): SqlClient => ({
    async query(text, values) {
      if (/\bFROM usage_counters\b/i.test(text)) {
        counts.usage += 1;
      }
      if (/\bFROM site_activations\b/i.test(text) && /status = 'active'/i.test(text)) {
        counts.activations += 1;
      }
      return inner.query(text, values);
    },
    exec: (text) => inner.exec(text),
    transact: (fn) => inner.transact((tx) => fn(wrap(tx))),
  });
  return wrap(client);
}

function signedRequest(fixture: Fixture, nonce?: string) {
  const body = JSON.stringify({ domain: "shop.example.com" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const usedNonce = nonce ?? randomUUID();
  const signature = signSiteRequest(fixture.siteSecret, {
    method: "POST",
    path: "/v1/license/validate",
    timestamp,
    nonce: usedNonce,
    body,
    siteId: fixture.siteId,
  });
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-prodexa-site-id": fixture.siteId,
      "x-prodexa-timestamp": timestamp,
      "x-prodexa-nonce": usedNonce,
      "x-prodexa-signature": signature,
      "x-request-id": `req_${randomUUID()}`,
    },
  };
}

describe("license validation Redis cache strategy", () => {
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

  it("misses then hits, skipping usage and activation queries on hit", async () => {
    const counts = { usage: 0, activations: 0 };
    const cache = new MemoryCacheStore();
    const app = await buildApp(
      loadConfig({ NODE_ENV: "test", PORT: "8000", API_SIGNING_SECRET: MASTER }),
      { db: countingSql(db, counts), cache },
    );
    apps.push(app);
    const fixture = await seed();

    const first = signedRequest(fixture);
    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: first.headers,
      payload: first.body,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(counts.usage).toBe(1);
    expect(counts.activations).toBe(1);
    expect(cache.snapshot().size).toBe(1);
    expect(JSON.stringify([...cache.snapshot().values()])).not.toContain(fixture.siteSecret);

    const second = signedRequest(fixture);
    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: second.headers,
      payload: second.body,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json().tenant_id).toBe(fixture.tenantId);
    expect(counts.usage).toBe(1);
    expect(counts.activations).toBe(1);
  });

  it("still validates from PostgreSQL when Redis is unavailable", async () => {
    const down: RedisCommandClient = {
      get: async () => {
        throw new Error("ECONNREFUSED");
      },
      set: async () => {
        throw new Error("ECONNREFUSED");
      },
      del: async () => {
        throw new Error("ECONNREFUSED");
      },
      scan: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const app = await buildApp(
      loadConfig({ NODE_ENV: "test", PORT: "8000", API_SIGNING_SECRET: MASTER }),
      { db, cache: new RedisCacheStore(down, 0) },
    );
    apps.push(app);
    const fixture = await seed();
    const request = signedRequest(fixture);
    const response = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: request.headers,
      payload: request.body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().valid).toBe(true);
  });

  it("does not let a cached grant override a revoked license row", async () => {
    const cache = new MemoryCacheStore();
    const app = await buildApp(
      loadConfig({ NODE_ENV: "test", PORT: "8000", API_SIGNING_SECRET: MASTER }),
      { db, cache },
    );
    apps.push(app);
    const fixture = await seed();

    const first = signedRequest(fixture);
    const ok = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: first.headers,
      payload: first.body,
    });
    expect(ok.statusCode).toBe(200);

    await db.query("UPDATE licenses SET status = $1 WHERE id = $2", [
      "revoked",
      fixture.licenseId,
    ]);

    const second = signedRequest(fixture);
    const denied = await app.inject({
      method: "POST",
      url: "/v1/license/validate",
      headers: second.headers,
      payload: second.body,
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("LICENSE_REVOKED");
  });
});
