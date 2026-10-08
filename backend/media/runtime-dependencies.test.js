"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("OpenAI SDK exposes the upload helper used by audio transcription", () => {
  const uploads = require("openai/uploads");
  assert.equal(typeof uploads.toFile, "function");
});
