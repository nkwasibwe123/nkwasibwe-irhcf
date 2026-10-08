"use strict";

/**
 * Provider adapter registration for the central execution engine.
 *
 * Adapters wrap the existing provider functions. They do not create
 * another AI client or duplicate provider business logic.
 */

function normalizeProviderName(value) {
  return String(value || "").trim().toLowerCase();
}

function registerTextProviders(registry, providers = {}) {
  if (!registry) throw new Error("Adapter registry is required.");

  const definitions = [
    ["openai", providers.openai],
    ["gemini", providers.gemini],
    ["groq", providers.groq]
  ];

  for (const [name, definition] of definitions) {
    if (!definition || typeof definition.execute !== "function") continue;

    registry.register({
      name: `${name}-text`,
      provider: name,
      actions: ["generate_text"],
      capabilities: ["response_generation"],
      enabled: definition.enabled !== false,
      version: definition.version || "1.0.0",
      metadata: {
        type: "text_generation",
        provider: normalizeProviderName(name)
      },
      execute: async ({ input, metadata }) =>
        definition.execute({
          messages: Array.isArray(input?.messages)
            ? input.messages
            : [],
          options: {
            ...(input?.options || {}),
            ...(metadata?.providerOptions || {})
          }
        })
    });
  }

  return registry.list();
}

module.exports = {
  registerTextProviders
};
