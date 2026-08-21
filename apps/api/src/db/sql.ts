export type SqlQueryResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rows: T[];
  rowCount: number;
};

export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlQueryResult<T>>;
  exec(text: string): Promise<void>;
  transact<T>(fn: (client: SqlClient) => Promise<T>): Promise<T>;
};

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}
