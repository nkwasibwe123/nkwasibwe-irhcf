"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { buildFfmpegArgs, editVideoFile } = require("./video-editor");

test("FFmpeg arguments include a real color filter and MP4 codec settings", () => {
  const args = buildFfmpegArgs("/tmp/input.mp4", "/tmp/output.mp4", {
    effect: "monochrome", startSeconds: 2, endSeconds: 8, outputFormat: "mp4"
  });
  assert.ok(args.includes("-vf"));
  assert.ok(args.includes("hue=s=0"));
  assert.ok(args.includes("-ss"));
  assert.ok(args.includes("2"));
  assert.ok(args.includes("-t"));
  assert.ok(args.includes("6"));
  assert.ok(args.includes("libx264"));
  assert.ok(args.includes("1920:1080:force_original_aspect_ratio=decrease"), "default export should render Full HD");
  assert.ok(args.includes("-crf"));
  assert.ok(args.includes("18"));
  assert.equal(args.at(-1), "/tmp/output.mp4");
});

test("fade-out requires an end time to calculate its filter", () => {
  assert.throws(
    () => buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", { effect: "fade-out" }),
    { code: "VIDEO_FADE_OUT_NEEDS_END" }
  );
});

test("output extension must match the selected format", () => {
  assert.throws(
    () => buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.webm", { outputFormat: "mp4" }),
    { code: "VIDEO_OUTPUT_EXTENSION_MISMATCH" }
  );
});

test("renderer rejects a missing input without spawning FFmpeg", async () => {
  await assert.rejects(
    editVideoFile({ inputPath: "/definitely/missing/input.mp4", outputPath: "/tmp/out.mp4", request: {} }),
    { code: "VIDEO_INPUT_NOT_FOUND" }
  );
});

test("renderer invokes FFmpeg and verifies a non-empty output", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-video-test-"));
  const inputPath = path.join(directory, "input.mp4");
  const outputPath = path.join(directory, "output.mp4");
  fs.writeFileSync(inputPath, "fixture");
  let capturedArgs;

  const fakeSpawn = (_command, args) => {
    capturedArgs = args;
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      fs.writeFileSync(args.at(-1), "rendered fixture");
      child.emit("close", 0);
    });
    return child;
  };

  try {
    const result = await editVideoFile({
      inputPath, outputPath,
      request: { effect: "warm", startSeconds: 0, endSeconds: 3, outputFormat: "mp4", quality: "720p" },
      spawn: fakeSpawn, timeoutMs: 1000
    });
    assert.equal(result.effect, "warm");
    assert.equal(result.outputFormat, "mp4");
    assert.equal(result.quality, "720p");
    assert.ok(fs.statSync(outputPath).size > 0);
    assert.ok(capturedArgs.includes("colorbalance=rs=0.10:gs=0.02:bs=-0.08"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("renderer explicitly rejects subtitle burn-in until implemented", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-video-test-"));
  const inputPath = path.join(directory, "input.mp4");
  fs.writeFileSync(inputPath, "fixture");
  try {
    await assert.rejects(
      editVideoFile({ inputPath, outputPath: path.join(directory, "out.mp4"), request: { subtitles: "hello" } }),
      { code: "VIDEO_SUBTITLES_NOT_IMPLEMENTED" }
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("renderer rejects unsupported HD export quality", () => {
  assert.throws(() => buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", { quality: "8k" }), { code: "VIDEO_QUALITY_UNSUPPORTED" });
});
