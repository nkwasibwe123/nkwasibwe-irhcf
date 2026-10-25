"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encryptJson, decryptJson } = require("./secure-credentials");

test("credential encryption round-trips JSON and rejects tampering or missing keys", () => {
  const previous = process.env.IRHCF_CREDENTIALS_KEY;
  try {
    process.env.IRHCF_CREDENTIALS_KEY = "test-only-key-with-enough-entropy";
    const original = { accessToken: "secret-token", nested: { scope: ["profile", "email"] } };
    const encrypted = encryptJson(original);

    assert.equal(typeof encrypted, "string");
    assert.equal(encrypted.split(".").length, 3);
    assert.deepEqual(decryptJson(encrypted), original);
    assert.notEqual(encrypted, JSON.stringify(original));
    assert.doesNotMatch(encrypted, /secret-token/);

    const parts = encrypted.split(".");
    const ciphertext = parts[2];
    const replacement = ciphertext[0] === "A" ? "B" : "A";
    parts[2] = replacement + ciphertext.slice(1);
    assert.throws(() => decryptJson(parts.join(".")), /Unsupported state|authenticate|unable to/i);

    assert.throws(() => decryptJson("not-an-encrypted-payload"), /Invalid encrypted credential payload/);

    delete process.env.IRHCF_CREDENTIALS_KEY;
    assert.throws(
      () => encryptJson({ accessToken: "must-not-be-stored-plaintext" }),
      error => error && error.code === "CREDENTIAL_KEY_MISSING"
    );
    assert.throws(
      () => decryptJson(encrypted),
      error => error && error.code === "CREDENTIAL_KEY_MISSING"
    );
  } finally {
    if (previous === undefined) delete process.env.IRHCF_CREDENTIALS_KEY;
    else process.env.IRHCF_CREDENTIALS_KEY = previous;
  }
});
