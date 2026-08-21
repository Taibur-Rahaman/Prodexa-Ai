import { loadConfig } from "../config.js";
import { migrate } from "./migrate.js";
import { createPool, sqlClientFromPool } from "./postgres.js";

const config = loadConfig();
if (!config.databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const pool = createPool(config.databaseUrl);
try {
  await migrate(sqlClientFromPool(pool));
} finally {
  await pool.end();
}
