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


test("start returns the persisted lifecycle ID while long-running research continues", async () => {
  const rows = new Map();
  let finishResearch;
  const researchGate = new Promise(resolve => { finishResearch = resolve; });
  const pool = { async query(sql, params = []) {
    if (sql.includes("INSERT INTO capability_lifecycle_runs")) {
      rows.set(params[0], JSON.parse(params[5]));
      return { rows: [{ id: params[0] }] };
    }
    if (sql.includes("UPDATE capability_lifecycle_runs")) {
      rows.set(params[0], JSON.parse(params[5]));
      return { rows: [{ id: params[0] }] };
    }
    if (sql.includes("SELECT record FROM capability_lifecycle_runs")) {
      return { rows: rows.has(params[0]) ? [{ record: rows.get(params[0]) }] : [] };
    }
    return { rows: [] };
  }};
  const runtime = createCapabilityLifecycleRuntime({
    pool,
    adapters: { research: async () => researchGate }
  });
  const started = await runtime.start({
    capability: "new_feature",
    goal: "Research and build a capability",
    ownerUserId: 42
  });
  assert.ok(started.record.id);
  assert.equal(started.record.status, "running");
  assert.equal((await runtime.store.get(started.record.id)).id, started.record.id);
  finishResearch({ passed: false, sources: [] });
  const finalRecord = await started.completion;
  assert.equal(finalRecord.status, "blocked");
  assert.equal(finalRecord.stage, "research");
});
