"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createIsolatedTestAdapter } = require("./isolated-capability-checks");

test("sends workspace file content to isolated runner and requires zero exit", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "irhcf-adapter-test-"));
  try {
    await fs.writeFile(path.join(root, "index.test.js"), "test('ok',()=>{});");
    let request;
    const run = createIsolatedTestAdapter({ runner: async value => {
      request = value; return { passed: true, exitCode: 0, timedOut: false, isolation: "hardened_container" };
    }});
    const result = await run({ root, files: ["index.test.js"] });
    assert.equal(result.passed, true);
    assert.equal(request.files[0].content, "test('ok',()=>{});");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("never reports pass when runner is missing or fails", async () => {
  const run = createIsolatedTestAdapter({ runner: async () => { throw Object.assign(new Error("offline"), { code: "SANDBOX_RUNNER_NOT_CONFIGURED" }); } });
  const result = await run({ root: "/tmp", files: ["x.js"] });
  assert.equal(result.passed, false);
  assert.equal(result.code, "SANDBOX_RUNNER_NOT_CONFIGURED");
});

test("rejects unsafe filenames before invoking remote runner", async () => {
  let called = false;
  const run = createIsolatedTestAdapter({ runner: async () => { called = true; return { passed: true, exitCode: 0 }; } });
  const result = await run({ root: "/tmp", files: ["../escape.js"] });
  assert.equal(result.passed, false);
  assert.equal(called, false);
});
