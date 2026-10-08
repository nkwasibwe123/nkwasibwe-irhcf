"use strict";

/**
 * Economic Autopilot.
 *
 * Finds and ranks lawful business opportunities. It never promises profit,
 * never trades/invests automatically, and never moves user funds without
 * an explicit authorization boundary.
 */

const OPPORTUNITY_TYPES = Object.freeze([
  "software_service",
  "digital_product",
  "content_monetization",
  "automation_service",
  "research_service",
  "media_service",
  "education_service",
  "ecommerce"
]);

const RISK_LEVELS = Object.freeze(["low", "medium", "high", "critical"]);

function normalize(value, max = 5000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function scoreOpportunity({
  demand = 0,
  feasibility = 0,
  margin = 0,
  timeToRevenue = 0,
  risk = 0
} = {}) {
  const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
  return Math.round(
    clamp(demand) * 0.30 +
    clamp(feasibility) * 0.25 +
    clamp(margin) * 0.20 +
    clamp(timeToRevenue) * 0.15 -
    clamp(risk) * 0.10
  );
}

function buildOpportunity({
  title,
  type,
  problem,
  customer,
  revenueModel,
  evidence = [],
  demand = 0,
  feasibility = 0,
  margin = 0,
  timeToRevenue = 0,
  risk = 0,
  requiresAuthorization = true
} = {}) {
  if (!title || !type || !problem || !customer || !revenueModel) {
    throw new Error("Opportunity requires title, type, problem, customer and revenue model.");
  }

  return {
    id: "opp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    title: normalize(title, 300),
    type,
    problem: normalize(problem, 3000),
    customer: normalize(customer, 1000),
    revenueModel: normalize(revenueModel, 1000),
    evidence: Array.isArray(evidence) ? evidence.slice(0, 30) : [],
    score: scoreOpportunity({ demand, feasibility, margin, timeToRevenue, risk }),
    riskLevel: risk >= 75 ? "critical" : risk >= 50 ? "high" : risk >= 25 ? "medium" : "low",
    requiresAuthorization: Boolean(requiresAuthorization),
    status: "candidate",
    createdAt: new Date().toISOString()
  };
}

function buildRevenueProjectPlan(opportunity, userId = null) {
  if (!opportunity || opportunity.status !== "candidate") {
    throw new Error("A candidate opportunity is required.");
  }

  return {
    userId,
    opportunityId: opportunity.id,
    objective: opportunity.title,
    phases: [
      "MARKET_RESEARCH",
      "CUSTOMER_VALIDATION",
      "UNIT_ECONOMICS",
      "OFFER_DESIGN",
      "BUILD_MVP",
      "TEST",
      "SECURITY_REVIEW",
      "LEGAL_COMPLIANCE_REVIEW",
      "LAUNCH",
      "MONITOR",
      "OPTIMIZE"
    ],
    policies: {
      no_guaranteed_profit: true,
      no_unauthorized_financial_action: true,
      verify_revenue_before_reporting: true,
      preserve_user_control: true
    }
  };
}

module.exports = {
  OPPORTUNITY_TYPES,
  RISK_LEVELS,
  scoreOpportunity,
  buildOpportunity,
  buildRevenueProjectPlan
};
