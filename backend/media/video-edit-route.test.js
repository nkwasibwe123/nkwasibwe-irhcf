"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("video edit API is authenticated and enforces bounded video input", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /app\.post\("\/api\/media\/video\/edit",\s*authenticateToken/);
  assert.match(server, /video\/quicktime/);
  assert.match(server, /videoBase64\.length > 8_500_000/);
  assert.match(server, /inputBuffer\.length > 6 \* 1024 \* 1024/);
  assert.match(server, /fs\.mkdtemp\(path\.join\(os\.tmpdir\(\), "irhcf-video-"\)\)/);
  assert.match(server, /await editVideoFile\(/);
  assert.match(server, /await fs\.rm\(tempDir, \{ recursive: true, force: true \}\)/);
  assert.match(server, /videoBase64: output\.toString\("base64"\)/);
});

test("video edit API reports unsupported subtitle burn-in instead of silently ignoring it", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /VIDEO_SUBTITLES_NOT_IMPLEMENTED/);
  assert.match(server, /status\(501\)/);
});

test("video edit API does not accept arbitrary video MIME types or output formats", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /new Map\(\[\s*\["video\/mp4", "mp4"\],\s*\["video\/webm", "webm"\],\s*\["video\/quicktime", "mov"\]/);
  assert.match(server, /!\["mp4", "webm", "mov"\]\.includes\(outputFormat\)/);
});


test("mobile video editor UI is connected to the authenticated endpoint", () => {
  const root = path.join(__dirname, "..", "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "..", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "..", "style.css"), "utf8");
  assert.match(html, /data-dashboard-action="video-edit"/);
  assert.match(html, /id="videoEditorForm"/);
  assert.match(html, /id="videoEditorEffect"/);
  assert.match(html, /id="videoEditorStart"/);
  assert.match(html, /id="videoEditorEnd"/);
  assert.match(html, /id="videoEditorDownload"/);
  assert.match(html, /app\.js\?v=2\.0\.6/);
  assert.match(html, /style\.css\?v=2\.0\.6/);
  assert.match(app, /videoEditing:\s*"\/api\/media\/video\/edit"/);
  assert.match(app, /apiRequest\(API_ENDPOINTS\.videoEditing/);
  assert.match(app, /function initializeVideoEditor\(/);
  assert.match(css, /\.video-editor-fields/);
  assert.match(css, /min-height: 44px/);
});
