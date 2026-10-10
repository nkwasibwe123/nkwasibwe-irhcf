"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROJECT_TYPES,
  PROJECT_PHASES,
  inferProjectType,
  buildProjectPlan,
  shouldBecomeLongRunning
} = require("./project-autopilot");

test("project type inference recognizes main autonomous work categories", () => {
  assert.equal(inferProjectType("Build a website for my shop"), "website");
  assert.equal(inferProjectType("Create a song in Kinyarwanda"), "music");
  assert.equal(inferProjectType("Create an HD video"), "video");
  assert.equal(inferProjectType("Research current AI safety guidance"), "research");
  assert.ok(PROJECT_TYPES.includes(inferProjectType("Do something useful")));
});

test("project plan contains ordered lifecycle and safety policies", () => {
  const plan = buildProjectPlan({
    idea: "Build a website and test it before deployment",
    userId: "test-user",
    requestedDeadline: "2026-12-01T00:00:00Z"
  });
  assert.equal(plan.type, "website");
  assert.equal(plan.userId, "test-user");
  assert.equal(plan.autonomous, true);
  assert.equal(plan.requestedDeadline, "2026-12-01T00:00:00Z");
  assert.deepEqual(plan.phases.map(item => item.phase), PROJECT_PHASES);
  assert.ok(plan.phases.every(item => item.status === "planned"));
  for (const phase of ["TEST", "SECURITY_REVIEW", "VERIFY", "DEPLOY"]) {
    assert.equal(plan.phases.find(item => item.phase === phase).checkpointRequired, true);
  }
  assert.equal(plan.policies.testBeforeDeploy, true);
  assert.equal(plan.policies.securityReviewBeforeExternalAction, true);
  assert.equal(plan.policies.verifyBeforeClaimingCompletion, true);
  assert.equal(plan.policies.askUserBeforeIrreversibleAction, true);
  assert.equal(plan.policies.preserveExistingWork, true);
});

test("empty project ideas fail closed", () => {
  assert.throws(() => buildProjectPlan({ idea: "   " }), /project idea is required/i);
});

test("long-running detection uses intent, not fixed lifecycle phase count", () => {
  assert.equal(shouldBecomeLongRunning({ type: "general", idea: "Hi, how are you?" }), false);
  assert.equal(shouldBecomeLongRunning({ type: "website", idea: "Build a website for my business" }), true);
  assert.equal(shouldBecomeLongRunning({ type: "general", idea: "Please help me with a long research project" }), false);
});
