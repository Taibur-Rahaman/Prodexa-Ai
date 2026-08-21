export type AppConfig = {
  env: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
};

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
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
    host: readEnv("HOST", "0.0.0.0"),
    port,
    logLevel:
      env.LOG_LEVEL === "fatal" ||
      env.LOG_LEVEL === "error" ||
      env.LOG_LEVEL === "warn" ||
      env.LOG_LEVEL === "debug" ||
      env.LOG_LEVEL === "trace"
        ? env.LOG_LEVEL
        : "info",
  };
}
