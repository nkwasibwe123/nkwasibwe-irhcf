"use strict";

/**
 * Provider contracts for speech-to-text and text-to-speech.
 * Providers are injected at runtime so IRHCF can support multiple
 * vendors without creating duplicate conversation engines.
 */

function assertProvider(provider, name) {
  if (!provider || typeof provider[name] !== "function") {
    throw new Error("Configured voice provider is missing " + name + "().");
  }
}

async function transcribe(provider, audio, options = {}) {
  assertProvider(provider, "transcribe");
  return provider.transcribe(audio, options);
}

async function synthesize(provider, text, options = {}) {
  assertProvider(provider, "synthesize");
  return provider.synthesize(text, options);
}

module.exports = { transcribe, synthesize };
