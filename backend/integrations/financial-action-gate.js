"use strict";

/**
 * Financial action gate.
 *
 * IRHCF may prepare invoices, payment requests, reconciliation and payout
 * instructions, but actual money movement requires an authorized provider,
 * an explicit approval policy and idempotency.
 */

const ACTIONS = Object.freeze([
  "create_invoice",
  "request_payment",
  "check_payment",
  "reconcile",
  "payout"
]);

function validateFinancialAction({
  action,
  amount,
  currency = "RWF",
  authorized = false,
  idempotencyKey,
  destinationVerified = false,
  providerAvailable = false
} = {}) {
  const normalized = String(action || "").trim().toLowerCase();

  if (!ACTIONS.includes(normalized)) {
    throw new Error("Unsupported financial action.");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("A positive financial amount is required.");
  }

  if (!idempotencyKey || String(idempotencyKey).length < 16) {
    throw new Error("A strong idempotency key is required.");
  }

  if (!providerAvailable) {
    throw new Error("No approved financial provider is configured.");
  }

  const payout = normalized === "payout";

  if (payout && (!authorized || !destinationVerified)) {
    const error = new Error(
      "Payout requires explicit authorization and verified destination."
    );
    error.code = "FINANCIAL_APPROVAL_REQUIRED";
    throw error;
  }

  return {
    allowed: true,
    action: normalized,
    amount: numericAmount,
    currency: String(currency || "RWF").toUpperCase(),
    requiresApproval: payout,
    idempotencyKey: String(idempotencyKey)
  };
}

module.exports = { ACTIONS, validateFinancialAction };
