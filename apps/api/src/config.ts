export type AppConfig = {
  env: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  databaseUrl: string | null;
  apiSigningSecret: string | null;
  authTimestampSkewSeconds: number;
  validateRateLimitPerMinute: number;
};

function readEnv(name: string, env: NodeJS.ProcessEnv, fallback: string): string {
  const value = env[name];
  return value && value.length > 0 ? value : fallback;
}

function readOptional(name: string, env: NodeJS.ProcessEnv): string | null {
  const value = env[name];
  return value && value.length > 0 ? value : null;
}

function readPositiveInt(name: string, env: NodeJS.ProcessEnv, fallback: number): number {
  const raw = env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawEnv = env.APP_ENV ?? env.NODE_ENV ?? "development";
  const envName =
    rawEnv === "production" || rawEnv === "test" || rawEnv === "development"
      ? rawEnv
      : "development";

  const port = Number.parseInt(env.PORT ?? "8000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    env: envName,
    host: readEnv("HOST", env, "0.0.0.0"),
    port,
    logLevel:
      env.LOG_LEVEL === "fatal" ||
      env.LOG_LEVEL === "error" ||
      env.LOG_LEVEL === "warn" ||
      env.LOG_LEVEL === "debug" ||
      env.LOG_LEVEL === "trace"
        ? env.LOG_LEVEL
        : "info",
    databaseUrl: readOptional("DATABASE_URL", env),
    apiSigningSecret: readOptional("API_SIGNING_SECRET", env),
    authTimestampSkewSeconds: readPositiveInt("AUTH_TIMESTAMP_SKEW_SECONDS", env, 300),
    validateRateLimitPerMinute: readPositiveInt("VALIDATE_RATE_LIMIT_PER_MINUTE", env, 60),
  };
}
