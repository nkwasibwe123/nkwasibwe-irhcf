"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("audio studio endpoint is authenticated, bounded and uses the local FFmpeg renderer", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /app\.post\("\/api\/media\/audio\/edit",\s*authenticateToken/);
  assert.match(server, /audioBase64\.length > 8_500_000/);
  assert.match(server, /inputBuffer\.length > 6 \* 1024 \* 1024/);
  assert.match(server, /irhcf-audio-/);
  assert.match(server, /await editAudioFile\(/);
  assert.match(server, /audioBase64: output\.toString\("base64"\)/);
});

test("Audio Studio dashboard is connected to the authenticated endpoint and provides preview/download", () => {
  const root = path.join(__dirname, "..", "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
  assert.match(html, /data-dashboard-action="audio-studio"/);
  assert.match(html, /id="audioStudioForm"/);
  assert.match(html, /id="audioStudioEffect"/);
  assert.match(html, /id="audioStudioOutput"/);
  assert.match(html, /id="audioStudioDownload"/);
  assert.match(app, /audioEditing:\s*"\/api\/media\/audio\/edit"/);
  assert.match(app, /apiRequest\(API_ENDPOINTS\.audioEditing/);
  assert.match(app, /function initializeAudioStudio\(/);
  assert.match(app, /if \(action === "audio-studio"\)/);
  assert.match(app, /if \(action === "video-edit"\)/);
  assert.match(app, /initializeVideoEditor\(\);/);
  assert.match(app, /initializeAudioStudio\(\);/);
  assert.match(css, /\.audio-studio-panel audio/);
  assert.match(html, /app\.js\?v=2\.0\.24/);
  assert.match(html, /style\.css\?v=2\.0\.22/);
});
