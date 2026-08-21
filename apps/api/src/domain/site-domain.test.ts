import { describe, expect, it } from "vitest";
import { normalizeDomain } from "./site-domain.js";

describe("normalizeDomain", () => {
  it("normalizes scheme, case, port, slash, and www", () => {
    expect(normalizeDomain("https://WWW.Shop.Example.COM:443/path")).toBe("shop.example.com");
    expect(normalizeDomain("shop.example.com.")).toBe("shop.example.com");
    expect(normalizeDomain("localhost")).toBe("localhost");
  });

  it("rejects empty, ipv6, and malformed hosts", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("[::1]")).toBeNull();
  });
});
