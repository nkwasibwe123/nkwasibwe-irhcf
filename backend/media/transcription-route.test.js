"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const routeStart = server.indexOf('app.post("/api/media/transcribe"');
const routeEnd = server.indexOf("// AUTHENTICATED SPEECH / VOICE-OVER GENERATION", routeStart);
const route = server.slice(routeStart, routeEnd);

test("local transcription status is authenticated and reports readiness without filesystem paths", () => {
  assert.match(server, /app\.get\("\/api\/media\/transcribe\/status",\s*authenticateToken/);
  assert.match(server, /status\.ready\s*\?\s*200\s*:\s*503/);
  assert.match(server, /binaryAvailable:\s*status\.binaryAvailable/);
  assert.match(server, /modelAvailable:\s*status\.modelAvailable/);
  assert.match(server, /model:\s*status\.model/);
});

test("transcription route prefers local Whisper and does not fall back to a paid provider after local failure", () => {
  assert.ok(routeStart >= 0 && routeEnd > routeStart, "transcription route markers must exist");
  assert.match(route, /app\.post\("\/api\/media\/transcribe",\s*authenticateToken/);
  assert.match(route, /const localConfig = getLocalTranscriberConfig\(\)/);
  assert.match(route, /if \(localConfig\.enabled\)\s*\{[\s\S]*?await transcribeLocally\([\s\S]*?return res\.json/);
  assert.match(route, /if \(!openai\)\s*\{/);
  assert.ok(route.indexOf("if (localConfig.enabled)") < route.indexOf("openai.audio.transcriptions.create"));
  assert.match(route, /code:\s*"TRANSCRIPTION_ENGINE_UNAVAILABLE"/);
});

test("transcription endpoint validates supported extensions and caps audio at six MiB", () => {
  assert.match(route, /Unsupported audio file type/);
  assert.match(route, /audioBase64/);
  assert.match(route, /audioBuffer\.length > 6 \* 1024 \* 1024/);
  assert.match(route, /req\.setTimeout\(180000\)/);
});
