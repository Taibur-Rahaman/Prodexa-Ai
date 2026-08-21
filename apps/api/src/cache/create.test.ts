import { afterEach, describe, expect, it } from "vitest";
import { createCacheStore } from "./create.js";
import { NoopCacheStore } from "./noop.js";
import { RedisCacheStore } from "./redis-store.js";

const handles: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) {
      await handle.close();
    }
  }
});

describe("createCacheStore", () => {
  it("uses a no-op store when REDIS_URL is unset", async () => {
    const handle = createCacheStore(null);
    handles.push(handle);
    expect(handle.store).toBeInstanceOf(NoopCacheStore);
    await expect(handle.store.get("any")).resolves.toBeNull();
  });

  it("uses a real Redis client adapter when REDIS_URL is set", () => {
    const handle = createCacheStore("redis://127.0.0.1:6379");
    handles.push(handle);
    expect(handle.store).toBeInstanceOf(RedisCacheStore);
    expect(handle.store).not.toBeInstanceOf(NoopCacheStore);
  });

  it("does not throw while constructing a Redis store for an unreachable URL", async () => {
    const handle = createCacheStore("redis://127.0.0.1:1");
    handles.push(handle);
    await expect(handle.store.get("prodexa:v1:license:validate:x")).resolves.toBeNull();
  });
});
