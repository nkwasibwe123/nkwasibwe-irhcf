"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn: defaultSpawn } = require("node:child_process");
const { normalizeVideoEditRequest } = require("./provider-contract");

const VIDEO_FILTERS = Object.freeze({
  none: null,
  cinematic: "eq=contrast=1.12:saturation=1.18:gamma=0.98",
  vintage: "colorbalance=rs=0.08:gs=0.02:bs=-0.06,eq=saturation=0.72:contrast=0.92",
  monochrome: "hue=s=0",
  warm: "colorbalance=rs=0.10:gs=0.02:bs=-0.08",
  cool: "colorbalance=rs=-0.06:gs=0.01:bs=0.10",
  vivid: "eq=saturation=1.45:contrast=1.08",
  blur: "gblur=sigma=2",
  sharpen: "unsharp=5:5:0.8:3:3:0.4",
  "fade-in": "fade=t=in:st=0:d=1",
  "fade-out": null
});

const OUTPUT_OPTIONS = Object.freeze({
  mp4: ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
  webm: ["-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2", "-crf", "30", "-b:v", "0", "-c:a", "libopus", "-b:a", "160k"],
  mov: ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k"]
});

function mediaError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildFfmpegArgs(inputPath, outputPath, request) {
  const normalized = normalizeVideoEditRequest(request);
  const ext = path.extname(outputPath).slice(1).toLowerCase();
  if (ext !== normalized.outputFormat) {
    throw mediaError("Output filename extension must match outputFormat.", "VIDEO_OUTPUT_EXTENSION_MISMATCH");
  }

  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath];
  if (normalized.startSeconds > 0) args.push("-ss", String(normalized.startSeconds));
  if (normalized.endSeconds !== null) {
    args.push("-t", String(normalized.endSeconds - normalized.startSeconds));
  }

  const filters = [];
  const dimensions = normalized.quality === "720p" ? "1280:720" : "1920:1080";
  filters.push("scale=" + dimensions + ":force_original_aspect_ratio=decrease", "pad=" + dimensions + ":(ow-iw)/2:(oh-ih)/2");
  const presetFilter = VIDEO_FILTERS[normalized.effect];
  if (presetFilter) filters.push(presetFilter);
  if (normalized.effect === "fade-out") {
    if (normalized.endSeconds === null) {
      throw mediaError("fade-out requires endSeconds so its duration can be calculated.", "VIDEO_FADE_OUT_NEEDS_END");
    }
    const duration = normalized.endSeconds - normalized.startSeconds;
    const fadeDuration = Math.min(1, duration);
    filters.push("fade=t=out:st=" + Math.max(0, duration - fadeDuration) + ":d=" + fadeDuration);
  }
  if (filters.length) args.push("-vf", filters.join(","));
  args.push(...OUTPUT_OPTIONS[normalized.outputFormat], "-shortest", outputPath);
  return args;
}

function editVideoFile({ inputPath, outputPath, request, spawn = defaultSpawn, timeoutMs = 180000 } = {}) {
  if (!inputPath || !outputPath) {
    return Promise.reject(mediaError("Input and output paths are required.", "VIDEO_PATH_REQUIRED"));
  }
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    return Promise.reject(mediaError("Input video file does not exist.", "VIDEO_INPUT_NOT_FOUND"));
  }
  const normalized = normalizeVideoEditRequest(request);
  if (normalized.subtitles) {
    return Promise.reject(mediaError("Subtitle burn-in is not enabled in this renderer yet.", "VIDEO_SUBTITLES_NOT_IMPLEMENTED"));
  }

  let args;
  try {
    args = buildFfmpegArgs(inputPath, outputPath, normalized);
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (!fs.existsSync(outputPath) || !fs.statSync(outputPath).size) {
        reject(mediaError("FFmpeg completed without producing an output file.", "VIDEO_OUTPUT_EMPTY"));
      } else resolve({ outputPath, outputFormat: normalized.outputFormat, effect: normalized.effect });
    };

    const timer = setTimeout(() => {
      if (child && typeof child.kill === "function") child.kill("SIGKILL");
      finish(mediaError("Video rendering timed out.", "VIDEO_RENDER_TIMEOUT"));
    }, timeoutMs);

    try {
      child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
      finish(mediaError("FFmpeg is not available on this server.", "FFMPEG_UNAVAILABLE"));
      return;
    }

    let stderr = "";
    child.stderr?.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
    child.on("error", error => {
      finish(mediaError(
        error?.code === "ENOENT" ? "FFmpeg is not installed on this server." : "Could not start FFmpeg.",
        "FFMPEG_UNAVAILABLE"
      ));
    });
    child.on("close", code => {
      if (code !== 0) {
        finish(mediaError("FFmpeg render failed: " + stderr.slice(-800), "VIDEO_RENDER_FAILED"));
        return;
      }
      finish(null);
    });
  });
}

module.exports = { VIDEO_FILTERS, OUTPUT_OPTIONS, buildFfmpegArgs, editVideoFile };
