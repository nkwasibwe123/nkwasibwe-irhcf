"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getRunnerConfig,
  runIsolatedCommand,
  ALLOWED_COMMANDS,
  MAX_TIMEOUT_MS
} = require("./sandbox-runner");

const files = [{ name: "index.js", content: "console.log('isolated');" }];
const configuredEnv = {
  NODE_ENV: "production",
  IRHCF_SANDBOX_RUNNER_URL: "https://sandbox.example.test",
  IRHCF_SANDBOX_RUNNER_TOKEN: "test-token"
};

test("runner fails closed when not configured", async () => {
  await assert.rejects(
    runIsolatedCommand({ files, command: "node --test", env: {}, fetchImpl: async () => { throw new Error("must not call fetch"); } }),
    error => error.code === "SANDBOX_RUNNER_NOT_CONFIGURED"
  );
});

test("runner requires HTTPS outside local development", () => {
  assert.throws(
    () => getRunnerConfig({ NODE_ENV: "production", IRHCF_SANDBOX_RUNNER_URL: "http://sandbox.example.test", IRHCF_SANDBOX_RUNNER_TOKEN: "x" }),
    error => error.code === "SANDBOX_RUNNER_HTTPS_REQUIRED"
  );
});

test("runner rejects commands outside the allowlist", async () => {
  await assert.rejects(
    runIsolatedCommand({ files, command: "sh -c rm -rf /", env: configuredEnv, fetchImpl: async () => { throw new Error("must not call fetch"); } }),
    error => error.code === "SANDBOX_COMMAND_NOT_ALLOWED"
  );
});

test("runner sends bounded requests and returns an explicitly unverified result", async () => {
  let request;
  const result = await runIsolatedCommand({
    files,
    command: "node --test",
    timeoutMs: MAX_TIMEOUT_MS * 10,
    env: configuredEnv,
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          protocolVersion: 1, passed: true, exitCode: 0,
          stdout: "ok", stderr: "", durationMs: 10,
          isolation: "microvm", runnerId: "test-runner"
        })
      };
    }
  });

  assert.equal(request.url, "https://sandbox.example.test/v1/execute");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.authorization, "Bearer test-token");
  assert.equal(request.body.timeoutMs, MAX_TIMEOUT_MS);
  assert.deepEqual(request.body.files, files);
  assert.equal(result.passed, true);
  assert.equal(result.isolation, "microvm");
  assert.equal(result.verification.isolationVerifiedByClient, false);
});

test("runner rejects malformed responses and oversized output", async () => {
  await assert.rejects(
    runIsolatedCommand({
      files, command: ALLOWED_COMMANDS[0], env: configuredEnv,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{}" })
    }),
    error => error.code === "SANDBOX_RUNNER_INVALID_RESPONSE"
  );

  await assert.rejects(
    runIsolatedCommand({
      files, command: ALLOWED_COMMANDS[0], env: configuredEnv,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "x".repeat(1024 * 1024 + 1) })
    }),
    error => error.code === "SANDBOX_RUNNER_RESPONSE_TOO_LARGE"
  );
});
