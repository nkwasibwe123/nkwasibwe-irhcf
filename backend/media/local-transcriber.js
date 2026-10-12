"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 180000;

function getLocalTranscriberConfig(env = process.env) {
  const binaryPath = String(env.WHISPER_CPP_PATH || "").trim();
  const modelPath = String(env.WHISPER_MODEL_PATH || "").trim();
  return {
    enabled: Boolean(binaryPath && modelPath),
    binaryPath,
    modelPath,
    timeoutMs: Math.max(10000, Math.min(Number(env.WHISPER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 600000)),
    threads: Math.max(1, Math.min(Number(env.WHISPER_THREADS) || 2, 16))
  };
}

function runWhisper(binaryPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const child = spawn(binaryPath, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const error = new Error("Local transcription exceeded its time limit.");
      error.code = "LOCAL_TRANSCRIPTION_TIMEOUT";
      finish(error);
    }, timeoutMs);
    child.stderr.on("data", chunk => {
      if (stderr.length < 12000) stderr += chunk.toString("utf8").slice(0, 12000 - stderr.length);
    });
    child.once("error", error => {
      error.code = error.code || "WHISPER_CPP_START_FAILED";
      finish(error);
    });
    child.once("close", code => {
      if (code !== 0) {
        const error = new Error("whisper.cpp exited unsuccessfully: " + stderr.slice(-1500));
        error.code = "LOCAL_TRANSCRIPTION_FAILED";
        return finish(error);
      }
      finish(null, { stderr });
    });
  });
}

async function transcribeLocally(audioBuffer, options = {}) {
  const config = options.config || getLocalTranscriberConfig();
  if (!config.enabled) {
    const error = new Error("Local multilingual transcription is not configured. Set WHISPER_CPP_PATH and WHISPER_MODEL_PATH.");
    error.code = "LOCAL_TRANSCRIBER_NOT_CONFIGURED";
    throw error;
  }
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0 || audioBuffer.length > MAX_AUDIO_BYTES) {
    const error = new Error("Audio must be a non-empty buffer no larger than 6 MB.");
    error.code = "AUDIO_SIZE_LIMIT";
    throw error;
  }

  const extension = String(options.extension || "wav").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExtension = new Set(["wav", "mp3", "m4a", "mp4", "mpeg", "mpga", "ogg", "flac", "webm"]).has(extension)
    ? extension
    : "wav";
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "irhcf-transcribe-"));
  const inputPath = path.join(directory, "input." + safeExtension);
  const outputBase = path.join(directory, "result");
  try {
    await fs.writeFile(inputPath, audioBuffer, { flag: "wx", mode: 0o600 });
    const language = String(options.language || "auto").toLowerCase();
    const allowedLanguage = /^[a-z]{2,3}$/.test(language) ? language : "auto";
    await runWhisper(config.binaryPath, [
      "-m", config.modelPath,
      "-f", inputPath,
      "-l", allowedLanguage,
      "-t", String(config.threads),
      "-oj",
      "-of", outputBase
    ], { timeoutMs: config.timeoutMs });

    const json = JSON.parse(await fs.readFile(outputBase + ".json", "utf8"));
    const segments = Array.isArray(json.transcription) ? json.transcription : [];
    const text = segments.map(segment => String(segment.text || "")).join("").trim()
      || String(json.text || "").trim();
    if (!text) {
      const error = new Error("Local speech recognition returned an empty transcript.");
      error.code = "TRANSCRIPTION_EMPTY";
      throw error;
    }
    return {
      text,
      language: json.result?.language || json.language || (allowedLanguage === "auto" ? null : allowedLanguage),
      model: "whisper.cpp-local",
      segments: segments.map(segment => ({
        start: Number.isFinite(segment.timestamps?.from) ? segment.timestamps.from : null,
        end: Number.isFinite(segment.timestamps?.to) ? segment.timestamps.to : null,
        text: String(segment.text || "")
      }))
    };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = {
  MAX_AUDIO_BYTES,
  getLocalTranscriberConfig,
  runWhisper,
  transcribeLocally
};
