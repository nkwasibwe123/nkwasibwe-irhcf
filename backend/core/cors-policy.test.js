"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_ALLOWED_ORIGINS, parseAllowedOrigins, createCorsOriginPolicy } = require("./cors-policy");

function check(policy, origin) {
  return new Promise((resolve, reject) => policy(origin, (error, allowed) => error ? reject(error) : resolve(allowed)));
}

test("CORS policy allows the deployed frontend and local development origins only by default", async () => {
  const policy = createCorsOriginPolicy({ env: {} });
  assert.equal(await check(policy, DEFAULT_ALLOWED_ORIGINS[0]), true);
  assert.equal(await check(policy, "http://localhost:3000"), true);
  assert.equal(await check(policy, "https://attacker.example"), false);
  assert.equal(await check(policy, "https://nkwasibwe-irhcf-web.onrender.com.evil.example"), false);
  assert.equal(await check(policy, undefined), true);
});

test("CORS origin allowlist can be explicitly configured and malformed entries fail closed", () => {
  const origins = parseAllowedOrigins({ IRHCF_CORS_ORIGINS: "https://app.example.test, javascript:alert(1), not-a-url" });
  assert.deepEqual([...origins], ["https://app.example.test"]);
});
