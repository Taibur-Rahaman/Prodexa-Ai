import { PGlite } from "@electric-sql/pglite";
import type { SqlClient, SqlQueryResult } from "../db/sql.js";

export function sqlClientFromPGlite(db: PGlite): SqlClient {
  const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlQueryResult<T>> => {
    const result = await db.query<T>(text, values ?? []);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };

  const exec = async (text: string): Promise<void> => {
    await db.exec(text);
  };

  const client = {} as SqlClient;
  client.query = query;
  client.exec = exec;
  client.transact = async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
    await db.exec("BEGIN");
    try {
      const result = await fn(client);
      await db.exec("COMMIT");
      return result;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  };
  return client;
}

let shared: { db: SqlClient; pglite: PGlite } | null = null;

export async function createTestDatabase(): Promise<{ db: SqlClient; close: () => Promise<void> }> {
  if (!shared) {
    const pglite = new PGlite();
    await pglite.query("SELECT 1");
    shared = {
      db: sqlClientFromPGlite(pglite),
      pglite,
    };
  }
  return {
    db: shared.db,
    close: async () => {
      // Keep the in-process PGlite instance so later files do not reload WASM.
    },
  };
}
