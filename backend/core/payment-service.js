"use strict";

const { validateFinancialAction } = require("../integrations/financial-action-gate");
const { collect, status, payout } = require("../integrations/payment-provider-contract");

function requireIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(key)) {
    const error = new Error("A strong idempotency key is required.");
    error.code = "IDEMPOTENCY_KEY_REQUIRED";
    throw error;
  }
  return key;
}

class PaymentService {
  constructor({ pool, providerResolver } = {}) {
    if (!pool) throw new Error("PaymentService requires a database pool.");
    if (typeof providerResolver !== "function") throw new Error("PaymentService requires a provider resolver.");
    this.pool = pool;
    this.providerResolver = providerResolver;
  }

  async createCollection({ userId, providerName, amount, currency = "RWF", payerMsisdn, externalId, idempotencyKey, metadata = {} } = {}) {
    const key = requireIdempotencyKey(idempotencyKey);
    const provider = await this.providerResolver(providerName, "collect");
    const gate = validateFinancialAction({ action: "request_payment", amount, currency, providerAvailable: Boolean(provider), idempotencyKey: key, authorized: false });
    if (!gate.allowed) { const error = new Error(gate.reason); error.code = gate.code; throw error; }
    const existing = await this.pool.query("SELECT * FROM financial_transactions WHERE user_id=$1 AND idempotency_key=$2 LIMIT 1", [userId, key]);
    if (existing.rows.length) return existing.rows[0];
    const tx = await this.pool.query("INSERT INTO financial_transactions (user_id,direction,action,provider,amount,currency,status,idempotency_key,metadata) VALUES ($1,'inbound','request_payment',$2,$3,$4,'pending',$5,$6::jsonb) RETURNING *", [userId, providerName, Number(amount), currency, key, JSON.stringify(metadata)]);
    try {
      const result = await collect(provider, { amount: Number(amount), currency, payerMsisdn, externalId });
      const updated = await this.pool.query("UPDATE financial_transactions SET provider_reference=$2,status='submitted',metadata=metadata || $3::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [tx.rows[0].id, result?.reference || result?.transactionId || null, JSON.stringify({ providerResult: result || {} })]);
      return updated.rows[0];
    } catch (error) {
      await this.pool.query("UPDATE financial_transactions SET status='failed',error=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [tx.rows[0].id, String(error?.message || error).slice(0, 2000)]);
      throw error;
    }
  }

  async getStatus({ userId, transactionId, providerName } = {}) {
    const tx = await this.pool.query("SELECT * FROM financial_transactions WHERE id=$1 AND user_id=$2 LIMIT 1", [transactionId, userId]);
    if (!tx.rows.length) return null;
    const provider = await this.providerResolver(providerName || tx.rows[0].provider, "status");
    if (!provider) return tx.rows[0];
    const result = await status(provider, { reference: tx.rows[0].provider_reference });
    const updated = await this.pool.query("UPDATE financial_transactions SET status=$2,metadata=metadata || $3::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [transactionId, String(result?.status || tx.rows[0].status).toLowerCase(), JSON.stringify({ statusResult: result || {} })]);
    return updated.rows[0];
  }

  async requestPayout({ userId, providerName, amount, currency = "RWF", destination, idempotencyKey, authorized = false, destinationVerified = false, metadata = {} } = {}) {
    const key = requireIdempotencyKey(idempotencyKey);
    const provider = await this.providerResolver(providerName, "payout");
    const gate = validateFinancialAction({ action: "payout", amount, currency, providerAvailable: Boolean(provider), idempotencyKey: key, authorized, destinationVerified });
    if (!gate.allowed) { const error = new Error(gate.reason); error.code = gate.code; throw error; }
    const existing = await this.pool.query("SELECT * FROM financial_transactions WHERE user_id=$1 AND idempotency_key=$2 LIMIT 1", [userId, key]);
    if (existing.rows.length) return existing.rows[0];
    const tx = await this.pool.query("INSERT INTO financial_transactions (user_id,direction,action,provider,amount,currency,status,idempotency_key,destination,metadata) VALUES ($1,'outbound','payout',$2,$3,$4,'pending',$5,$6,$7::jsonb) RETURNING *", [userId, providerName, Number(amount), currency, key, String(destination), JSON.stringify(metadata)]);
    try {
      const result = await payout(provider, { amount: Number(amount), currency, destination, idempotencyKey: key });
      const updated = await this.pool.query("UPDATE financial_transactions SET provider_reference=$2,status='submitted',metadata=metadata || $3::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [tx.rows[0].id, result?.reference || result?.transactionId || null, JSON.stringify({ providerResult: result || {} })]);
      return updated.rows[0];
    } catch (error) {
      await this.pool.query("UPDATE financial_transactions SET status='failed',error=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [tx.rows[0].id, String(error?.message || error).slice(0, 2000)]);
      throw error;
    }
  }
}

module.exports = { PaymentService };