"use strict";

/**
 * Economic discovery autopilot.
 *
 * Produces a durable research task template for finding lawful,
 * evidence-backed revenue opportunities. It does not invest, trade,
 * spend money, publish, or move funds.
 */

function buildEconomicDiscoveryTask({
  locale = "Rwanda",
  targetCustomer = "local and online customers",
  constraints = "low upfront cost; lawful; scalable; mobile-money/bank compatible"
} = {}) {
  return [
    "NKWASIBWE IRHCF ECONOMIC DISCOVERY CYCLE",
    "",
    `Find evidence-backed business/revenue opportunities for: ${locale}.`,
    `Target customers: ${targetCustomer}.`,
    `Constraints: ${constraints}.`,
    "",
    "REQUIRED PROCESS:",
    "1. Research current demand and competition using available live sources.",
    "2. Prefer official, primary, and credible sources.",
    "3. Produce at least 3 distinct opportunities when evidence allows.",
    "4. Score demand, feasibility, margin potential, time-to-revenue and risk.",
    "5. Estimate realistic startup requirements and operating costs.",
    "6. Identify legal/compliance and payment-provider requirements.",
    "7. Select the strongest candidate only as a PROPOSAL.",
    "8. Create a safe MVP/project plan.",
    "9. Never promise profit or wealth.",
    "10. Never move money, open accounts, publish externally, contact customers, or purchase services without authorization.",
    "11. Clearly list any user action required and provide direct links when the system has a verified link.",
    "",
    "DELIVER: evidence, opportunity scores, risks, MVP plan, required user actions, and next safe step."
  ].join("\n");
}

module.exports = {
  buildEconomicDiscoveryTask
};
