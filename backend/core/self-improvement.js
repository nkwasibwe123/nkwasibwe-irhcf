"use strict";

/**
 * Safe self-improvement controller.
 *
 * Learning may produce proposals; promotion requires benchmark,
 * regression, security, and explicit policy checks.
 */

function buildImprovementProposal({
  target,
  reason,
  changes = [],
  evidence = []
} = {}) {
  return {
    id: "improvement_" + Date.now(),
    target: String(target || "unknown"),
    reason: String(reason || "").slice(0, 2000),
    changes: Array.isArray(changes) ? changes.slice(0, 100) : [],
    evidence: Array.isArray(evidence) ? evidence.slice(0, 100) : [],
    status: "PROPOSED",
    createdAt: new Date().toISOString()
  };
}

function evaluatePromotion({
  proposal,
  baseline,
  candidate,
  securityPassed = false,
  regressionPassed = false,
  explicitPromotion = false
} = {}) {
  const reasons = [];
  if (!proposal) reasons.push("PROPOSAL_REQUIRED");
  if (!baseline || !candidate) reasons.push("BENCHMARK_REQUIRED");
  if (!securityPassed) reasons.push("SECURITY_REVIEW_REQUIRED");
  if (!regressionPassed) reasons.push("REGRESSION_TEST_REQUIRED");
  if (!explicitPromotion) reasons.push("EXPLICIT_PROMOTION_REQUIRED");

  const scoreOk =
    baseline && candidate &&
    Number(candidate.score) >= Number(baseline.score) &&
    Number(candidate.passRate) >= Number(baseline.passRate);

  if (!scoreOk) reasons.push("BENCHMARK_NOT_IMPROVED");
  if (candidate && candidate.safe !== true) reasons.push("SAFETY_NOT_PASSED");

  return {
    promotable: reasons.length === 0,
    reasons,
    policy: {
      noBlindProductionMutation: true,
      sandboxFirst: true,
      benchmarkRequired: true,
      regressionRequired: true,
      securityRequired: true,
      explicitPromotionRequired: true
    }
  };
}

module.exports = {
  buildImprovementProposal,
  evaluatePromotion
};
