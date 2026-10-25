"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getVideoProviderStatus, SORA_API_RETIREMENT_DATE } = require("./video-provider-status");

test("retired Sora Videos API is reported unavailable instead of appearing ready", () => {
  const status = getVideoProviderStatus();
  assert.equal(SORA_API_RETIREMENT_DATE, "2026-09-24");
  assert.equal(status.available, false);
  assert.equal(status.provider, "openai_sora");
  assert.equal(status.code, "VIDEO_PROVIDER_RETIRED");
  assert.match(status.message, /retirement date/);
  assert.match(status.message, /replacement provider/);
});
