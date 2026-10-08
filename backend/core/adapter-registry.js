"use strict";

/**
 * IRHCF ADAPTER REGISTRY
 *
 * Providers/tools are registered here as execution adapters.
 * The registry contains no API keys and never invents provider
 * capabilities. An adapter must explicitly declare what it does.
 */

const { validateExecutionRequest, createExecutionContext } = require("./execution-gate");

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register({
    name,
    actions = [],
    capabilities = [],
    execute,
    provider = "internal",
    version = "1.0.0",
    enabled = true,
    metadata = {}
  } = {}) {
    const id = String(name || "").trim().toLowerCase();

    if (!id) throw new Error("Adapter name is required.");
    if (typeof execute !== "function") throw new Error("Adapter execute function is required.");

    this.adapters.set(id, {
      name: id,
      provider: String(provider || "internal"),
      version: String(version || "1.0.0"),
      actions: [...new Set(actions.map(String))],
      capabilities: [...new Set(capabilities.map(String))],
      enabled: Boolean(enabled),
      execute,
      metadata: { ...metadata }
    });

    return this.get(id);
  }

  unregister(name) {
    return this.adapters.delete(String(name || "").trim().toLowerCase());
  }

  get(name) {
    const adapter = this.adapters.get(String(name || "").trim().toLowerCase());
    if (!adapter) return null;
    return { ...adapter, execute: undefined };
  }

  list() {
    return [...this.adapters.values()].map((adapter) => ({
      ...adapter,
      execute: undefined
    }));
  }

  findForAction(action) {
    const normalized = String(action || "").trim().toLowerCase();

    return [...this.adapters.values()]
      .filter((adapter) => adapter.enabled && adapter.actions.includes(normalized))
      .sort((a, b) => String(a.provider).localeCompare(String(b.provider)));
  }

  async execute({
    adapter,
    action,
    capabilities = [],
    authorized = false,
    userId = null,
    taskId = null,
    taskRunId = null,
    input = {},
    metadata = {}
  } = {}) {
    const selected = this.adapters.get(String(adapter || "").trim().toLowerCase());

    if (!selected || !selected.enabled) {
      const error = new Error("Execution adapter is unavailable.");
      error.code = "ADAPTER_UNAVAILABLE";
      throw error;
    }

    if (!selected.actions.includes(String(action || "").trim().toLowerCase())) {
      const error = new Error("Adapter does not support the requested action.");
      error.code = "ADAPTER_ACTION_UNSUPPORTED";
      throw error;
    }

    const gate = validateExecutionRequest({
      action,
      capabilities,
      authorized,
      adapterAvailable: true
    });

    if (!gate.allowed) {
      const error = new Error(gate.reason);
      error.code = gate.code;
      error.details = gate;
      throw error;
    }

    const context = createExecutionContext({
      executionId: gate.executionId,
      userId,
      taskId,
      taskRunId,
      action,
      metadata: {
        ...metadata,
        adapter: selected.name,
        provider: selected.provider,
        adapterVersion: selected.version
      }
    });

    const result = await selected.execute({
      input,
      context,
      metadata: context.metadata
    });

    return {
      executionId: context.executionId,
      adapter: selected.name,
      provider: selected.provider,
      result
    };
  }
}

module.exports = {
  AdapterRegistry
};
