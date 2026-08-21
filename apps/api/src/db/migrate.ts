import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SqlClient } from "./sql.js";
import { splitSqlStatements } from "./sql.js";

const migrationsDir = fileURLToPath(new URL("../../migrations", import.meta.url));

export async function migrate(db: SqlClient): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const applied = await db.query<{ id: string }>(
      "SELECT id FROM schema_migrations WHERE id = $1",
      [id],
    );
    if (applied.rowCount > 0) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    for (const statement of splitSqlStatements(sql)) {
      await db.exec(statement);
    }
    await db.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
  }
}
