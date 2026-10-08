"use strict";

/**
 * Controlled browser/computer-use boundary.
 *
 * A concrete runtime may be OpenAI-hosted computer use, Playwright,
 * or another isolated browser implementation. This module keeps
 * account actions behind an allowlist and approval policy.
 */

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function validateBrowserRequest({
  url,
  allowedOrigins = [],
  action = "read",
  authorized = false
} = {}) {
  const origin = normalizeOrigin(url);
  const allowlist = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [])
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  if (!origin || !allowlist.has(origin)) {
    const error = new Error("Browser origin is not allowlisted.");
    error.code = "BROWSER_ORIGIN_BLOCKED";
    throw error;
  }

  const normalizedAction = String(action || "read").toLowerCase();
  const consequential =
    ["publish", "send", "delete", "purchase", "financial", "permission_change"]
      .includes(normalizedAction);

  if (consequential && !authorized) {
    const error = new Error("Explicit authorization is required for this browser action.");
    error.code = "BROWSER_APPROVAL_REQUIRED";
    throw error;
  }

  return {
    allowed: true,
    origin,
    action: normalizedAction,
    authorized: Boolean(authorized)
  };
}

async function runBrowserAction({
  runtime,
  url,
  allowedOrigins = [],
  action = "read",
  authorized = false,
  task,
  sessionId = null
} = {}) {
  validateBrowserRequest({
    url,
    allowedOrigins,
    action,
    authorized
  });

  if (!runtime || typeof runtime.run !== "function") {
    const error = new Error("No isolated browser runtime is configured.");
    error.code = "BROWSER_RUNTIME_UNAVAILABLE";
    throw error;
  }

  return runtime.run({
    url,
    task: String(task || "").slice(0, 10000),
    sessionId,
    action
  });
}

module.exports = {
  normalizeOrigin,
  validateBrowserRequest,
  runBrowserAction
};
