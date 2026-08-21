/**
 * Application cache port. Business logic must depend on this interface,
 * never on ioredis or another Redis client.
 */
export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(keys: string[]): Promise<void>;
  keysByPrefix(prefix: string): Promise<string[]>;
};

export type CacheHandle = {
  store: CacheStore;
  close: () => Promise<void>;
};
