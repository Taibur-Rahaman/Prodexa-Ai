import type { CacheStore } from "./store.js";

export type RedisCommandClient = {
  status?: string;
  connect?: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, expiryMode: "EX", ttlSeconds: number) => Promise<unknown>;
  del: (...keys: string[]) => Promise<number>;
  scan: (
    cursor: string | number,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: number,
  ) => Promise<[string, string[]]>;
};

const DEFAULT_COOLDOWN_MS = 5_000;

/**
 * Production CacheStore when REDIS_URL is set. Redis failures become cache misses.
 * This is a real Redis client adapter — not an in-memory stand-in.
 */
export class RedisCacheStore implements CacheStore {
  private downUntil = 0;

  constructor(
    private readonly client: RedisCommandClient,
    private readonly cooldownMs: number = DEFAULT_COOLDOWN_MS,
  ) {}

  async get(key: string): Promise<string | null> {
    return this.withRedis(null, async () => this.client.get(key));
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    await this.withRedis(undefined, async () => {
      await this.client.set(key, value, "EX", ttl);
    });
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.withRedis(undefined, async () => {
      await this.client.del(...keys);
    });
  }

  async keysByPrefix(prefix: string): Promise<string[]> {
    return this.withRedis([], async () => {
      const keys: string[] = [];
      let cursor: string | number = "0";
      do {
        const [next, batch] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = next;
        keys.push(...batch);
      } while (String(cursor) !== "0");
      return keys;
    });
  }

  private markDown(): void {
    this.downUntil = Date.now() + this.cooldownMs;
  }

  private async withRedis<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
    if (Date.now() < this.downUntil) {
      return fallback;
    }
    try {
      if (this.client.status && this.client.status !== "ready" && this.client.status !== "wait") {
        this.markDown();
        return fallback;
      }
      if (this.client.status === "wait" && this.client.connect) {
        await this.client.connect();
      }
      if (this.client.status && this.client.status !== "ready") {
        this.markDown();
        return fallback;
      }
      return await fn();
    } catch {
      this.markDown();
      return fallback;
    }
  }
}
