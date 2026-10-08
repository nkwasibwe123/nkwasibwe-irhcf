"use strict";

const { transcribe, synthesize } = require("./provider-contract");
const {
  createVoiceSession,
  addVoiceTurn,
  setVoiceState
} = require("./voice-session");

/**
 * Multimodal conversation bridge.
 *
 * Inject:
 * - sttProvider.transcribe(audio, options)
 * - ttsProvider.synthesize(text, options)
 * - textAgent({ userId, task, sessionId })
 *
 * This keeps voice as another transport into the same IRHCF agent
 * rather than creating a second conversation brain.
 */

async function handleVoiceTurn({
  session,
  userId,
  audio,
  sttProvider,
  ttsProvider,
  textAgent,
  language = "auto",
  voice = null
} = {}) {
  if (!userId) throw new Error("Authenticated user is required.");
  if (!audio) throw new Error("Voice audio is required.");
  if (typeof textAgent !== "function") {
    throw new Error("The existing IRHCF text agent must be configured.");
  }

  const activeSession =
    session ||
    createVoiceSession({ userId, language });

  setVoiceState(activeSession, "listening");

  const transcriptResult =
    await transcribe(sttProvider, audio, {
      language,
      sessionId: activeSession.id
    });

  const transcript =
    typeof transcriptResult === "string"
      ? transcriptResult
      : transcriptResult?.text || "";

  if (!transcript.trim()) {
    throw new Error("Speech could not be transcribed.");
  }

  setVoiceState(activeSession, "thinking");

  const agentResult =
    await textAgent({
      userId,
      task: transcript,
      sessionId: activeSession.id,
      inputMode: "voice"
    });

  const responseText =
    typeof agentResult === "string"
      ? agentResult
      : agentResult?.response ||
        agentResult?.message ||
        agentResult?.text ||
        "";

  if (!responseText.trim()) {
    throw new Error("IRHCF returned no spoken response.");
  }

  setVoiceState(activeSession, "speaking");

  const speech =
    await synthesize(ttsProvider, responseText, {
      language,
      voice,
      sessionId: activeSession.id
    });

  addVoiceTurn(activeSession, {
    transcript,
    responseText,
    inputLanguage: transcriptResult?.language || null,
    outputLanguage: language === "auto" ? null : language,
    confidence: transcriptResult?.confidence ?? null
  });

  setVoiceState(activeSession, "listening");

  return {
    session: activeSession,
    transcript,
    responseText,
    speech
  };
}

module.exports = {
  handleVoiceTurn
};
