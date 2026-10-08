"use strict";

/**
 * MTN MoMo provider adapter contract.
 * Production credentials are deliberately not embedded in source code.
 */

const BASE_URL =
  process.env.MOMO_BASE_URL || "https://momodeveloper.mtn.co.rw";

async function request({ accessToken, subscriptionKey, path, method = "POST", body } = {}) {
  if (!accessToken || !subscriptionKey) {
    throw new Error("MTN MoMo production credentials are not configured.");
  }

  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || "MTN MoMo API request failed.");
    error.code = "MOMO_API_FAILED";
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function requestToPay({
  accessToken,
  subscriptionKey,
  referenceId,
  amount,
  currency = "RWF",
  externalId,
  payerMsisdn,
  payerMessage = "IRHCF payment request",
  payeeNote = "IRHCF"
} = {}) {
  if (!referenceId || !externalId || !payerMsisdn) {
    throw new Error("Reference ID and external ID are required.");
  }

  await request({
    accessToken,
    subscriptionKey,
    path: "/collection/v1_0/requesttopay",
    method: "POST",
    body: {
      amount: String(amount),
      currency: String(currency).toUpperCase(),
      externalId: String(externalId),
      payer: { partyIdType: "MSISDN", partyId: String(payerMsisdn) },
      payerMessage,
      payeeNote
    }
  });

  return {
    accepted: true,
    referenceId: String(referenceId),
    status: "PENDING"
  };
}

async function getRequestToPayStatus({
  accessToken,
  subscriptionKey,
  referenceId
} = {}) {
  if (!referenceId) throw new Error("Reference ID is required.");

  return request({
    accessToken,
    subscriptionKey,
    path:
      "/collection/v1_0/requesttopay/" +
      encodeURIComponent(referenceId),
    method: "GET"
  });
}

async function transfer({
  accessToken,
  subscriptionKey,
  referenceId,
  amount,
  currency = "RWF",
  payeeId,
  payerMessage = "IRHCF payout",
  payeeNote = "IRHCF"
} = {}) {
  if (!referenceId || !payeeId) {
    throw new Error("Reference ID and payee ID are required.");
  }

  await request({
    accessToken,
    subscriptionKey,
    path: "/disbursement/v1_0/transfer",
    method: "POST",
    body: {
      amount: String(amount),
      currency: String(currency).toUpperCase(),
      externalId: String(referenceId),
      payee: {
        partyIdType: "MSISDN",
        partyId: String(payeeId)
      },
      payerMessage,
      payeeNote
    }
  });

  return {
    accepted: true,
    referenceId: String(referenceId),
    status: "PENDING"
  };
}

async function getTransferStatus({
  accessToken,
  subscriptionKey,
  referenceId
} = {}) {
  if (!referenceId) throw new Error("Reference ID is required.");

  return request({
    accessToken,
    subscriptionKey,
    path:
      "/disbursement/v1_0/transfer/" +
      encodeURIComponent(referenceId),
    method: "GET"
  });
}

module.exports = {
  BASE_URL,
  request,
  requestToPay,
  getRequestToPayStatus,
  transfer,
  getTransferStatus
};
