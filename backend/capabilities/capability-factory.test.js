"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCapabilityCandidate, validateCapabilityRequest } = require("./capability-factory");

test("factory rejects unsafe names and missing source files", () => {
  assert.throws(() => validateCapabilityRequest({ requestedCapability: "../escape", files: [{ name: "index.js", content: "" }] }), /Capability name/);
  assert.throws(() => validateCapabilityRequest({ requestedCapability: "new_feature", files: [] }), /source file/);
});

test("factory creates a sandboxed candidate but never promotes or executes it", async () => {
  const candidate = await createCapabilityCandidate({
    requestedCapability: "html_preview",
    reason: "Create a basic HTML preview capability",
    files: [{ name: "index.html", content: "<!doctype html><title>Preview</title>" }],
    entry: "index.html",
    executesCode: false,
    runTests: async () => ({ passed: true }),
    reviewSecurity: async () => ({ passed: true }),
    runRegression: async () => ({ passed: true })
  });
  assert.equal(candidate.status, "CANDIDATE_BLOCKED");
  assert.equal(candidate.promotionPerformed, false);
  assert.equal(candidate.executionPerformed, false);
  assert.equal(candidate.readiness.ready, false);
  assert.ok(candidate.sourceFiles.includes("index.html"));
});

test("all quality gates and explicit authorization are required for promotion readiness", async () => {
  const candidate = await createCapabilityCandidate({
    requestedCapability: "safe_helper",
    files: [{ name: "index.js", content: '"use strict"; module.exports = () => true;' }],
    entry: "index.js",
    runTests: async () => ({ passed: true }),
    reviewSecurity: async () => ({ passed: true }),
    runRegression: async () => ({ passed: true }),
    explicitPromotion: true,
    authorization: true
  });
  assert.equal(candidate.status, "READY_FOR_REGISTERED_PROMOTION");
  assert.equal(candidate.readiness.canPromote, true);
  assert.equal(candidate.promotionPerformed, false);
  assert.equal(candidate.executionPerformed, false);
});
