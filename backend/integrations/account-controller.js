"use strict";

/**
 * Connected-account controller.
 *
 * This is the security boundary for acting on a user's behalf on an
 * external platform. Credentials/tokens stay inside the injected provider.
 * IRHCF receives only opaque connection references and scoped operations.
 *
 * A provider may be backed by OAuth APIs, an approved browser/computer-use
 * runtime, or another platform-specific adapter.
 */

const ACTION_RISK = Object.freeze({
  read: "low",
  create: "medium",
  update: "medium",
  publish: "high",
  delete: "critical",
  financial: "critical",
  message: "high"
});

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function requireConnection(connection) {
  if (!connection || !connection.id) {
    const error = new Error("A connected account is required.");
    error.code = "ACCOUNT_CONNECTION_REQUIRED";
    throw error;
  }
  if (connection.status !== "active") {
    const error = new Error("The connected account is not active.");
    error.code = "ACCOUNT_CONNECTION_INACTIVE";
    throw error;
  }
}

function requireScope(connection, scope) {
  const scopes = Array.isArray(connection.scopes)
    ? connection.scopes.map(clean)
    : [];

  if (!scopes.includes(scope)) {
    const error = new Error("The connected account lacks the requested permission.");
    error.code = "ACCOUNT_SCOPE_REQUIRED";
    error.scope = scope;
    throw error;
  }
}

function buildApprovalRequest({
  connection,
  operation,
  target = null,
  reason = "",
  reversible = true
} = {}) {
  requireConnection(connection);

  const normalizedOperation = clean(operation, 80).toLowerCase();
  const risk = ACTION_RISK[normalizedOperation] || "high";

  return {
    required: risk === "high" || risk === "critical",
    risk,
    connectionId: connection.id,
    platform: clean(connection.platform, 80),
    operation: normalizedOperation,
    target: target ? clean(target, 500) : null,
    reason: clean(reason, 1000),
    reversible: Boolean(reversible),
    createdAt: new Date().toISOString()
  };
}

async function executeConnectedAction({
  connection,
  operation,
  scope,
  input = {},
  authorized = false,
  provider
} = {}) {
  requireConnection(connection);

  if (!scope) {
    const error = new Error("A permission scope is required.");
    error.code = "ACCOUNT_SCOPE_REQUIRED";
    throw error;
  }

  requireScope(connection, scope);

  const approval = buildApprovalRequest({
    connection,
    operation,
    target: input?.target || input?.url || null,
    reason: input?.reason || "User-authorized IRHCF action."
  });

  if (approval.required && !authorized) {
    const error = new Error("Explicit approval is required for this account action.");
    error.code = "ACCOUNT_APPROVAL_REQUIRED";
    error.approval = approval;
    throw error;
  }

  if (!provider || typeof provider.execute !== "function") {
    const error = new Error("No connected-account provider is configured.");
    error.code = "ACCOUNT_PROVIDER_UNAVAILABLE";
    throw error;
  }

  const result = await provider.execute({
    connectionId: connection.id,
    platform: connection.platform,
    operation: clean(operation, 80).toLowerCase(),
    scope,
    input
  });

  return {
    connectionId: connection.id,
    platform: connection.platform,
    operation: clean(operation, 80).toLowerCase(),
    approval,
    result
  };
}

function createConnectionDescriptor({
  id,
  userId,
  platform,
  scopes = [],
  status = "pending",
  providerType = "oauth"
} = {}) {
  if (!id || !userId || !platform) {
    throw new Error("Connection id, user id, and platform are required.");
  }

  return {
    id: clean(id, 255),
    userId,
    platform: clean(platform, 100),
    scopes: Array.from(new Set(scopes.map(clean).filter(Boolean))),
    status: clean(status, 30).toLowerCase(),
    providerType: clean(providerType, 50).toLowerCase(),
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  ACTION_RISK,
  createConnectionDescriptor,
  buildApprovalRequest,
  executeConnectedAction
};
