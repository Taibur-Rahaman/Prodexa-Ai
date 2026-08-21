import type { CacheStore } from "./store.js";

/** Used when REDIS_URL is unset. Every read is a miss; writes are ignored. */
export class NoopCacheStore implements CacheStore {
  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string, _ttlSeconds: number): Promise<void> {}

  async del(_keys: string[]): Promise<void> {}

  async keysByPrefix(_prefix: string): Promise<string[]> {
    return [];
  }
}
