"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { spawnSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { spawnSync } = require("node:child_process");
const { buildFfmpegArgs, buildSubtitleContent, escapeSubtitleFilterPath, editVideoFile } = require("./video-editor");

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
      request: { effect: "warm", startSeconds: 0, endSeconds: 3, outputFormat: "mp4" },
      spawn: fakeSpawn, timeoutMs: 1000
    });
    assert.equal(result.effect, "warm");
    assert.equal(result.outputFormat, "mp4");
    assert.ok(fs.statSync(outputPath).size > 0);
    assert.ok(capturedArgs.includes("colorbalance=rs=0.10:gs=0.02:bs=-0.08"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("plain caption text is safely converted to a full-duration SRT cue", () => {
  const result = buildSubtitleContent("Hello\nNkwasibwe");
  assert.equal(result.extension, "srt");
  assert.match(result.content, /00:00:00,000 --> 23:59:59,999/);
  assert.match(result.content, /Hello\nNkwasibwe/);
});

test("authored SRT and WebVTT timing data is preserved", () => {
  const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello";
  assert.deepEqual(buildSubtitleContent(srt), { content: srt, extension: "srt" });
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello";
  assert.deepEqual(buildSubtitleContent(vtt), { content: vtt, extension: "vtt" });
});

test("FFmpeg arguments combine the selected effect with subtitle burn-in", () => {
  const args = buildFfmpegArgs("/tmp/input.mp4", "/tmp/output.mp4", { effect: "monochrome", subtitles: "Hello" }, "/tmp/captions.srt");
  const filterIndex = args.indexOf("-vf");
  assert.ok(filterIndex >= 0);
  assert.match(args[filterIndex + 1], /hue=s=0/);
  assert.match(args[filterIndex + 1], /subtitles=filename=/);
  assert.match(args[filterIndex + 1], /FontSize=24/);
});

test("subtitle filter paths escape filtergraph punctuation", () => {
  assert.equal(escapeSubtitleFilterPath("/tmp/a,b:c.srt"), "/tmp/a\\,b\\:c.srt");
});

test("renderer rejects empty subtitle content safely", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-video-test-"));
  const inputPath = path.join(directory, "input.mp4");
  fs.writeFileSync(inputPath, "fixture");
  try {
    await assert.rejects(
      editVideoFile({ inputPath, outputPath: path.join(directory, "out.mp4"), request: { subtitles: "   " } }),
      { code: "VIDEO_SUBTITLES_EMPTY" }
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("real FFmpeg burns captions into a playable MP4 when subtitle filters are available", {
  skip: !ffmpegPath
}, async t => {
  const filterProbe = spawnSync(ffmpegPath, ["-hide_banner", "-filters"], { encoding: "utf8", timeout: 15000 });
  if (filterProbe.status !== 0 || !/\bsubtitles\s+V->V\b/.test((filterProbe.stdout || "") + (filterProbe.stderr || ""))) {
    t.skip("Bundled FFmpeg does not include the libass subtitles filter.");
    return;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-video-subtitle-real-"));
  const inputPath = path.join(directory, "input.mp4");
  const outputPath = path.join(directory, "captioned.mp4");
  try {
    const created = spawnSync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=320x240:d=2",
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", inputPath
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(created.status, 0, created.stderr || "Could not create FFmpeg integration fixture.");
    const result = await editVideoFile({
      inputPath,
      outputPath,
      request: { effect: "monochrome", subtitles: "Nkwasibwe IRHCF captions", outputFormat: "mp4" },
      timeoutMs: 30000
    });
    assert.equal(result.outputFormat, "mp4");
    assert.ok(fs.statSync(outputPath).size > 1000);
    assert.equal(fs.readFileSync(outputPath).toString("ascii", 4, 8), "ftyp");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

