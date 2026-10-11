"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPostgresLifecycleStore } = require("./postgres-lifecycle-store");

function fakePool() {
  const rows = new Map(); const queries = [];
  return {
    rows, queries,
    async query(sql, params = []) {
      queries.push(sql);
      if (sql.includes("INSERT INTO capability_lifecycle_runs")) {
        rows.set(params[0], JSON.parse(params[5]));
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes("UPDATE capability_lifecycle_runs")) {
        if (!rows.has(params[0])) return { rows: [] };
        rows.set(params[0], JSON.parse(params[5]));
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes("SELECT record FROM capability_lifecycle_runs WHERE id=")) return { rows: rows.has(params[0]) ? [{ record: rows.get(params[0]) }] : [] };
      if (sql.includes("SELECT record FROM capability_lifecycle_runs WHERE status=")) return { rows: [...rows.values()].filter(x => x.status === params[0]).map(record => ({ record })).slice(0, params[1]) };
      if (sql.includes("SELECT record FROM capability_lifecycle_runs ORDER BY")) return { rows: [...rows.values()].slice(0, params[0]).map(record => ({ record })) };
      return { rows: [] };
    }
  };
}
const record = { id: "9e67e66c-18ab-4ed7-a2c8-69c9a0d6e181", capability: "new_feature", goal: "Improve capability", status: "running", stage: "research", stages: [] };

test("creates schema once and persists/retrieves lifecycle checkpoints", async () => {
  const pool = fakePool(); const store = createPostgresLifecycleStore(pool);
  await store.create(record);
  const changed = { ...record, stage: "design", updatedAt: "2026-01-01T00:00:00Z" };
  await store.update(record.id, changed);
  assert.deepEqual(await store.get(record.id), changed);
  assert.equal((await store.list()).length, 1);
  assert.equal(pool.queries.filter(q => q.includes("CREATE TABLE IF NOT EXISTS")).length, 1);
});

test("refuses updates to missing records and mismatched IDs", async () => {
  const store = createPostgresLifecycleStore(fakePool());
  await assert.rejects(store.update(record.id, { ...record, id: "d4a1a7dd-cccf-4a56-933a-999d030f97b1" }), /mismatch/);
  await assert.rejects(store.update(record.id, record), /does not exist/);
});
