import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const INFO = "prodexa-site-secret-v1";
const SALT = "prodexa-api";

function wrappingKey(masterSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterSecret, SALT, INFO, 32));
}

export function encryptSecret(plaintext: string, masterSecret: string): string {
  const key = wrappingKey(masterSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payload: string, masterSecret: string): string {
  const raw = Buffer.from(payload, "base64");
  if (raw.length < 29) {
    throw new Error("invalid_secret_payload");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = wrappingKey(masterSecret);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hashLicenseKey(licenseKey: string, masterSecret: string): string {
  return createHmac("sha256", masterSecret).update(licenseKey, "utf8").digest("hex");
}
