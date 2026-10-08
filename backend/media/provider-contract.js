"use strict";

/**
 * Provider-neutral media contracts.
 *
 * Concrete image, audio/music and video providers are injected only when
 * configured. This prevents the platform from claiming a capability that
 * has no real provider behind it.
 */

function assertProvider(provider, operation) {
  if (!provider || typeof provider[operation] !== "function") {
    const error = new Error(
      `Media provider does not support ${operation}.`
    );
    error.code = "MEDIA_PROVIDER_UNAVAILABLE";
    throw error;
  }
}

async function generateImage(provider, request) {
  assertProvider(provider, "generateImage");
  return provider.generateImage(request);
}

async function generateMusic(provider, request) {
  assertProvider(provider, "generateMusic");
  return provider.generateMusic(request);
}

async function processAudio(provider, request) {
  assertProvider(provider, "processAudio");
  return provider.processAudio(request);
}

async function generateVideo(provider, request) {
  assertProvider(provider, "generateVideo");
  return provider.generateVideo(request);
}

async function editVideo(provider, request) {
  assertProvider(provider, "editVideo");
  return provider.editVideo(request);
}

module.exports = {
  assertProvider,
  generateImage,
  generateMusic,
  processAudio,
  generateVideo,
  editVideo
};
