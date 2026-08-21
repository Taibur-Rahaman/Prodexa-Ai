import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashLicenseKey } from "./secret-box.js";

describe("secret box", () => {
  it("round-trips a site secret and does not store plaintext", () => {
    const master = "test-master-secret";
    const secret = "site-plain-secret";
    const encrypted = encryptSecret(secret, master);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, master)).toBe(secret);
    expect(() => decryptSecret(encrypted, "other-master")).toThrow();
  });

  it("peppers license keys so the raw key is not the stored value", () => {
    const hashed = hashLicenseKey("lic_test_key", "master");
    expect(hashed).not.toContain("lic_test_key");
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });
});
