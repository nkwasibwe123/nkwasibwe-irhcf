"use strict";

/**
 * Provider-neutral payment contract. Concrete MTN MoMo, Airtel Money,
 * bank/open-banking, or licensed aggregator adapters are injected at runtime.
 */

function assertProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Payment provider is required.");
  }
}

async function collect(provider, request) {
  assertProvider(provider);
  if (typeof provider.collect !== "function") {
    throw new Error("Payment provider does not support collection.");
  }
  return provider.collect(request);
}

async function status(provider, request) {
  assertProvider(provider);
  if (typeof provider.status !== "function") {
    throw new Error("Payment provider does not support status checks.");
  }
  return provider.status(request);
}

async function payout(provider, request) {
  assertProvider(provider);
  if (typeof provider.payout !== "function") {
    throw new Error("Payment provider does not support payout.");
  }
  return provider.payout(request);
}

function createMomoPaymentProvider({
  credentials,
  requestToPay,
  getRequestToPayStatus,
  transfer,
  getTransferStatus
} = {}) {
  if (!credentials) {
    throw new Error("Payment provider credentials are required.");
  }

  return {
    name: "mtn_momo",

    async collect(request) {
      return requestToPay({
        ...credentials,
        ...request
      });
    },

    async status(request) {
      return getRequestToPayStatus({
        ...credentials,
        ...request
      });
    },

    async payout(request) {
      return transfer({
        ...credentials,
        ...request
      });
    },

    async payoutStatus(request) {
      return getTransferStatus({
        ...credentials,
        ...request
      });
    }
  };
}

module.exports = {
  collect,
  status,
  payout,
  createMomoPaymentProvider
};
