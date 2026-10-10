"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("frontend source has no standalone async tokens before section comments", () => {
  const appPath = path.join(__dirname, "..", "..", "app.js");
  const source = fs.readFileSync(appPath, "utf8");
  const lines = source.split(/\r?\n/);
  const malformed = [];

  lines.forEach((line, index) => {
    if (/^\s*async\s*(?:\/\/|$)/.test(line)) {
      malformed.push({ line: index + 1, text: line.trim() });
    }
  });

  assert.deepEqual(
    malformed,
    [],
    "Remove standalone async tokens; they execute as identifiers and can throw ReferenceError."
  );
});


test("voice note and live voice controls use the existing authenticated IRHCF API", () => {
  const root = path.join(__dirname, "..", "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const voice = fs.readFileSync(path.join(root, "voice-client.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(html, /id="voiceButton"/, "Voice-note recording control must exist.");
  assert.match(html, /id="liveVoiceButton"/, "Live voice control must exist.");
  assert.match(app, /API_ENDPOINTS\.audioTranscription/, "Voice notes must use the existing transcription endpoint.");
  assert.match(voice, /\/api\/voice\/realtime/, "Live voice must use the authenticated server-side SDP endpoint.");
  assert.match(voice, /nkwasibwe_auth_token/, "Live voice must use the existing authentication token.");
  assert.match(app, /async function toggleVoiceRecording\(/, "The existing composer must own voice-note recording.");
  assert.match(app, /if \(voiceButton\) \{\s*voiceButton\.addEventListener\(\s*"click",\s*toggleVoiceRecording/s, "Voice-note recording must be bound regardless of browser SpeechRecognition support.");
  assert.match(app, /async function transcribeAudioFile\(/, "Voice notes must use the existing transcription flow.");
  assert.doesNotMatch(voice, /getElementById\(["']voiceButton["']\)/, "The live voice module must not register a duplicate voice-note handler.");
  assert.match(server, /app\.post\([\s\S]{0,80}["']\/api\/voice\/realtime["'][\s\S]{0,100}authenticateToken/, "Realtime voice session creation must be authenticated.");
  assert.match(server, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/, "Realtime calls must be negotiated server-side.");
});
