"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn: defaultSpawn } = require("node:child_process");
const bundledFfmpegPath = require("ffmpeg-static");

const AUDIO_EFFECTS = Object.freeze({
  clean: "highpass=f=70,lowpass=f=16000,loudnorm=I=-16:TP=-1.5:LRA=11",
  normalize: "loudnorm=I=-16:TP=-1.5:LRA=11",
  voice: "highpass=f=90,lowpass=f=12000,equalizer=f=2500:width_type=o:width=1:g=2,loudnorm=I=-16:TP=-1.5:LRA=11",
  bass: "equalizer=f=100:width_type=o:width=2:g=4,loudnorm=I=-16:TP=-1.5:LRA=11",
  clarity: "equalizer=f=3000:width_type=o:width=1:g=3,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11",
  reverb: "aecho=0.8:0.88:60:0.35,loudnorm=I=-16:TP=-1.5:LRA=11"
});

const OUTPUT_OPTIONS = Object.freeze({
  mp3: ["-c:a", "libmp3lame", "-b:a", "192k"],
  wav: ["-c:a", "pcm_s16le"],
  ogg: ["-c:a", "libvorbis", "-q:a", "5"],
  m4a: ["-c:a", "aac", "-b:a", "192k"]
});

function audioError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeAudioEditRequest(request = {}) {
  const effect = String(request.effect || "clean").toLowerCase();
  const outputFormat = String(request.outputFormat || "mp3").toLowerCase();
  const startSeconds = Number(request.startSeconds || 0);
  const endSeconds = request.endSeconds === null || request.endSeconds === undefined || request.endSeconds === ""
    ? null : Number(request.endSeconds);
  if (!Object.hasOwn(AUDIO_EFFECTS, effect)) {
    throw audioError("Unsupported audio effect preset.", "AUDIO_EFFECT_INVALID");
  }
  if (!Object.hasOwn(OUTPUT_OPTIONS, outputFormat)) {
    throw audioError("Unsupported audio output format.", "AUDIO_FORMAT_INVALID");
  }
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds > 3600) {
    throw audioError("startSeconds must be between 0 and 3600.", "AUDIO_TRIM_INVALID");
  }
  if (endSeconds !== null && (!Number.isFinite(endSeconds) || endSeconds <= startSeconds || endSeconds > 3600)) {
    throw audioError("endSeconds must be greater than startSeconds and at most 3600.", "AUDIO_TRIM_INVALID");
  }
  return { effect, outputFormat, startSeconds, endSeconds };
}

function buildAudioFfmpegArgs(inputPath, outputPath, request = {}) {
  const normalized = normalizeAudioEditRequest(request);
  if (path.extname(outputPath).slice(1).toLowerCase() !== normalized.outputFormat) {
    throw audioError("Output filename extension must match outputFormat.", "AUDIO_OUTPUT_EXTENSION_MISMATCH");
  }
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath];
  if (normalized.startSeconds > 0) args.push("-ss", String(normalized.startSeconds));
  if (normalized.endSeconds !== null) args.push("-t", String(normalized.endSeconds - normalized.startSeconds));
  const filter = AUDIO_EFFECTS[normalized.effect];
  if (filter) args.push("-af", filter);
  args.push(...OUTPUT_OPTIONS[normalized.outputFormat], "-vn", outputPath);
  return args;
}

function editAudioFile({ inputPath, outputPath, request, spawn = defaultSpawn, timeoutMs = 120000 } = {}) {
  if (!inputPath || !outputPath) {
    return Promise.reject(audioError("Input and output paths are required.", "AUDIO_PATH_REQUIRED"));
  }
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    return Promise.reject(audioError("Input audio file does not exist.", "AUDIO_INPUT_NOT_FOUND"));
  }
  let args;
  try {
    args = buildAudioFfmpegArgs(inputPath, outputPath, request);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (!fs.existsSync(outputPath) || !fs.statSync(outputPath).size) {
        reject(audioError("FFmpeg completed without producing an audio file.", "AUDIO_OUTPUT_EMPTY"));
      } else resolve({ outputPath, outputFormat: normalizeAudioEditRequest(request).outputFormat, effect: normalizeAudioEditRequest(request).effect });
    };
    const timer = setTimeout(() => {
      if (child && typeof child.kill === "function") child.kill("SIGKILL");
      finish(audioError("Audio processing timed out.", "AUDIO_PROCESS_TIMEOUT"));
    }, timeoutMs);
    try {
      child = spawn(bundledFfmpegPath || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
      finish(audioError(error.message || "Could not start FFmpeg.", "AUDIO_FFMPEG_START_FAILED"));
      return;
    }
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-3000); });
    child.once("error", error => finish(audioError(error.message || "FFmpeg process failed.", "AUDIO_FFMPEG_PROCESS_FAILED")));
    child.once("close", code => {
      if (code !== 0) finish(audioError(stderr || `FFmpeg exited with code ${code}.`, "AUDIO_FFMPEG_RENDER_FAILED"));
      else finish(null);
    });
  });
}

module.exports = { AUDIO_EFFECTS, normalizeAudioEditRequest, buildAudioFfmpegArgs, editAudioFile };
