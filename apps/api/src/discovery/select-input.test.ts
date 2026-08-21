import { describe, expect, it } from "vitest";
import { parseSelectBody } from "./select.js";
import { ApiError } from "../http/errors.js";

describe("parseSelectBody", () => {
  it("accepts a valid offer_id and selection_id and ignores tenant_id", () => {
    expect(
      parseSelectBody({
        offer_id: "off_00000000-0000-4000-8000-000000000001",
        selection_id: "sel_idempotency_key_1",
        tenant_id: "should-be-ignored",
      }),
    ).toEqual({
      offerId: "off_00000000-0000-4000-8000-000000000001",
      selectionId: "sel_idempotency_key_1",
    });
  });

  it("rejects missing, blank, and malformed identifiers", () => {
    const invalid: unknown[] = [
      null,
      [],
      { selection_id: "sel_idempotency_key_1" },
      { offer_id: "off_00000000-0000-4000-8000-000000000001" },
      { offer_id: "   ", selection_id: "sel_idempotency_key_1" },
      { offer_id: "off_00000000-0000-4000-8000-000000000001", selection_id: "short" },
      { offer_id: "offer-1", selection_id: "sel_idempotency_key_1" },
      { offer_id: "off_00000000-0000-4000-8000-000000000001", selection_id: "sel has space" },
      { offer_id: 1, selection_id: "sel_idempotency_key_1" },
    ];
    for (const body of invalid) {
      expect(() => parseSelectBody(body)).toThrow(ApiError);
    }
  });
});
