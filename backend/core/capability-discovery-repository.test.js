"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCapabilityDiscoveryRepository } = require("./capability-discovery-repository");

test("persists proposals as review-gated records and deduplicates by fingerprint", async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({sql, params});
    if (/SELECT DISTINCT requested_capability/.test(sql)) return {rows:[{name:"existing"}]};
    return {rowCount: sql.includes("ON CONFLICT (fingerprint)") ? 1 : 0, rows:[{id:1}]};
  }};
  const repository = createCapabilityDiscoveryRepository({pool});
  assert.deepEqual(await repository.listKnownCapabilities(), ["existing"]);
  const saved = await repository.saveProposal({
    fingerprint:"abc", title:"A", description:"Evidence", source:"https://example.org",
    capability:"new-capability", risks:["license review"], discoveredAt:"2026-01-01T00:00:00.000Z"
  });
  assert.equal(saved, true);
  assert.match(calls[1].sql, /ON CONFLICT \(fingerprint\) DO NOTHING/);
  assert.equal(calls[1].params[6], "PROPOSED");
  assert.equal(calls[1].params[7], true);
  assert.equal(calls[1].params[10], true);
});

test("requires a database pool", () => {
  assert.throws(() => createCapabilityDiscoveryRepository(), /PostgreSQL pool/);
});
