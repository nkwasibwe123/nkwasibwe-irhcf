"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCapabilityLifecycleRuntime } = require("./capability-lifecycle-runtime");

test("runtime binds PostgreSQL store and blocks when research adapter is absent", async () => {
  const rows = new Map();
  const pool = { async query(sql, params = []) {
    if (sql.includes("INSERT INTO capability_lifecycle_runs")) { rows.set(params[0], JSON.parse(params[5])); return { rows: [{ id: params[0] }] }; }
    if (sql.includes("UPDATE capability_lifecycle_runs")) { rows.set(params[0], JSON.parse(params[5])); return { rows: [{ id: params[0] }] }; }
    return { rows: [] };
  }};
  const runtime = createCapabilityLifecycleRuntime({ pool, adapters: {} });
  await assert.rejects(runtime.run({ capability: "new_feature", goal: "Research and build a capability" }), error => {
    assert.match(error.message, /research/);
    assert.equal(error.lifecycleRecord.status, "failed");
    assert.equal(error.lifecycleRecord.stage, "research");
    return true;
  });
});
