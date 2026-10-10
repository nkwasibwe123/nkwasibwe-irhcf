"use strict";

/**
 * Provider-neutral media contracts.
 *
 * Concrete image, audio/music and video providers are injected only when
 * configured. This prevents the platform from claiming a capability that
 * has no real provider behind it.
 */

const VIDEO_EFFECT_PRESETS = Object.freeze({
  none: Object.freeze({ filter: "none", label: "Original" }),
  cinematic: Object.freeze({ filter: "cinematic", label: "Cinematic grade" }),
  vintage: Object.freeze({ filter: "vintage", label: "Vintage film" }),
  monochrome: Object.freeze({ filter: "monochrome", label: "Black and white" }),
  warm: Object.freeze({ filter: "warm", label: "Warm tone" }),
  cool: Object.freeze({ filter: "cool", label: "Cool tone" }),
  vivid: Object.freeze({ filter: "vivid", label: "Vivid color" }),
  blur: Object.freeze({ filter: "blur", label: "Soft blur" }),
  sharpen: Object.freeze({ filter: "sharpen", label: "Sharpen" }),
  "fade-in": Object.freeze({ filter: "fade-in", label: "Fade in" }),
  "fade-out": Object.freeze({ filter: "fade-out", label: "Fade out" })
});

function mediaError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertProvider(provider, operation) {
  if (!provider || typeof provider[operation] !== "function") {
    throw mediaError(
      `Media provider does not support ${operation}.`,
      "MEDIA_PROVIDER_UNAVAILABLE"
    );
  }
}

function normalizeVideoEditRequest(request = {}) {
  const effect = String(request.effect || "none").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(VIDEO_EFFECT_PRESETS, effect)) {
    throw mediaError("Unsupported video effect preset.", "VIDEO_EFFECT_UNSUPPORTED");
  }

  const startSeconds = request.startSeconds == null ? 0 : Number(request.startSeconds);
  const endSeconds = request.endSeconds == null ? null : Number(request.endSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds > 86400) {
    throw mediaError("Video trim start must be between 0 and 86400 seconds.", "VIDEO_TRIM_INVALID");
  }
  if (endSeconds !== null &&
      (!Number.isFinite(endSeconds) || endSeconds <= startSeconds || endSeconds > 86400)) {
    throw mediaError("Video trim end must be greater than start and at most 86400 seconds.", "VIDEO_TRIM_INVALID");
  }

  const outputFormat = String(request.outputFormat || "mp4").trim().toLowerCase();
  if (!["mp4", "webm", "mov"].includes(outputFormat)) {
    throw mediaError("Unsupported video output format.", "VIDEO_FORMAT_UNSUPPORTED");
  }

  const subtitles = request.subtitles == null ? null : String(request.subtitles);
  if (subtitles && subtitles.length > 20000) {
    throw mediaError("Subtitle text exceeds the 20000 character limit.", "VIDEO_SUBTITLES_TOO_LONG");
  }

  return Object.freeze({
    ...request,
    effect,
    effectPreset: VIDEO_EFFECT_PRESETS[effect],
    startSeconds,
    endSeconds,
    outputFormat,
    subtitles
  });
}

async function generateImage(provider, request) {
  assertProvider(provider, "generateImage");
  return provider.generateImage(request);
}

async function generateMusic(provider, request) {
  assertProvider(provider, "generateMusic");
  return provider.generateMusic(request);
}

async function processAudio(provider, request) {
  assertProvider(provider, "processAudio");
  return provider.processAudio(request);
}

async function generateVideo(provider, request) {
  assertProvider(provider, "generateVideo");
  return provider.generateVideo(request);
}

async function editVideo(provider, request) {
  assertProvider(provider, "editVideo");
  return provider.editVideo(normalizeVideoEditRequest(request));
}

module.exports = {
  VIDEO_EFFECT_PRESETS,
  assertProvider,
  normalizeVideoEditRequest,
  generateImage,
  generateMusic,
  processAudio,
  generateVideo,
  editVideo
};
