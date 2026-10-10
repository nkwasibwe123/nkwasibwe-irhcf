"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCapabilityExpansionPlan,
  evaluateExpansionReadiness
} = require("./discovery");

const passingGates = {
  sandbox: true,
  tests: true,
  security_review: true,
  regression: true,
  explicit_promotion: true
};

test("capability expansion cannot promote when authorization is absent", () => {
  const plan = buildCapabilityExpansionPlan({
    requestedCapability: "generate reports"
  });
  const result = evaluateExpansionReadiness(plan, passingGates);
  assert.equal(result.ready, true);
  assert.equal(result.canPromote, false);
  assert.equal(result.authorizationRequired, true);
});

test("capability expansion can promote only after explicit authorization", () => {
  const plan = buildCapabilityExpansionPlan({
    requestedCapability: "generate reports"
  });
  const result = evaluateExpansionReadiness(plan, {
    ...passingGates,
    authorization: true
  });
  assert.equal(result.ready, true);
  assert.equal(result.canPromote, true);
});

test("critical capability requires every quality gate and explicit promotion", () => {
  const plan = buildCapabilityExpansionPlan({
    requestedCapability: "execute code",
    executesCode: true
  });
  const withoutPromotion = evaluateExpansionReadiness(plan, {
    ...passingGates,
    authorization: true
  });
  assert.equal(withoutPromotion.ready, false);
  assert.ok(withoutPromotion.missing.includes("explicit_promotion"));
  assert.equal(withoutPromotion.canPromote, false);

  const approved = evaluateExpansionReadiness(plan, {
    ...passingGates,
    authorization: true,
    explicit_promotion: true
  });
  assert.equal(approved.ready, true);
  assert.equal(approved.canPromote, true);
});

test("missing plan fails closed", () => {
  const result = evaluateExpansionReadiness(null, passingGates);
  assert.equal(result.ready, false);
  assert.equal(result.canPromote, false);
  assert.ok(result.missing.includes("authorization"));
});
