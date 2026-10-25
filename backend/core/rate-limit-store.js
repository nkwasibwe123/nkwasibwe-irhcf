"use strict";

function pruneExpiredEntries(store, now, expiryMs) {
  for (const [key, entry] of store) {
    if (!entry || !Number.isFinite(entry.startedAt) || now - entry.startedAt > expiryMs) {
      store.delete(key);
    }
  }
}

function checkRateLimitEntry(store, key, limit, now = Date.now(), {
  windowMs = 60_000,
  maxEntries = 100_000
} = {}) {
  if (!(store instanceof Map)) throw new TypeError("Rate-limit store must be a Map.");
  const safeLimit = Math.max(1, Math.trunc(Number(limit) || 1));
  const safeWindowMs = Math.max(1, Math.trunc(Number(windowMs) || 60_000));
  const safeMaxEntries = Math.max(1, Math.trunc(Number(maxEntries) || 100_000));
  let current = store.get(key);

  if (!current && store.size >= safeMaxEntries) {
    pruneExpiredEntries(store, now, safeWindowMs * 2);
    current = store.get(key);
    if (!current && store.size >= safeMaxEntries) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(safeWindowMs / 1000),
        code: "RATE_LIMIT_STORE_FULL"
      };
    }
  }

  if (!current || now - current.startedAt > safeWindowMs) {
    store.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: Math.max(0, safeLimit - 1) };
  }

  current.count += 1;
  if (current.count > safeLimit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((safeWindowMs - (now - current.startedAt)) / 1000),
      code: "RATE_LIMITED"
    };
  }

  return { allowed: true, remaining: Math.max(0, safeLimit - current.count) };
}

module.exports = { checkRateLimitEntry, pruneExpiredEntries };
