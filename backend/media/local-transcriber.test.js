"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocalTranscriberConfig, MAX_AUDIO_BYTES } = require("./local-transcriber");

test("local transcriber is disabled unless both executable and model are configured", () => {
  assert.equal(getLocalTranscriberConfig({}).enabled, false);
  assert.equal(getLocalTranscriberConfig({ WHISPER_CPP_PATH: "/usr/bin/whisper-cli" }).enabled, false);
  assert.equal(getLocalTranscriberConfig({ WHISPER_MODEL_PATH: "/models/ggml-small.bin" }).enabled, false);
  assert.equal(getLocalTranscriberConfig({
    WHISPER_CPP_PATH: "/usr/bin/whisper-cli",
    WHISPER_MODEL_PATH: "/models/ggml-small.bin"
  }).enabled, true);
});

test("local transcription configuration bounds timeout and thread counts", () => {
  const config = getLocalTranscriberConfig({
    WHISPER_CPP_PATH: "/bin/whisper-cli",
    WHISPER_MODEL_PATH: "/models/model.bin",
    WHISPER_TIMEOUT_MS: "9999999",
    WHISPER_THREADS: "99"
  });
  assert.equal(config.timeoutMs, 600000);
  assert.equal(config.threads, 16);
});

test("local transcriber exposes a bounded audio size", () => {
  assert.equal(MAX_AUDIO_BYTES, 6 * 1024 * 1024);
});
