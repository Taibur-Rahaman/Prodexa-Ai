import { describe, expect, it } from "vitest";
import { signSiteRequest, signaturesMatch, timestampIsFresh } from "./site-hmac.js";

describe("site HMAC", () => {
  const input = {
    method: "POST",
    path: "/v1/license/validate",
    timestamp: "1787310000",
    nonce: "nonce-1",
    body: '{"domain":"shop.example.com"}',
    siteId: "sit_11111111-1111-1111-1111-111111111111",
  };

  it("is deterministic and rejects a mutated body", () => {
    const secret = "site-secret";
    const signature = signSiteRequest(secret, input);
    expect(signature).toBe(
      "b8f94e065926dd54b18e1cde9d26134f3eb901a150110dd3f54462d4c102e680",
    );
    expect(signaturesMatch(signature, signSiteRequest(secret, input))).toBe(true);
    const mutated = signSiteRequest(secret, { ...input, body: '{"domain":"evil.example.com"}' });
    expect(signaturesMatch(signature, mutated)).toBe(false);
  });

  it("accepts timestamps inside the skew window only", () => {
    expect(timestampIsFresh("1787310000", 1787310000, 300)).toBe(true);
    expect(timestampIsFresh("1787310301", 1787310000, 300)).toBe(false);
    expect(timestampIsFresh("not-a-time", 1787310000, 300)).toBe(false);
  });
});
