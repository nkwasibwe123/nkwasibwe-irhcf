"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { detectPhotoImageType, buildPhotoAnimationArgs, animatePhotoFile } = require("./photo-animation");
const zlib = require("node:zlib");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([name, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function solidPng(width = 32, height = 32) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const scanlines = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    scanlines[row] = 0;
    for (let x = 0; x < width; x++) {
      scanlines[row + 1 + x * 3] = 35;
      scanlines[row + 2 + x * 3] = 120;
      scanlines[row + 3 + x * 3] = 210;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}


function pngHeader(width = 10, height = 10) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegHeader(width = 10, height = 10) {
  const buffer = Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0,0,0,0,0x03,0x01,0x11,0,0x02,0x11,0,0x03,0x11,0,0xff,0xd9]);
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

function webpHeader(width = 10, height = 10) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  const w = width - 1, h = height - 1;
  buffer[24] = w & 255; buffer[25] = (w >> 8) & 255; buffer[26] = (w >> 16) & 255;
  buffer[27] = h & 255; buffer[28] = (h >> 8) & 255; buffer[29] = (h >> 16) & 255;
  return buffer;
}


test("photo input type and dimensions are checked against file signatures, not only browser MIME", () => {
  assert.equal(detectPhotoImageType("image/jpeg", jpegHeader()), "jpg");
  assert.equal(detectPhotoImageType("image/png", pngHeader()), "png");
  assert.equal(detectPhotoImageType("image/webp", webpHeader()), "webp");
  assert.throws(() => detectPhotoImageType("image/png", jpegHeader()), { code: "PHOTO_IMAGE_INVALID" });
  assert.throws(() => detectPhotoImageType("image/gif", Buffer.from("GIF89a")), { code: "PHOTO_IMAGE_INVALID" });
  assert.throws(() => detectPhotoImageType("image/png", pngHeader(9000, 9000)), { code: "PHOTO_IMAGE_DIMENSIONS_INVALID" });
});

test("photo animation arguments are fixed to bounded output and safe motion presets", () => {
  const args = buildPhotoAnimationArgs("/tmp/photo.png", "/tmp/output.mp4", { durationSeconds: 8, motion: "pan-left", size: "1280x720" });
  assert.ok(args.includes("-loop"));
  assert.ok(args.includes("-frames:v"));
  assert.ok(args.includes("240"));
  assert.ok(args.some(arg => arg.includes("zoompan=")));
  assert.ok(args.includes("libx264"));
  assert.ok(args.includes("+faststart"));
  assert.equal(args.at(-1), "/tmp/output.mp4");
  assert.throws(() => buildPhotoAnimationArgs("/tmp/a.png", "/tmp/out.mp4", { motion: "arbitrary-filter" }), { code: "PHOTO_ANIMATION_MOTION_INVALID" });
  assert.throws(() => buildPhotoAnimationArgs("/tmp/a.png", "/tmp/out.mp4", { durationSeconds: 999 }), { code: "PHOTO_ANIMATION_DURATION_INVALID" });
  assert.throws(() => buildPhotoAnimationArgs("/tmp/a.png", "/tmp/out.mov"), { code: "PHOTO_ANIMATION_OUTPUT_FORMAT" });
});

test("photo animation rejects a missing image before spawning FFmpeg", async () => {
  await assert.rejects(
    animatePhotoFile({ inputPath: "/definitely/missing/photo.png", outputPath: "/tmp/out.mp4" }),
    { code: "PHOTO_IMAGE_NOT_FOUND" }
  );
});

test("photo animation runs FFmpeg and verifies an MP4 output signature", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-photo-animation-test-"));
  const inputPath = path.join(directory, "input.png");
  const outputPath = path.join(directory, "output.mp4");
  fs.writeFileSync(inputPath, pngHeader());
  let capturedArgs;
  const fakeSpawn = (_command, args) => {
    capturedArgs = args;
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      fs.writeFileSync(args.at(-1), Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from("ftypisom"), Buffer.alloc(20)]));
      child.emit("close", 0);
    });
    return child;
  };
  try {
    const result = await animatePhotoFile({ inputPath, outputPath, durationSeconds: 4, motion: "zoom-in", spawn: fakeSpawn, timeoutMs: 1000 });
    assert.equal(result.durationSeconds, 4);
    assert.equal(result.motion, "zoom-in");
    assert.ok(capturedArgs.includes("libx264"));
    assert.ok(fs.statSync(outputPath).size > 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("photo animation API is authenticated, bounded and returns an MP4 download", () => {
  const root = path.join(__dirname, "..", "..");
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(server, /app\.post\("\/api\/media\/video\/photo-animation",\s*authenticateToken/);
  assert.match(server, /detectPhotoImageType\(mimeType, imageBuffer\)/);
  assert.match(server, /timeoutMs: 90_000/);
  assert.match(server, /Content-Disposition.*nkwasibwe-photo-animation\.mp4/);
  assert.match(server, /if \(tempDir\) await fs\.rm\(tempDir, \{ recursive: true, force: true \}\)/);
  assert.match(app, /photoAnimation:\s*"\/api\/media\/video\/photo-animation"/);
  assert.match(app, /async function animatePhotoLocally\(/);
  assert.match(html, /Animate a Photo \(Local\)/);
  assert.match(html, /FFmpeg/);
});


const ffmpegPath = require("ffmpeg-static");

test("photo animation creates a real playable MP4 with the installed FFmpeg binary", {
  skip: !ffmpegPath || !fs.existsSync(ffmpegPath)
}, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-photo-animation-real-"));
  const inputPath = path.join(directory, "input.png");
  const outputPath = path.join(directory, "real-output.mp4");
  fs.writeFileSync(inputPath, solidPng(32, 32));
  try {
    const result = await animatePhotoFile({
      inputPath,
      outputPath,
      durationSeconds: 4,
      motion: "zoom-in",
      size: "1280x720",
      timeoutMs: 90_000
    });
    assert.equal(result.durationSeconds, 4);
    assert.equal(result.size, "1280x720");
    assert.ok(fs.statSync(outputPath).size > 1000);
    const header = fs.readFileSync(outputPath).subarray(0, 12);
    assert.equal(header.toString("ascii", 4, 8), "ftyp");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
