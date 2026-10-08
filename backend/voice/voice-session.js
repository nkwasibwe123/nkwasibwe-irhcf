"use strict";

/**
 * Voice session orchestration.
 *
 * Transport-agnostic: the browser/mobile client may use WebRTC,
 * WebSocket or HTTP audio chunks. STT/TTS providers are injected;
 * no provider is assumed to exist until configured.
 */

const SESSION_STATES = Object.freeze([
  "created",
  "listening",
  "thinking",
  "speaking",
  "paused",
  "ended",
  "failed"
]);

function createVoiceSession({ userId, conversationId = null, language = "auto" } = {}) {
  if (!userId) throw new Error("Voice session requires an authenticated user.");
  return {
    id: "voice_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
    userId,
    conversationId,
    language,
    state: "created",
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function addVoiceTurn(session, {
  transcript = "",
  responseText = "",
  inputLanguage = null,
  outputLanguage = null,
  confidence = null
} = {}) {
  if (!session) throw new Error("Voice session is required.");
  const turn = {
    id: "turn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    transcript: String(transcript || ""),
    responseText: String(responseText || ""),
    inputLanguage,
    outputLanguage,
    confidence,
    createdAt: new Date().toISOString()
  };
  session.turns.push(turn);
  session.state = "listening";
  session.updatedAt = new Date().toISOString();
  return turn;
}

function setVoiceState(session, state) {
  if (!session) throw new Error("Voice session is required.");
  if (!SESSION_STATES.includes(state)) throw new Error("Invalid voice session state.");
  session.state = state;
  session.updatedAt = new Date().toISOString();
  return session;
}

module.exports = {
  SESSION_STATES,
  createVoiceSession,
  addVoiceTurn,
  setVoiceState
};
