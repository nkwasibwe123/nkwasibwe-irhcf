"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runCapabilityLifecycle, validateRequest, STAGES } = require("./capability-lifecycle");

function setup(overrides = {}) {
  const records = new Map();
  const calls = [];
  const store = {
    async create(record) { records.set(record.id, structuredClone(record)); },
    async update(id, record) { records.set(id, structuredClone(record)); }
  };
  const adapters = {
    async research() { calls.push("research"); return { passed: true, sources: [{ url: "https://example.org", title: "Docs" }], evidence: [{ url: "https://example.org" }] }; },
    async design() { calls.push("design"); return { passed: true, plan: { steps: ["implement"] } }; },
    async implement() { calls.push("implement"); return { passed: true, files: [{ name: "index.js", content: "module.exports = true;" }] }; },
    async test() { calls.push("test"); return { passed: true }; },
    async securityReview() { calls.push("securityReview"); return { passed: true }; },
    async regression() { calls.push("regression"); return { passed: true }; },
    async repair() { calls.push("repair"); return { passed: true, files: [{ name: "index.js", content: "module.exports = true;" }] }; },
    async releaseCandidate() { calls.push("releaseCandidate"); return { passed: true, artifact: { id: "artifact-1" } }; },
    async deploy() { calls.push("deploy"); return { passed: true, deploymentId: "deployment-1", url: "https://app.example.org" }; },
    async verifyDeployment() { calls.push("verifyDeployment"); return { passed: true, liveTaskPassed: true }; },
    ...overrides
  };
  return { store, adapters, records, calls };
}

const request = { capability: "new_feature", goal: "Provide a missing safe capability" };

test("validates capability request", () => {
  assert.throws(() => validateRequest({ capability: "../bad", goal: "x" }), /safe/);
  assert.throws(() => validateRequest({ capability: "new_feature", goal: " " }), /goal/);
  assert.equal(validateRequest(request).capability, "new_feature");
});

test("requires research sources and blocks missing evidence", async () => {
  const env = setup({ research: async () => ({ passed: true, sources: [] }) });
  const result = await runCapabilityLifecycle({ request, ...env });
  assert.equal(result.status, "blocked");
  assert.equal(result.stage, "research");
  assert.equal(env.calls.includes("deploy"), false);
});

test("runs all quality gates, prepares release, but never deploys without explicit authorization", async () => {
  const env = setup();
  const result = await runCapabilityLifecycle({ request, ...env });
  assert.equal(result.status, "blocked");
  assert.equal(result.stage, "deploy");
  assert.equal(result.deployment.attempted, false);
  assert.ok(result.artifacts.some(a => a.id === "artifact-1"));
  assert.deepEqual(env.calls.slice(0, 6), ["research", "design", "implement", "test", "securityReview", "regression"]);
  assert.equal(env.calls.includes("deploy"), false);
  assert.ok(result.stages.some(s => s.name === "release_candidate" && s.status === "completed"));
});

test("repairs a failing candidate and re-runs every quality gate", async () => {
  let testCalls = 0;
  const env = setup({
    test: async () => { testCalls++; return { passed: testCalls > 1 }; },
    repair: async () => ({ passed: true, files: [{ name: "index.js", content: "module.exports = 'fixed';" }] })
  });
  const result = await runCapabilityLifecycle({ request, ...env, maxRepairs: 2 });
  assert.equal(result.status, "blocked");
  assert.equal(result.repairAttempts, 1);
  assert.equal(testCalls, 2);
  assert.equal(env.calls.filter(c => c === "securityReview").length, 2);
  assert.equal(env.calls.filter(c => c === "regression").length, 2);
});

test("deployment requires authorization and live end-to-end verification", async () => {
  const env = setup();
  const result = await runCapabilityLifecycle({
    request: { ...request, explicitDeploymentAuthorization: true },
    ...env
  });
  assert.equal(result.status, "completed");
  assert.equal(result.deployment.verified, true);
  assert.ok(env.calls.includes("deploy"));
  assert.ok(env.calls.includes("verifyDeployment"));
  assert.equal(result.stage, "completed");
});

test("does not claim success when live task verification fails", async () => {
  const env = setup({ verifyDeployment: async () => ({ passed: true, liveTaskPassed: false }) });
  const result = await runCapabilityLifecycle({
    request: { ...request, explicitDeploymentAuthorization: true },
    ...env
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.stage, "verify_deployment");
  assert.equal(result.deployment.verified, false);
});

test("persists each stage transition", async () => {
  const env = setup();
  await runCapabilityLifecycle({ request, ...env });
  const final = [...env.records.values()][0];
  assert.ok(final.stages.length >= 7);
  assert.ok(final.updatedAt);
  assert.ok(STAGES.includes("verify_deployment"));
});
