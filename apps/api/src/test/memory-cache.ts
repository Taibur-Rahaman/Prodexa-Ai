import type { CacheStore } from "../cache/store.js";

/**
 * In-memory CacheStore test double. Not used on the production path.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: this.now() + Math.max(1, ttlSeconds) * 1000,
    });
  }

  async del(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.entries.delete(key);
    }
  }

  async keysByPrefix(prefix: string): Promise<string[]> {
    return [...this.entries.keys()].filter((key) => key.startsWith(prefix));
  }

  snapshot(): Map<string, string> {
    const now = this.now();
    const values = new Map<string, string>();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt > now) {
        values.set(key, entry.value);
      }
    }
    return values;
  }
}
