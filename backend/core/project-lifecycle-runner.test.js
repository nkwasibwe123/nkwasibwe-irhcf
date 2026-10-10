"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProjectLifecycleRunner, validatePlan } = require("./project-lifecycle-runner");

function plan(phases = ["DISCOVER", "BUILD", "TEST", "DEPLOY", "DELIVER"]) {
  return { projectId: "p-test", phases: phases.map((phase, order) => ({ phase, order: order + 1 })) };
}

test("lifecycle runs phases in order and records checkpoints", async () => {
  const calls = [];
  const checkpoints = [];
  const handlers = Object.fromEntries(["DISCOVER", "BUILD", "TEST", "DEPLOY", "DELIVER"].map((p) => [p, async () => { calls.push(p); return { ok: true }; }]));
  const run = createProjectLifecycleRunner({ handlers, authorize: async () => true, checkpoint: async (item) => checkpoints.push(item) });
  const result = await run({ plan: plan() });
  assert.equal(result.status, "complete");
  assert.deepEqual(calls, ["DISCOVER", "BUILD", "TEST", "DEPLOY", "DELIVER"]);
  assert.equal(checkpoints.filter((item) => item.status === "complete").length, 5);
});

test("deployment pauses until explicit authorization is true", async () => {
  let deployed = false;
  const run = createProjectLifecycleRunner({
    handlers: { DISCOVER: async () => "ok", DEPLOY: async () => { deployed = true; }, DELIVER: async () => "done" },
    authorize: async () => false
  });
  const result = await run({ plan: plan(["DISCOVER", "DEPLOY", "DELIVER"]) });
  assert.equal(result.status, "waiting_for_user");
  assert.equal(deployed, false);
  assert.equal(result.results.at(-1).phase, "DEPLOY");
});

test("missing handlers block rather than falsely completing a project", async () => {
  const run = createProjectLifecycleRunner({ handlers: { DISCOVER: async () => "ok" } });
  const result = await run({ plan: plan(["DISCOVER", "BUILD", "DELIVER"]) });
  assert.equal(result.status, "blocked");
  assert.equal(result.results.at(-1).phase, "BUILD");
});

test("phase failures stop later phases and are checkpointed", async () => {
  const checkpoints = [];
  const run = createProjectLifecycleRunner({
    handlers: { DISCOVER: async () => "ok", BUILD: async () => { throw new Error("build broke"); }, DELIVER: async () => "should not run" },
    checkpoint: async (item) => checkpoints.push(item)
  });
  const result = await run({ plan: plan(["DISCOVER", "BUILD", "DELIVER"]) });
  assert.equal(result.status, "failed");
  assert.equal(result.results.at(-1).error, "build broke");
  assert.ok(checkpoints.some((item) => item.status === "failed" && item.phase === "BUILD"));
});

test("plan validation rejects duplicate phases and unknown resume points", async () => {
  assert.throws(() => validatePlan(plan(["BUILD", "BUILD"])), /duplicate phase/);
  const run = createProjectLifecycleRunner({ handlers: { DISCOVER: async () => "ok" } });
  await assert.rejects(() => run({ plan: plan(["DISCOVER"]), startAtPhase: "BUILD" }), /not present/);
});
