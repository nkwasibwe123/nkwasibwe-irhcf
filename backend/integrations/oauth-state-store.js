"use strict";

/**
 * Atomically consumes a one-time OAuth state.
 *
 * A SELECT followed by a later UPDATE is race-prone: concurrent callback
 * requests can both read the same unconsumed row. A conditional UPDATE with
 * RETURNING lets the database grant the state to at most one callback.
 */
async function consumeOAuthState(pool, stateHash) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("A database query client is required.");
  }
  if (!stateHash) {
    throw new Error("An OAuth state hash is required.");
  }

  const result = await pool.query(
    `UPDATE oauth_states
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE state_hash = $1
       AND consumed_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING *`,
    [stateHash]
  );

  return result.rows[0] || null;
}

module.exports = { consumeOAuthState };
