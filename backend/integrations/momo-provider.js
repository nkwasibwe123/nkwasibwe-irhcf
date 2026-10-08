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

module.exports = { BASE_URL, request };
