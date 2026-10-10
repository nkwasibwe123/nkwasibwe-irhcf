"use strict";

/**
 * Capability Factory: builds a checked candidate for a new IRHCF ability.
 * It never executes generated code or promotes/registers a candidate.
 * Functional tests, security review, regression checks and explicit
 * authorization are independent mandatory gates.
 */
const { buildSandbox, cleanupSandbox } = require("./sandbox");
const { buildCapabilityExpansionPlan, evaluateExpansionReadiness } = require("./discovery");

const SAFE_CAPABILITY_NAME = /^[a-z][a-z0-9_]{1,63}$/;

function validateCapabilityRequest({ requestedCapability, files } = {}) {
  const name = String(requestedCapability || "").trim().toLowerCase();
  if (!SAFE_CAPABILITY_NAME.test(name)) {
    throw new Error("Capability name must be 2-64 lowercase letters, numbers or underscores and start with a letter.");
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("At least one source file is required to build a capability candidate.");
  }
  return name;
}

async function createCapabilityCandidate({
  requestedCapability, reason = "", files, entry = null,
  executesCode = true, handlesCredentials = false,
  handlesUserData = false, externalAction = false,
  runTests = null, reviewSecurity = null, runRegression = null,
  explicitPromotion = false, authorization = false
} = {}) {
  const name = validateCapabilityRequest({ requestedCapability, files });
  const plan = buildCapabilityExpansionPlan({
    requestedCapability: name, reason, executesCode,
    handlesCredentials, handlesUserData, externalAction
  });
  const sandbox = await buildSandbox({ files, entry });

  try {
    const testResult = typeof runTests === "function"
      ? await runTests({ name, root: sandbox.root, files: sandbox.validatedFiles })
      : { passed: false, reason: "A dedicated functional test runner is required." };
    const securityResult = typeof reviewSecurity === "function"
      ? await reviewSecurity({ name, root: sandbox.root, files: sandbox.validatedFiles, risk: plan.risk })
      : { passed: false, reason: "A security reviewer is required." };
    const regressionResult = typeof runRegression === "function"
      ? await runRegression({ name, root: sandbox.root, files: sandbox.validatedFiles })
      : { passed: false, reason: "A regression test runner is required." };

    const readiness = evaluateExpansionReadiness(plan, {
      sandbox: true,
      tests: testResult?.passed === true,
      security_review: securityResult?.passed === true,
      regression: regressionResult?.passed === true,
      explicit_promotion: explicitPromotion === true,
      authorization: authorization === true
    });

    return {
      capability: name,
      status: readiness.canPromote ? "READY_FOR_REGISTERED_PROMOTION" : "CANDIDATE_BLOCKED",
      risk: plan.risk,
      sourceFiles: sandbox.validatedFiles,
      entry: sandbox.entry,
      syntaxChecked: sandbox.syntaxChecked,
      checks: { tests: testResult, securityReview: securityResult, regression: regressionResult },
      readiness,
      promotionPerformed: false,
      executionPerformed: false,
      sandboxId: sandbox.id,
      createdAt: new Date().toISOString()
    };
  } finally {
    await cleanupSandbox(sandbox.root);
  }
}

module.exports = { SAFE_CAPABILITY_NAME, validateCapabilityRequest, createCapabilityCandidate };
