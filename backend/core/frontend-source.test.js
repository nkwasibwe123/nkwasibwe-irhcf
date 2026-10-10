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


test("chat attachments are included as bounded text context and unsupported binary files are rejected", () => {
  const root = path.join(__dirname, "..", "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(app, /const selectedAttachments\s*=\s*\[\.\.\.composerState\.attachments\]/);
  assert.match(app, /if \(!text && selectedAttachments\.length === 0\)/,
    "Attachment-only messages should be allowed while empty submissions are rejected.");
  assert.match(app, /const textAttachmentExtensions = new Set\(/,
    "Supported text/code extensions must be explicit.");
  assert.match(app, /unsupportedAttachments\.length/,
    "Unsupported binary attachments must be rejected, not silently ignored.");
  assert.match(app, /await file\.text\(\)/,
    "Attachment content must be read before sending the chat request.");
  assert.match(app, /file\.size > 1024 \* 1024/,
    "Individual text attachments must have a size limit.");
  assert.match(app, /totalCharacters > 80000/,
    "Combined attachment content must have a total size limit.");
  assert.match(app, /message:\s*taskText/,
    "The backend chat payload must contain the actual attachment content.");
  assert.match(app, /ATTACHED FILE:/,
    "Attachment boundaries and filenames must be preserved in the AI context.");
  assert.match(app, /Amakuru akurikira ni ibiri muri dosiye zitizewe/,
    "File contents must be framed as untrusted data to reduce prompt-injection risk.");
});

test("chat renders safe clickable HTTP(S) and Markdown links without injecting HTML", () => {
  const root = path.join(__dirname, "..", "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(app, /function renderMessageContent\(container, value\)/,
    "Chat messages must use the safe link renderer.");
  assert.match(app, /parsed\.protocol !== "https:" && parsed\.protocol !== "http:"/,
    "Only HTTP(S) URLs should be eligible for links.");
  assert.match(app, /anchor\.target = "_blank"/,
    "Tapping a link should open its destination in a new tab/window.");
  assert.match(app, /anchor\.rel = "noopener noreferrer"/,
    "External links must be isolated from the opener window.");
  assert.match(app, /anchor\.textContent = markdownLabel \|\| href/,
    "Link labels must be inserted as text, not HTML.");
  assert.match(app, /renderMessageContent\(message, text\)/,
    "Rendered chat messages must use the safe clickable-link renderer.");
  assert.doesNotMatch(app, /message\.innerHTML\s*=\s*text/,
    "Untrusted assistant output must not be injected as HTML.");
});

test("attached-photo background editing calls the authenticated real image-edit endpoint", () => {
  const root = path.join(__dirname, "..", "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");

  assert.match(app, /imageEditing:\s*["']\/api\/media\/image\/edit["']/,
    "The frontend must use the dedicated image-edit route.");
  assert.match(app, /async function editAttachedImage\(prompt, file\)/,
    "Photo editing must be an explicit executable frontend flow.");
  assert.match(app, /body:\s*JSON\.stringify\(\{[\s\S]{0,160}imageDataUrl/,
    "The selected image bytes must be sent to the backend.");
  assert.match(app, /download\.download = ["']nkwasibwe-irhcf-edited-image\.png["']/,
    "The resulting edited image must be downloadable.");
  assert.match(server, /app\.post\(["']\/api\/media\/image\/edit["'],\s*authenticateToken/,
    "Image editing must be protected by authentication.");
  assert.match(server, /openai\.images\.edit\(/,
    "The backend must invoke the actual image-edit provider.");
  assert.match(server, /IMAGE_EDIT_INPUT_TOO_LARGE/,
    "Image editing must enforce an input size limit.");
  assert.match(server, /await toFile\(imageBuffer/,
    "The backend must convert validated image bytes into a provider upload.");
});
