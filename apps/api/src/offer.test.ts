import { describe, expect, it } from "vitest";
import { isNormalizedOffer, type NormalizedOffer } from "./domain/offer.js";

const valid: NormalizedOffer = {
  source_id: "src_demo",
  source_url: "https://example.com/product/1",
  external_product_id: "sku-1",
  title: "Example product",
  description: null,
  image_url: "https://example.com/image.jpg",
  price: 1000,
  currency: "BDT",
  availability: "unknown",
  variants: [],
  retrieved_at: "2026-08-21T00:00:00.000Z",
  expires_at: null,
};

describe("normalized offer schema", () => {
  it("accepts a complete canonical offer", () => {
    expect(isNormalizedOffer(valid)).toBe(true);
  });

  it("rejects missing source identity, negative prices, and invalid currency", () => {
    expect(isNormalizedOffer({ ...valid, source_id: "" })).toBe(false);
    expect(isNormalizedOffer({ ...valid, price: -1 })).toBe(false);
    expect(isNormalizedOffer({ ...valid, currency: "TAKA" })).toBe(false);
    expect(isNormalizedOffer({ ...valid, availability: "maybe" })).toBe(false);
  });
});
