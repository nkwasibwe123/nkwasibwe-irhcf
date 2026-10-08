"use strict";

/**
 * IRHCF financial ledger.
 *
 * This module records financial intent and provider outcomes without
 * containing provider credentials. Actual collection/payout is delegated
 * to an approved provider adapter after the financial-action gate passes.
 */

const { validateFinancialAction } = require("./financial-action-gate");

function clean(value, max = 5000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("A positive amount is required.");
  }
  return Math.round(amount * 100) / 100;
}

async function createTransaction(pool, {
  userId,
  direction,
  action,
  provider,
  amount,
  currency = "RWF",
  idempotencyKey,
  destination = null,
  metadata = {}
} = {}) {
  if (!pool) throw new Error("Database pool is required.");
  if (!userId) throw new Error("Authenticated user is required.");

  const normalizedDirection = clean(direction, 20).toLowerCase();
  if (!["inbound", "outbound"].includes(normalizedDirection)) {
    throw new Error("Transaction direction must be inbound or outbound.");
  }

  const normalizedAction = clean(action, 60).toLowerCase();
  const normalizedProvider = clean(provider, 60).toLowerCase();
  const normalizedKey = clean(idempotencyKey, 200);

  if (!normalizedAction || !normalizedProvider || normalizedKey.length < 16) {
    throw new Error("Action, provider and strong idempotency key are required.");
  }

  const result = await pool.query(
    `INSERT INTO financial_transactions
      (user_id, direction, action, provider, amount, currency,
       status, idempotency_key, destination, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9::jsonb)
     ON CONFLICT (user_id, idempotency_key)
     DO UPDATE SET updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      userId,
      normalizedDirection,
      normalizedAction,
      normalizedProvider,
      normalizeAmount(amount),
      clean(currency, 10).toUpperCase() || "RWF",
      normalizedKey,
      destination ? clean(destination, 255) : null,
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {})
    ]
  );

  return result.rows[0];
}

async function updateTransaction(pool, {
  userId,
  id,
  status,
  providerReference = null,
  error = null,
  metadata = null
} = {}) {
  if (!pool || !userId || !Number.isInteger(Number(id))) {
    throw new Error("Valid transaction and user are required.");
  }

  const normalizedStatus = clean(status, 30).toLowerCase();
  if (!["pending", "submitted", "succeeded", "failed", "reconciled"].includes(normalizedStatus)) {
    throw new Error("Unsupported financial transaction status.");
  }

  const result = await pool.query(
    `UPDATE financial_transactions
     SET status = $3,
         provider_reference = COALESCE($4, provider_reference),
         error = $5,
         metadata = CASE
           WHEN $6::jsonb = '{}'::jsonb THEN metadata
           ELSE COALESCE(metadata, '{}'::jsonb) || $6::jsonb
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      Number(id),
      userId,
      normalizedStatus,
      providerReference ? clean(providerReference, 255) : null,
      error ? clean(error, 2000) : null,
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {})
    ]
  );

  return result.rows[0] || null;
}

async function listTransactions(pool, userId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));

  const result = await pool.query(
    `SELECT id, direction, action, provider, amount, currency, status,
            idempotency_key, provider_reference, destination,
            metadata, created_at, updated_at
     FROM financial_transactions
     WHERE user_id = $1
     ORDER BY id DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );

  return result.rows;
}

function preparePayout({
  amount,
  currency = "RWF",
  idempotencyKey,
  providerAvailable = false,
  authorized = false,
  destinationVerified = false,
  destination
} = {}) {
  const gate = validateFinancialAction({
    action: "payout",
    amount,
    currency,
    authorized,
    idempotencyKey,
    destinationVerified,
    providerAvailable
  });

  return {
    ...gate,
    destination: clean(destination, 255),
    executionPolicy: {
      requiresExplicitUserApproval: true,
      requiresVerifiedDestination: true,
      neverGuessDestination: true
    }
  };
}

module.exports = {
  createTransaction,
  updateTransaction,
  listTransactions,
  preparePayout
};
