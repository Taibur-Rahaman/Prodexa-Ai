import { describe, expect, it, vi } from "vitest";
import { RedisCacheStore, type RedisCommandClient } from "./redis-store.js";

function throwingClient(): RedisCommandClient {
  return {
    get: async () => {
      throw new Error("ECONNREFUSED");
    },
    set: async () => {
      throw new Error("ECONNREFUSED");
    },
    del: async () => {
      throw new Error("ECONNREFUSED");
    },
    scan: async () => {
      throw new Error("ECONNREFUSED");
    },
  };
}

describe("RedisCacheStore", () => {
  it("round-trips values through a Redis command client", async () => {
    const data = new Map<string, string>();
    const client: RedisCommandClient = {
      status: "ready",
      get: async (key) => data.get(key) ?? null,
      set: async (key, value) => {
        data.set(key, value);
        return "OK";
      },
      del: async (...keys) => {
        let removed = 0;
        for (const key of keys) {
          if (data.delete(key)) {
            removed += 1;
          }
        }
        return removed;
      },
      scan: async () => ["0", [...data.keys()]],
    };
    const store = new RedisCacheStore(client, 0);
    await store.set("prodexa:v1:a", "value", 30);
    expect(await store.get("prodexa:v1:a")).toBe("value");
    expect(await store.keysByPrefix("prodexa:v1:")).toEqual(["prodexa:v1:a"]);
    await store.del(["prodexa:v1:a"]);
    expect(await store.get("prodexa:v1:a")).toBeNull();
  });

  it("treats Redis errors as misses and does not throw", async () => {
    const store = new RedisCacheStore(throwingClient(), 0);
    await expect(store.get("k")).resolves.toBeNull();
    await expect(store.set("k", "v", 10)).resolves.toBeUndefined();
    await expect(store.del(["k"])).resolves.toBeUndefined();
    await expect(store.keysByPrefix("k")).resolves.toEqual([]);
  });

  it("cools down after a failure so later reads fail open without retrying immediately", async () => {
    const get = vi.fn(async () => {
      throw new Error("down");
    });
    const store = new RedisCacheStore(
      {
        get,
        set: async () => "OK",
        del: async () => 0,
        scan: async () => ["0", []],
      },
      60_000,
    );
    expect(await store.get("k")).toBeNull();
    expect(await store.get("k")).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
