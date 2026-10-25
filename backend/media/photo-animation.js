"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn: defaultSpawn } = require("node:child_process");
const bundledFfmpegPath = require("ffmpeg-static");

const ALLOWED_MOTIONS = new Set(["zoom-in", "zoom-out", "pan-left", "pan-right"]);
const ALLOWED_SIZES = new Set(["1280x720", "720x1280"]);
const ALLOWED_DURATIONS = new Set([4, 8, 12]);

function photoError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validatePhotoDimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 8192 || height > 8192 ||
      width * height > 40_000_000) {
    throw photoError("Photo dimensions are invalid or exceed the 40-megapixel safety limit.", "PHOTO_IMAGE_DIMENSIONS_INVALID");
  }
  return { width, height };
}

function jpegDimensions(buffer) {
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) break;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xda) break;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (startOfFrame.has(marker)) {
      if (length < 7) break;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return validatePhotoDimensions(width, height);
    }
    offset += length;
  }
  throw photoError("Could not read JPEG dimensions.", "PHOTO_IMAGE_DIMENSIONS_INVALID");
}

function webpDimensions(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return validatePhotoDimensions(
      1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    );
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
    return validatePhotoDimensions(
      1 + (b1 | ((b2 & 0x3f) << 8)),
      1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
    );
  }
  if (chunk === "VP8 " && buffer.length >= 30 &&
      buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return validatePhotoDimensions(buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
  }
  throw photoError("Could not read WEBP dimensions.", "PHOTO_IMAGE_DIMENSIONS_INVALID");
}

function detectPhotoImageType(mimeType, buffer) {
  const type = String(mimeType || "").toLowerCase();
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw photoError("Choose a non-empty photo.", "PHOTO_IMAGE_INVALID");
  }
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.toString("ascii", 12, 16) === "IHDR";
  const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (type === "image/jpeg" && isJpeg) { jpegDimensions(buffer); return "jpg"; }
  if (type === "image/png" && isPng) { validatePhotoDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20)); return "png"; }
  if (type === "image/webp" && isWebp) { webpDimensions(buffer); return "webp"; }
  throw photoError("The declared photo type does not match a supported JPEG, PNG or WEBP file.", "PHOTO_IMAGE_INVALID");
}

function buildPhotoAnimationArgs(inputPath, outputPath, {
  durationSeconds = 8,
  motion = "zoom-in",
  size = "1280x720"
} = {}) {
  if (!inputPath || !outputPath) throw photoError("Input and output paths are required.", "PHOTO_ANIMATION_PATH_REQUIRED");
  if (path.extname(outputPath).toLowerCase() !== ".mp4") throw photoError("Photo animation output must be an MP4 file.", "PHOTO_ANIMATION_OUTPUT_FORMAT");
  if (!ALLOWED_DURATIONS.has(Number(durationSeconds))) throw photoError("Duration must be 4, 8 or 12 seconds.", "PHOTO_ANIMATION_DURATION_INVALID");
  if (!ALLOWED_MOTIONS.has(String(motion))) throw photoError("Choose zoom-in, zoom-out, pan-left or pan-right.", "PHOTO_ANIMATION_MOTION_INVALID");
  if (!ALLOWED_SIZES.has(String(size))) throw photoError("Choose 720p landscape or portrait output.", "PHOTO_ANIMATION_SIZE_INVALID");

  const [width, height] = String(size).split("x").map(Number);
  const fps = 30;
  const frames = Number(durationSeconds) * fps;
  let zoom = "min(1+on*0.0005,1.12)";
  let x = "iw/2-(iw/zoom/2)";
  let y = "ih/2-(ih/zoom/2)";
  if (motion === "zoom-out") zoom = "max(1.12-on*0.0005,1)";
  if (motion === "pan-left") {
    zoom = "1.12";
    x = "(iw-iw/zoom)*(1-on/" + Math.max(1, frames - 1) + ")";
  }
  if (motion === "pan-right") {
    zoom = "1.12";
    x = "(iw-iw/zoom)*(on/" + Math.max(1, frames - 1) + ")";
  }
  const filter = "scale=" + width + ":" + height + ":force_original_aspect_ratio=increase" +
    ",crop=" + width + ":" + height +
    ",zoompan=z='" + zoom + "':x='" + x + "':y='" + y + "':d=1:s=" + width + "x" + height + ":fps=" + fps +
    ",format=yuv420p";

  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-loop", "1", "-framerate", String(fps), "-i", inputPath,
    "-vf", filter, "-frames:v", String(frames), "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    outputPath
  ];
}

function animatePhotoFile({
  inputPath,
  outputPath,
  durationSeconds = 8,
  motion = "zoom-in",
  size = "1280x720",
  spawn = defaultSpawn,
  timeoutMs = 180000
} = {}) {
  if (!inputPath || !outputPath) return Promise.reject(photoError("Input and output paths are required.", "PHOTO_ANIMATION_PATH_REQUIRED"));
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    return Promise.reject(photoError("Input photo does not exist.", "PHOTO_IMAGE_NOT_FOUND"));
  }
  let args;
  try {
    args = buildPhotoAnimationArgs(inputPath, outputPath, { durationSeconds, motion, size });
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
      if (error) return reject(error);
      try {
        if (!fs.existsSync(outputPath) || !fs.statSync(outputPath).size) {
          return reject(photoError("FFmpeg completed without producing a video file.", "PHOTO_ANIMATION_OUTPUT_EMPTY"));
        }
        const header = Buffer.alloc(12);
        const fd = fs.openSync(outputPath, "r");
        try { fs.readSync(fd, header, 0, header.length, 0); } finally { fs.closeSync(fd); }
        if (header.toString("ascii", 4, 8) !== "ftyp") {
          return reject(photoError("FFmpeg output is not a valid MP4 container.", "PHOTO_ANIMATION_OUTPUT_INVALID"));
        }
        return resolve({ outputPath, durationSeconds: Number(durationSeconds), motion, size });
      } catch {
        return reject(photoError("Could not verify the generated MP4 file.", "PHOTO_ANIMATION_OUTPUT_INVALID"));
      }
    };

    const timer = setTimeout(() => {
      if (child && typeof child.kill === "function") child.kill("SIGKILL");
      finish(photoError("Photo animation timed out.", "PHOTO_ANIMATION_TIMEOUT"));
    }, timeoutMs);

    try {
      child = spawn(bundledFfmpegPath || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch {
      finish(photoError("FFmpeg is not available on this server.", "FFMPEG_UNAVAILABLE"));
      return;
    }

    let stderr = "";
    child.stderr?.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-3000); });
    child.on("error", error => {
      finish(photoError(error?.code === "ENOENT" ? "FFmpeg is not installed on this server." : "Could not start FFmpeg.", "FFMPEG_UNAVAILABLE"));
    });
    child.on("close", code => {
      if (code !== 0) {
        finish(photoError("Photo animation render failed: " + stderr.slice(-600), "PHOTO_ANIMATION_RENDER_FAILED"));
        return;
      }
      finish(null);
    });
  });
}

module.exports = {
  ALLOWED_MOTIONS,
  ALLOWED_SIZES,
  ALLOWED_DURATIONS,
  detectPhotoImageType,
  buildPhotoAnimationArgs,
  animatePhotoFile
};
