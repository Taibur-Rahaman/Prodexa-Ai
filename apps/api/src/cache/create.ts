import { Redis } from "ioredis";
import { NoopCacheStore } from "./noop.js";
import { RedisCacheStore, type RedisCommandClient } from "./redis-store.js";
import type { CacheHandle } from "./store.js";

function adapterFor(client: Redis): RedisCommandClient {
  return {
    get status() {
      return client.status;
    },
    connect: () => client.connect(),
    get: (key) => client.get(key),
    set: (key, value, expiryMode, ttlSeconds) => client.set(key, value, expiryMode, ttlSeconds),
    del: (...keys) => client.del(...keys),
    scan: (cursor, matchToken, pattern, countToken, count) =>
      client.scan(cursor, matchToken, pattern, countToken, count),
  };
}

/**
 * Production wiring: real Redis when REDIS_URL is set, otherwise no cache.
 * Never returns an in-memory Map as a production store.
 */
export function createCacheStore(redisUrl: string | null): CacheHandle {
  if (!redisUrl) {
    return {
      store: new NoopCacheStore(),
      close: async () => undefined,
    };
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 500,
    retryStrategy: () => null,
  });
  client.on("error", () => {
    // Fail open: CacheStore methods catch command errors. The listener
    // only prevents unhandled 'error' events from crashing the process.
  });

  return {
    store: new RedisCacheStore(adapterFor(client)),
    close: async () => {
      try {
        if (client.status === "wait") {
          client.disconnect();
          return;
        }
        await client.quit();
      } catch {
        client.disconnect();
      }
    },
  };
}
