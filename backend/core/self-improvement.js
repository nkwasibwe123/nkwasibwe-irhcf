"use strict";
const crypto = require("node:crypto");
const cleanText = (v, max = 2000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const list = (v, max = 100) => Array.isArray(v) ? v.slice(0, max) : [];

function buildImprovementProposal({ target, reason, changes = [], evidence = [], fingerprintKey = null } = {}) {
  const cleanTarget = cleanText(target || "unknown", 200);
  const cleanReason = cleanText(reason);
  const fingerprint = crypto.createHash("sha256").update((cleanTarget + "\n" + cleanText(fingerprintKey || cleanReason, 2000)).toLowerCase()).digest("hex");
  return {
    id: crypto.randomUUID(), fingerprint, target: cleanTarget, reason: cleanReason,
    changes: list(changes).map(v => cleanText(v, 1000)).filter(Boolean),
    evidence: list(evidence).map(v => v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : { detail: cleanText(v, 1000) }),
    status: "PROPOSED", createdAt: new Date().toISOString()
  };
}

function evaluatePromotion({ proposal, baseline, candidate, securityPassed = false, regressionPassed = false, explicitPromotion = false } = {}) {
  const reasons = [];
  if (!proposal || typeof proposal !== "object") reasons.push("PROPOSAL_REQUIRED");
  if (!baseline || !candidate || typeof baseline !== "object" || typeof candidate !== "object") reasons.push("BENCHMARK_REQUIRED");
  if (!securityPassed) reasons.push("SECURITY_REVIEW_REQUIRED");
  if (!regressionPassed) reasons.push("REGRESSION_TEST_REQUIRED");
  if (!explicitPromotion) reasons.push("EXPLICIT_PROMOTION_REQUIRED");
  const bScore = Number(baseline?.score), cScore = Number(candidate?.score);
  const bRate = Number(baseline?.passRate), cRate = Number(candidate?.passRate);
  const metricsValid = [bScore,cScore,bRate,cRate].every(Number.isFinite) && bRate >= 0 && bRate <= 1 && cRate >= 0 && cRate <= 1;
  if (!metricsValid) reasons.push("BENCHMARK_METRICS_INVALID");
  else if (cScore < bScore || cRate < bRate) reasons.push("BENCHMARK_NOT_IMPROVED");
  if (candidate && candidate.safe !== true) reasons.push("SAFETY_NOT_PASSED");
  return {
    promotable: reasons.length === 0, reasons: [...new Set(reasons)],
    policy: { noBlindProductionMutation: true, sandboxFirst: true, benchmarkRequired: true, regressionRequired: true, securityRequired: true, explicitPromotionRequired: true, approvalIsNotDeployment: true }
  };
}

function classifyFailureTarget(error) {
  const s = cleanText(error, 1000).toLowerCase();
  if (/provider|quota|credit|rate.?limit|api key|unauthorized|billing/.test(s)) return "provider-access";
  if (/artifact|syntax|file content|deliverable/.test(s)) return "artifact-generation";
  if (/timeout|timed out|abort/.test(s)) return "task-timeouts";
  if (/database|postgres|sql|connection/.test(s)) return "database-reliability";
  if (/verification|verified|response quality/.test(s)) return "result-verification";
  return "task-execution";
}

function buildFailureImprovementProposal(failures = []) {
  const groups = new Map();
  for (const row of list(failures, 100)) {
    if (!row || row.id == null) continue;
    const error = cleanText(row.error || "Task failed without a recorded error.", 1000);
    const target = classifyFailureTarget(error);
    const key = target + ":" + error.toLowerCase().replace(/\b\d+\b/g, "#").replace(/\s+/g, " ").slice(0, 240);
    if (!groups.has(key)) groups.set(key, { target, error, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map(group => buildImprovementProposal({
    target: group.target,
    reason: "Observed " + group.rows.length + " failed task(s) with a similar recorded failure: " + group.error,
    fingerprintKey: group.target + ":" + group.error.toLowerCase().replace(/\\b\\d+\\b/g, "#").replace(/\\s+/g, " ").slice(0, 240),
    changes: [
      "Reproduce this failure in a focused automated regression test before changing production behavior.",
      "Inspect the responsible execution path and implement a bounded fix in a reviewed branch.",
      "Run regression and security suites, then verify a real task end-to-end."
    ],
    evidence: group.rows.slice(0, 20).map(row => ({
      taskId: row.id, task: cleanText(row.task, 500), status: row.status,
      attempts: Number(row.attempts) || 0, createdAt: row.created_at || null,
      error: cleanText(row.error || group.error, 1000)
    }))
  }));
}
module.exports = { buildImprovementProposal, evaluatePromotion, classifyFailureTarget, buildFailureImprovementProposal };
