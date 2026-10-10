"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTIONS,
  getActionPolicy,
  validateExecutionRequest,
  createExecutionContext
} = require("./execution-gate");

test("execution gate rejects unknown actions and unavailable adapters", () => {
  assert.equal(validateExecutionRequest({ action: "unknown", adapterAvailable: true }).code, "UNKNOWN_ACTION");
  const result = validateExecutionRequest({
    action: ACTIONS.BUILD_SOFTWARE,
    capabilities: ["software_architecture", "code_generation", "testing"],
    adapterAvailable: false
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "ADAPTER_UNAVAILABLE");
});

test("execution gate requires every declared capability", () => {
  const result = validateExecutionRequest({
    action: ACTIONS.BUILD_SOFTWARE,
    capabilities: ["software_architecture", "code_generation"],
    adapterAvailable: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "CAPABILITY_MISSING");
  assert.deepEqual(result.missingCapabilities, ["testing"]);
});

test("external side effects require explicit authorization", () => {
  const args = {
    action: ACTIONS.PUBLISH_YOUTUBE,
    capabilities: ["youtube_publishing", "media_generation"],
    adapterAvailable: true
  };
  const blocked = validateExecutionRequest(args);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, "AUTHORIZATION_REQUIRED");

  const approved = validateExecutionRequest({ ...args, authorized: true });
  assert.equal(approved.allowed, true);
  assert.equal(approved.code, "EXECUTION_ALLOWED");
  assert.match(approved.executionId, /^exec_\d+_[a-f0-9]+$/);
});

test("safe internal research can run without external-action authorization but still needs adapter and capabilities", () => {
  const blocked = validateExecutionRequest({
    action: ACTIONS.RESEARCH,
    capabilities: ["web_research", "source_evaluation"],
    adapterAvailable: false
  });
  assert.equal(blocked.code, "ADAPTER_UNAVAILABLE");

  const allowed = validateExecutionRequest({
    action: ACTIONS.RESEARCH,
    capabilities: ["web_research", "source_evaluation"],
    adapterAvailable: true
  });
  assert.equal(allowed.allowed, true);
  assert.equal(getActionPolicy(ACTIONS.RESEARCH).verification, true);
});

test("execution context carries correlation identifiers and normalized action", () => {
  const context = createExecutionContext({
    executionId: "exec-test",
    userId: "user-test",
    taskId: "task-test",
    taskRunId: "run-test",
    action: " BUILD_SOFTWARE ",
    metadata: { source: "unit-test" }
  });
  assert.equal(context.executionId, "exec-test");
  assert.equal(context.action, "build_software");
  assert.equal(context.taskId, "task-test");
  assert.equal(context.taskRunId, "run-test");
  assert.deepEqual(context.metadata, { source: "unit-test" });
  assert.ok(Number.isNaN(Date.parse(context.startedAt)) === false);
});
