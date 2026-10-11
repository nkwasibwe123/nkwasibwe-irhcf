"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { editVideoFile, VIDEO_FILTERS } = require("./video-editor");

const ffmpegAvailable = typeof ffmpegPath === "string" && fs.existsSync(ffmpegPath);

function runFfmpeg(args, timeout = 30000) {
  return spawnSync(ffmpegPath, args, { encoding: "utf8", timeout });
}

test("bundled FFmpeg renders every supported video effect to a decodable MP4", {
  skip: !ffmpegAvailable ? "Bundled FFmpeg is unavailable in this test environment." : false,
  timeout: 180000
}, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-real-video-"));
  const inputPath = path.join(directory, "source.mp4");
  try {
    const fixture = runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=red:s=160x120:r=12:d=2",
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
      inputPath
    ]);
    assert.equal(fixture.status, 0, "FFmpeg must create the synthetic source clip: " + fixture.stderr);
    assert.ok(fs.statSync(inputPath).size > 0, "synthetic source clip must not be empty");

    for (const effect of Object.keys(VIDEO_FILTERS)) {
      const outputPath = path.join(directory, effect.replace(/[^a-z0-9-]/gi, "_") + ".mp4");
      const rendered = await editVideoFile({
        inputPath,
        outputPath,
        request: { effect, startSeconds: 0, endSeconds: 1.5, outputFormat: "mp4" },
        timeoutMs: 15000
      });
      assert.equal(rendered.effect, effect);
      assert.ok(fs.statSync(outputPath).size > 0, effect + " should produce a real output file");

      const decoded = runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-i", outputPath, "-f", "null", "-"
      ], 15000);
      assert.equal(decoded.status, 0, effect + " output should be decodable: " + decoded.stderr);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
