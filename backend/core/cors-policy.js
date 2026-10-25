"use strict";

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://nkwasibwe-irhcf-web.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);

function parseAllowedOrigins(env = process.env) {
  const configured = String(env.IRHCF_CORS_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const values = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  const origins = new Set();

  for (const value of values) {
    try {
      const parsed = new URL(value);
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") &&
          parsed.origin === value.replace(/\/$/, "")) {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore malformed origin configuration rather than widening access.
    }
  }
  return origins;
}

function createCorsOriginPolicy(options = {}) {
  const allowedOrigins = parseAllowedOrigins(options.env || process.env);
  return function corsOriginPolicy(origin, callback) {
    // Native apps and server-to-server requests may not send Origin.
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.has(origin));
  };
}

module.exports = { DEFAULT_ALLOWED_ORIGINS, parseAllowedOrigins, createCorsOriginPolicy };
