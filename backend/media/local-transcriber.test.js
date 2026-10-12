"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocalTranscriberConfig, getLocalTranscriberStatus, timestampToSeconds, normalizeTranscriptionLanguage, MAX_AUDIO_BYTES } = require("./local-transcriber");

test("partial local configuration fails closed instead of silently falling back to a paid provider", () => {
  assert.equal(getLocalTranscriberConfig({}).enabled, false);
  assert.equal(getLocalTranscriberConfig({ WHISPER_CPP_PATH: "/usr/bin/whisper-cli" }).enabled, true);
  assert.equal(getLocalTranscriberConfig({ WHISPER_MODEL_PATH: "/models/ggml-small.bin" }).enabled, true);
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

test("runtime status reports missing local artifacts without exposing filesystem paths", () => {
  const status = getLocalTranscriberStatus({
    WHISPER_CPP_PATH: "/definitely/missing/whisper-cli",
    WHISPER_MODEL_PATH: "/definitely/missing/model.bin"
  });
  assert.equal(status.configured, true);
  assert.equal(status.ready, false);
  assert.equal(status.binaryAvailable, false);
  assert.equal(status.modelAvailable, false);
  assert.equal(status.model, "model.bin");
  assert.equal(Object.hasOwn(status, "binaryPath"), false);
  assert.equal(Object.hasOwn(status, "modelPath"), false);
});

test("whisper.cpp timestamp strings are normalized to numeric seconds", () => {
  assert.equal(timestampToSeconds("00:00:01.250"), 1.25);
  assert.equal(timestampToSeconds("00:02:03.500"), 123.5);
  assert.equal(timestampToSeconds(2.75), 2.75);
  assert.equal(timestampToSeconds("invalid"), null);
});

test("multilingual transcription defaults to automatic spoken-language detection", () => {
  assert.equal(normalizeTranscriptionLanguage(undefined), "auto");
  assert.equal(normalizeTranscriptionLanguage(""), "auto");
  assert.equal(normalizeTranscriptionLanguage("auto"), "auto");
  assert.equal(normalizeTranscriptionLanguage(" AUTO "), "auto");
});

test("multilingual transcription respects a valid explicitly selected language", () => {
  assert.equal(normalizeTranscriptionLanguage("rw"), "rw");
  assert.equal(normalizeTranscriptionLanguage("fr"), "fr");
  assert.equal(normalizeTranscriptionLanguage("eng"), "eng");
  assert.equal(normalizeTranscriptionLanguage(" FR "), "fr");
});

test("invalid language values fall back safely to automatic detection", () => {
  assert.equal(normalizeTranscriptionLanguage("french"), "auto");
  assert.equal(normalizeTranscriptionLanguage("en-US"), "auto");
  assert.equal(normalizeTranscriptionLanguage("1"), "auto");
});
