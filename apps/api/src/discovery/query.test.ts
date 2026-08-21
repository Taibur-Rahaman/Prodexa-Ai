import { describe, expect, it } from "vitest";
import { tokenizeSearchQuery } from "./query.js";

describe("tokenizeSearchQuery", () => {
  it("splits on whitespace and drops empty tokens", () => {
    expect(tokenizeSearchQuery("  bata   gift card  ")).toEqual(["bata", "gift", "card"]);
  });
});
