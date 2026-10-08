"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const raw = process.env.IRHCF_CREDENTIALS_KEY || "";
  if (!raw) {
    const error = new Error("IRHCF_CREDENTIALS_KEY is not configured.");
    error.code = "CREDENTIAL_KEY_MISSING";
    throw error;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

function decryptJson(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted credential payload.");

  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const ciphertext = Buffer.from(parts[2], "base64url");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = { encryptJson, decryptJson };
