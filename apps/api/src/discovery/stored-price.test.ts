import { describe, expect, it } from "vitest";
import { parseStoredOfferPrice } from "./stored-price.js";

describe("parseStoredOfferPrice", () => {
  it("returns the stored amount with no markup or formula", () => {
    expect(parseStoredOfferPrice(777)).toBe(777);
    expect(parseStoredOfferPrice("777.50")).toBe(777.5);
    expect(parseStoredOfferPrice(0)).toBe(0);
  });

  it("rejects negative and non-finite values", () => {
    expect(() => parseStoredOfferPrice(-1)).toThrow("invalid_offer_price");
    expect(() => parseStoredOfferPrice(Number.NaN)).toThrow("invalid_offer_price");
    expect(() => parseStoredOfferPrice("not-a-price")).toThrow("invalid_offer_price");
  });
});
