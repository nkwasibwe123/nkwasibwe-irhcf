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

  assert.ok(app.includes("function renderMessageContent(container, value)"));
  assert.ok(app.includes('parsed.protocol !== "https:" && parsed.protocol !== "http:"'));
  assert.ok(app.includes('anchor.target = "_blank"'));
  assert.ok(app.includes('anchor.rel = "noopener noreferrer"'));
  assert.ok(app.includes("anchor.textContent = markdownLabel || href"));
  assert.ok(app.includes("renderMessageContent(message, text)"));
  assert.ok(!app.includes("message.innerHTML = text"));
});

test("attached-photo background editing calls the authenticated real image-edit endpoint", () => {
  const root = path.join(__dirname, "..", "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");

  assert.ok(app.includes('"/api/media/image/edit"'));
  assert.ok(app.includes("async function editAttachedImage(prompt, file)"));
  assert.ok(app.includes("imageDataUrl"));
  assert.ok(app.includes('download.download = "nkwasibwe-irhcf-edited-image.png"'));
  assert.ok(server.includes('app.post("/api/media/image/edit", authenticateToken'));
  assert.ok(server.includes("openai.images.edit("));
  assert.ok(server.includes("IMAGE_EDIT_INPUT_TOO_LARGE"));
  assert.ok(server.includes("await toFile(imageBuffer"));
});
