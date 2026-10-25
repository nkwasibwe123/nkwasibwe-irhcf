"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { detectPhotoImageType, buildPhotoAnimationArgs, animatePhotoFile } = require("./photo-animation");

test("photo input type is checked against file signatures, not only browser MIME", () => {
  assert.equal(detectPhotoImageType("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])), "jpg");
  assert.equal(detectPhotoImageType("image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "png");
  assert.equal(detectPhotoImageType("image/webp", Buffer.from("RIFF0000WEBP", "ascii")), "webp");
  assert.throws(() => detectPhotoImageType("image/png", Buffer.from([0xff, 0xd8, 0xff])), { code: "PHOTO_IMAGE_INVALID" });
  assert.throws(() => detectPhotoImageType("image/gif", Buffer.from("GIF89a")), { code: "PHOTO_IMAGE_INVALID" });
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
  fs.writeFileSync(inputPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
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
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "..", "index.html"), "utf8");
  assert.match(server, /app\.post\("\/api\/media\/video\/photo-animation",\s*authenticateToken/);
  assert.match(server, /detectPhotoImageType\(mimeType, imageBuffer\)/);
  assert.match(server, /Content-Disposition.*nkwasibwe-photo-animation\.mp4/);
  assert.match(server, /if \(tempDir\) await fs\.rm\(tempDir, \{ recursive: true, force: true \}\)/);
  assert.match(app, /photoAnimation:\s*"\/api\/media\/video\/photo-animation"/);
  assert.match(app, /async function animatePhotoLocally\(/);
  assert.match(html, /Animate a Photo \(Local\)/);
  assert.match(html, /FFmpeg/);
});
