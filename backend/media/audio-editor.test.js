"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { AUDIO_EFFECTS, normalizeAudioEditRequest, buildAudioFfmpegArgs, editAudioFile } = require("./audio-editor");

test("audio studio exposes bounded, explicit effect presets and formats", () => {
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "clean"));
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "normalize"));
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "voice"));
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "bass"));
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "clarity"));
  assert.ok(Object.hasOwn(AUDIO_EFFECTS, "reverb"));
  assert.deepEqual(normalizeAudioEditRequest({ effect: "voice", outputFormat: "wav" }), {
    effect: "voice", outputFormat: "wav", startSeconds: 0, endSeconds: null
  });
});

test("audio studio rejects unknown presets, formats, invalid trim and mismatched output extension", () => {
  assert.throws(() => normalizeAudioEditRequest({ effect: "shell;rm" }), { code: "AUDIO_EFFECT_INVALID" });
  assert.throws(() => normalizeAudioEditRequest({ outputFormat: "exe" }), { code: "AUDIO_FORMAT_INVALID" });
  assert.throws(() => normalizeAudioEditRequest({ startSeconds: -1 }), { code: "AUDIO_TRIM_INVALID" });
  assert.throws(() => normalizeAudioEditRequest({ startSeconds: 5, endSeconds: 4 }), { code: "AUDIO_TRIM_INVALID" });
  assert.throws(() => buildAudioFfmpegArgs("/tmp/in.wav", "/tmp/out.wav", { outputFormat: "mp3" }), { code: "AUDIO_OUTPUT_EXTENSION_MISMATCH" });
});

test("audio FFmpeg arguments apply selected filter, trim and safe output codec", () => {
  const args = buildAudioFfmpegArgs("/tmp/in.wav", "/tmp/out.mp3", {
    effect: "voice", startSeconds: 1, endSeconds: 5, outputFormat: "mp3"
  });
  assert.ok(args.includes("-af"));
  assert.ok(args.some(value => value.includes("highpass=f=90")));
  assert.ok(args.includes("-ss"));
  assert.ok(args.includes("1"));
  assert.ok(args.includes("-t"));
  assert.ok(args.includes("4"));
  assert.ok(args.includes("libmp3lame"));
  assert.ok(args.includes("-vn"));
});

test("audio renderer rejects a missing input file", async () => {
  await assert.rejects(
    editAudioFile({ inputPath: "/path/that/does/not/exist.wav", outputPath: "/tmp/out.mp3", request: { outputFormat: "mp3" } }),
    { code: "AUDIO_INPUT_NOT_FOUND" }
  );
});

test("FFmpeg integration renders a real normalized audio file", { skip: !ffmpegPath }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-audio-test-"));
  const inputPath = path.join(dir, "input.wav");
  const outputPath = path.join(dir, "output.mp3");
  try {
    const generated = spawnSync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-c:a", "pcm_s16le", inputPath
    ], { encoding: "utf8", timeout: 30000 });
    if (generated.status !== 0) throw new Error(generated.stderr || "Could not generate test tone.");
    const result = await editAudioFile({
      inputPath, outputPath,
      request: { effect: "normalize", outputFormat: "mp3" },
      timeoutMs: 30000
    });
    assert.equal(result.outputFormat, "mp3");
    assert.ok(fs.statSync(outputPath).size > 1000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
