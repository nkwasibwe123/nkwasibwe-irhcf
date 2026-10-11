"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const TOKEN = "test-only-runner-token";
let child;
let baseUrl;
let startupError = "";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

before(async () => {
  const port = await unusedPort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: String(port), IRHCF_SANDBOX_RUNNER_TOKEN: TOKEN, NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.stderr.on("data", chunk => { startupError += chunk.toString("utf8").slice(0, 2000); });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(baseUrl + "/health");
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) {
    child.kill("SIGTERM");
    throw new Error("Runner did not start. " + startupError);
  }
});

after(() => {
  if (child && child.exitCode === null) child.kill("SIGTERM");
});

test("health endpoint reports runner identity without exposing secrets", async () => {
  const response = await fetch(baseUrl + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, runner: "irhcf-sandbox-runner" });
});

test("execution endpoint rejects missing credentials", async () => {
  const response = await fetch(baseUrl + "/v1/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ protocolVersion: 1, command: "node --test", files: [{ name: "test.js", content: "" }] })
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("execution endpoint rejects commands outside the strict allowlist before Docker is invoked", async () => {
  const response = await fetch(baseUrl + "/v1/execute", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + TOKEN },
    body: JSON.stringify({ protocolVersion: 1, command: "sh -c 'echo unsafe'", files: [{ name: "test.js", content: "" }] })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.passed, false);
  assert.match(body.stderr, /Invalid protocol or command/);
  assert.equal(body.isolation, "unverified");
});
