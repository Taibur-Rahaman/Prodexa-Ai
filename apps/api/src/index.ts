import { buildApp } from "./app.js";
import { createCacheStore } from "./cache/create.js";
import { loadConfig } from "./config.js";
import { migrate } from "./db/migrate.js";
import { createPool, sqlClientFromPool } from "./db/postgres.js";

const config = loadConfig();
const pool = config.databaseUrl ? createPool(config.databaseUrl) : null;
const db = pool ? sqlClientFromPool(pool) : null;
const cache = createCacheStore(config.redisUrl);

if (db) {
  await migrate(db);
}

const app = await buildApp(config, { db, cache: cache.store });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, "failed_to_start");
  process.exit(1);
}
