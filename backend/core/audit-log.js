"use strict";

/**
 * Structured audit event factory. Persistence is injected by the server.
 */

const SENSITIVE_KEYS = new Set([
  "accessToken","refreshToken","clientSecret","apiKey","password","authorization"
]);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redact(item);
  }
  return output;
}

function createAuditEvent({
  userId = null,
  action,
  status,
  taskId = null,
  provider = null,
  metadata = {}
} = {}) {
  return {
    id: "audit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
    userId,
    action,
    status,
    taskId,
    provider,
    metadata: redact(metadata),
    createdAt: new Date().toISOString()
  };
}

module.exports = { redact, createAuditEvent };
