"use strict";

/**
 * SAFE CAPABILITY DISCOVERY
 *
 * Turns a missing capability into a controlled engineering plan.
 * This module plans discovery/build/verification; it never executes
 * arbitrary downloaded code and never promotes code directly to production.
 */

const STAGES = Object.freeze([
  "DISCOVER",
  "RESEARCH",
  "DESIGN",
  "BUILD",
  "SANDBOX",
  "TEST",
  "SECURITY_REVIEW",
  "REGRESSION",
  "REGISTER",
  "EXECUTE",
  "VERIFY"
]);

const RISK_LEVELS = Object.freeze([
  "low",
  "medium",
  "high",
  "critical"
]);

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function inferRisk({
  externalAction = false,
  handlesCredentials = false,
  handlesUserData = false,
  executesCode = false
} = {}) {
  if (handlesCredentials || executesCode) {
    return "critical";
  }

  if (externalAction || handlesUserData) {
    return "high";
  }

  return "medium";
}

function buildCapabilityExpansionPlan({
  requestedCapability,
  reason = "",
  externalAction = false,
  handlesCredentials = false,
  handlesUserData = false,
  executesCode = false
} = {}) {
  const name = normalize(requestedCapability);

  if (!name) {
    throw new Error(
      "A requested capability is required."
    );
  }

  const risk = inferRisk({
    externalAction,
    handlesCredentials,
    handlesUserData,
    executesCode
  });

  return {
    capability: name,
    reason: String(reason || "").slice(0, 2000),
    risk,
    allowedRiskLevels: RISK_LEVELS,
    productionPromotion: {
      allowed: false,
      requires:
        risk === "critical"
          ? [
              "sandbox",
              "tests",
              "security_review",
              "regression",
              "explicit_promotion"
            ]
          : [
              "sandbox",
              "tests",
              "security_review",
              "regression"
            ]
    },
    stages: STAGES.map((stage, index) => ({
      order: index + 1,
      stage,
      status:
        index === 0
          ? "ready"
          : "blocked_until_previous_stage"
    })),
    safety: {
      arbitraryCodeExecution: false,
      secretExposure: false,
      directProductionMutation: false,
      externalActionsRequireAuthorization: true
    }
  };
}

function evaluateExpansionReadiness(plan, results = {}) {
  if (!plan) {
    return {
      ready: false,
      reason: "No expansion plan supplied."
    };
  }

  const required = [
    "sandbox",
    "tests",
    "security_review",
    "regression"
  ];

  const missing = required.filter(
    (key) => results[key] !== true
  );

  return {
    ready: missing.length === 0,
    missing,
    canPromote:
      missing.length === 0 &&
      results.authorization !== false,
      risk: plan.risk
  };
}

module.exports = {
  STAGES,
  RISK_LEVELS,
  inferRisk,
  buildCapabilityExpansionPlan,
  evaluateExpansionReadiness
};
