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
  const result = await runtime.run({ capability: "new_feature", goal: "Research and build a capability" });
  assert.equal(result.status, "failed");
  assert.match(result.error, /research/);
});
