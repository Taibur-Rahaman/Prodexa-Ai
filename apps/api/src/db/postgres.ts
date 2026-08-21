import pg from "pg";
import type { SqlClient, SqlQueryResult } from "./sql.js";

const { Pool } = pg;

export function createPool(databaseUrl: string): pg.Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 10,
  });
}

function clientFromQueryable(queryable: pg.Pool | pg.PoolClient): Omit<SqlClient, "transact"> {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<SqlQueryResult<T>> {
      const result = await queryable.query<T>(text, values);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    async exec(text: string): Promise<void> {
      await queryable.query(text);
    },
  };
}

export function sqlClientFromPool(pool: pg.Pool): SqlClient {
  const base = clientFromQueryable(pool);
  return {
    ...base,
    async transact<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
      const conn = await pool.connect();
      const inner = clientFromQueryable(conn);
      const tx: SqlClient = {
        ...inner,
        transact: (nested) => nested(tx),
      };
      try {
        await conn.query("BEGIN");
        const result = await fn(tx);
        await conn.query("COMMIT");
        return result;
      } catch (error) {
        await conn.query("ROLLBACK");
        throw error;
      } finally {
        conn.release();
      }
    },
  };
}
