"use strict";

/**
 * NKWASIBWE IRHCF
 * PROVIDER ROUTER
 *
 * Agents decide WHAT work is needed.
 * Provider Router decides WHICH configured AI infrastructure
 * should perform a model-generation step.
 *
 * This module does not call providers itself. Existing provider
 * implementations remain the source of truth for API execution.
 */

const PROVIDER_CAPABILITIES = Object.freeze({
  openai: {
    text: true,
    reasoning: true,
    toolCalling: true,
    multimodalInput: true,
    imageGeneration: true,
    audio: true,
    video: false,
    webResearch: true,
    longRunning: true
  },

  gemini: {
    text: true,
    reasoning: true,
    toolCalling: true,
    multimodalInput: true,
    imageGeneration: true,
    audio: true,
    video: true,
    webResearch: true,
    longRunning: true
  },

  groq: {
    text: true,
    reasoning: true,
    toolCalling: true,
    multimodalInput: false,
    imageGeneration: false,
    audio: false,
    video: false,
    webResearch: true,
    longRunning: true
  },

  local: {
    text: true,
    reasoning: true,
    toolCalling: false,
    multimodalInput: false,
    imageGeneration: false,
    audio: false,
    video: false,
    webResearch: false,
    longRunning: true
  }
});

const TASK_PROVIDER_REQUIREMENTS = Object.freeze({
  general: ["text"],
  reasoning: ["text", "reasoning"],
  research: ["text", "webResearch"],
  software: ["text", "reasoning", "toolCalling"],
  multimodal: ["text", "multimodalInput"],
  image: ["imageGeneration"],
  audio: ["audio"],
  video: ["video"],
  media: ["text", "multimodalInput"],
  long_running: ["text", "longRunning"]
});

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getProviderCapabilities(name) {
  return (
    PROVIDER_CAPABILITIES[normalize(name)] ||
    null
  );
}

function inferRequirements({
  taskType = "general",
  capabilities = [],
  mediaType = null
} = {}) {
  const requirements = new Set(
    TASK_PROVIDER_REQUIREMENTS[
      normalize(taskType)
    ] ||
    TASK_PROVIDER_REQUIREMENTS.general
  );

  const caps = new Set(
    Array.isArray(capabilities)
      ? capabilities.map(normalize)
      : []
  );

  if (
    caps.has("web_research") ||
    caps.has("source_evaluation")
  ) {
    requirements.add("webResearch");
  }

  if (
    caps.has("media_generation") ||
    caps.has("media_processing")
  ) {
    requirements.add("multimodalInput");
  }

  const normalizedMedia = normalize(mediaType);

  if (normalizedMedia === "image") {
    requirements.add("imageGeneration");
  }

  if (normalizedMedia === "audio" || normalizedMedia === "music") {
    requirements.add("audio");
  }

  if (normalizedMedia === "video") {
    requirements.add("video");
  }

  if (caps.has("task_execution")) {
    requirements.add("toolCalling");
  }

  return [...requirements];
}

function providerSupports(provider, requirements) {
  const capabilities =
    getProviderCapabilities(provider?.name);

  if (!capabilities) {
    return false;
  }

  return requirements.every(
    (requirement) =>
      capabilities[requirement] === true
  );
}

function calculateProviderScore(
  provider,
  requirements
) {
  if (!providerSupports(provider, requirements)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  const capabilities =
    getProviderCapabilities(provider.name);

  for (const requirement of requirements) {
    if (capabilities[requirement]) {
      score += 30;
    }
  }

  score += Math.max(
    0,
    100 - Number(provider.priority || 100)
  );

  score += Math.min(
    20,
    Number(provider.successRate || 0) * 20
  );

  score -= Math.min(
    50,
    Number(provider.latencyPenalty || 0)
  );

  score -= Math.min(
    50,
    Number(provider.costPenalty || 0)
  );

  if (provider.cooldownUntil) {
    const cooldown =
      new Date(provider.cooldownUntil).getTime();

    if (
      Number.isFinite(cooldown) &&
      cooldown > Date.now()
    ) {
      return Number.NEGATIVE_INFINITY;
    }
  }

  return score;
}

function selectProviders({
  providers = [],
  taskType = "general",
  capabilities = [],
  mediaType = null
} = {}) {
  const requirements = inferRequirements({
    taskType,
    capabilities,
    mediaType
  });

  const candidates = (
    Array.isArray(providers)
      ? providers
      : []
  )
    .filter(
      (provider) =>
        provider &&
        provider.configured !== false &&
        provider.available !== false
    )
    .map((provider) => ({
      provider: provider.name,
      model: provider.model || null,
      score: calculateProviderScore(
        provider,
        requirements
      ),
      capabilities:
        getProviderCapabilities(provider.name)
    }))
    .filter(
      (candidate) =>
        Number.isFinite(candidate.score)
    )
    .sort(
      (a, b) => b.score - a.score
    );

  return {
    requirements,
    selected:
      candidates[0] || null,
    fallbacks:
      candidates.slice(1),
    candidates,
    canExecute:
      candidates.length > 0,
    reason:
      candidates.length > 0
        ? "A compatible configured provider was selected."
        : "No configured provider currently satisfies all required capabilities."
  };
}

function buildProviderMatrix(providers = []) {
  return (
    Array.isArray(providers)
      ? providers
      : []
  ).map((provider) => ({
    name: provider.name,
    model: provider.model || null,
    configured:
      Boolean(provider.configured),
    available:
      Boolean(provider.available),
    capabilities:
      getProviderCapabilities(provider.name),
    priority:
      Number(provider.priority || 100)
  }));
}

module.exports = {
  PROVIDER_CAPABILITIES,
  TASK_PROVIDER_REQUIREMENTS,
  getProviderCapabilities,
  inferRequirements,
  providerSupports,
  calculateProviderScore,
  selectProviders,
  buildProviderMatrix
};
