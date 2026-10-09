"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { consumeOAuthState } = require("./oauth-state-store");

test("consumeOAuthState atomically claims a valid, unused state", async () => {
  const expected = {
    id: 17,
    user_id: 42,
    platform: "youtube",
    redirect_uri: "https://example.test/callback"
  };
  let callCount = 0;
  const pool = {
    async query(sql, values) {
      callCount += 1;
      assert.match(sql, /UPDATE\s+oauth_states/i);
      assert.match(sql, /consumed_at\s+IS\s+NULL/i);
      assert.match(sql, /expires_at\s*>\s*CURRENT_TIMESTAMP/i);
      assert.match(sql, /RETURNING\s+\*/i);
      assert.deepEqual(values, ["state-hash"]);
      return { rows: [expected] };
    }
  };

  assert.deepEqual(await consumeOAuthState(pool, "state-hash"), expected);
  assert.equal(callCount, 1);
});

test("consumeOAuthState returns null when the state was already used or expired", async () => {
  const pool = { async query() { return { rows: [] }; } };
  assert.equal(await consumeOAuthState(pool, "state-hash"), null);
});

test("consumeOAuthState rejects missing database clients and hashes", async () => {
  await assert.rejects(() => consumeOAuthState(null, "state-hash"), /database query client/i);
  await assert.rejects(() => consumeOAuthState({ query() {} }, ""), /state hash/i);
});
