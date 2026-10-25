"use strict";

const { isIP } = require("node:net");

// Render currently sits behind Cloudflare. Cloudflare overwrites CF-Connecting-IP
// with the visitor IP. Never use the left-most X-Forwarded-For value for
// security decisions: Render preserves client-supplied XFF values and appends
// trusted proxy hops, so the left-most entry can be forged by a caller.
function getTrustedClientIP(req) {
  const candidate = req?.headers?.["cf-connecting-ip"];
  if (typeof candidate === "string") {
    const ip = candidate.trim();
    if (ip && isIP(ip)) return ip;
  }

  // Fail closed when the trusted edge header is missing/invalid. This may
  // aggregate traffic under the proxy IP, but it must not let a client pick
  // an arbitrary rate-limit identity using X-Forwarded-For.
  const socketAddress = req?.socket?.remoteAddress;
  return typeof socketAddress === "string" && socketAddress.trim()
    ? socketAddress.trim()
    : "unknown";
}

module.exports = { getTrustedClientIP };
