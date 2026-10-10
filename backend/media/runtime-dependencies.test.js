"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("OpenAI SDK exposes the upload helper used by audio transcription", () => {
  const uploads = require("openai/uploads");
  assert.equal(typeof uploads.toFile, "function");
});

test("bundled FFmpeg runtime is installed for server-side Studio rendering", () => {
  const ffmpegPath = require("ffmpeg-static");
  assert.equal(typeof ffmpegPath, "string");
  assert.ok(ffmpegPath.length > 0);
  assert.ok(fs.existsSync(ffmpegPath), "FFmpeg binary must exist after dependency installation.");
});
