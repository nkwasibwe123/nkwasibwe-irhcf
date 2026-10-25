"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn: defaultSpawn } = require("node:child_process");
const bundledFfmpegPath = require("ffmpeg-static");
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
  mp4: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"],
  webm: ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "6", "-c:a", "libopus"],
  mov: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac"]
});

function mediaError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function escapeSubtitleFilterPath(filePath) {
  return String(filePath)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildSubtitleContent(value) {
  const content = String(value || "").replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
  if (!content) return null;
  if (/^WEBVTT(?:\s|$)/i.test(content) ||
      /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)) {
    return { content, extension: /^WEBVTT(?:\s|$)/i.test(content) ? "vtt" : "srt" };
  }
  const caption = content.split("\n").map(line => line.trim()).filter(Boolean).join("\n").replace(/-->/g, "—>");
  return { content: "1\n00:00:00,000 --> 23:59:59,999\n" + caption + "\n", extension: "srt" };
}

function buildFfmpegArgs(inputPath, outputPath, request, subtitlePath = null) {
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
  if (normalized.subtitles && subtitlePath) {
    filters.push("subtitles=filename=" + escapeSubtitleFilterPath(subtitlePath) + ":force_style=FontSize=24");
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
  let args;
  let subtitleDirectory = null;
  try {
    let subtitlePath = null;
    if (normalized.subtitles) {
      const subtitle = buildSubtitleContent(normalized.subtitles);
      if (!subtitle) throw mediaError("Subtitle content cannot be empty.", "VIDEO_SUBTITLES_EMPTY");
      subtitleDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-video-subtitles-"));
      subtitlePath = path.join(subtitleDirectory, "captions." + subtitle.extension);
      fs.writeFileSync(subtitlePath, subtitle.content, { flag: "wx", mode: 0o600 });
    }
    args = buildFfmpegArgs(inputPath, outputPath, normalized, subtitlePath);
  } catch (error) {
    if (subtitleDirectory) {
      try { fs.rmSync(subtitleDirectory, { recursive: true, force: true }); } catch {}
    }
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (subtitleDirectory) {
        try { fs.rmSync(subtitleDirectory, { recursive: true, force: true }); } catch {}
      }
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
      child = spawn(bundledFfmpegPath || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
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

module.exports = { VIDEO_FILTERS, OUTPUT_OPTIONS, escapeSubtitleFilterPath, buildSubtitleContent, buildFfmpegArgs, editVideoFile };
