"use strict";

/**
 * Central execution coordinator.
 * It delegates actual work to registered adapters and keeps policy,
 * provider selection, and verification outside individual agents.
 */

const { validateExecutionRequest } = require("./execution-gate");

class ExecutionEngine {
  constructor({ adapterRegistry, providerSelector = null, verifier = null } = {}) {
    if (!adapterRegistry) {
      throw new Error("ExecutionEngine requires an adapter registry.");
    }
    this.adapterRegistry = adapterRegistry;
    this.providerSelector = providerSelector;
    this.verifier = verifier;
  }

  listAdapters() {
    return this.adapterRegistry.list();
  }

  async execute({
    action,
    capabilities = [],
    authorized = false,
    userId = null,
    taskId = null,
    taskRunId = null,
    input = {},
    provider = null,
    metadata = {}
  } = {}) {
    const candidates = provider
      ? this.adapterRegistry.findForAction(action)
          .filter((item) => item.provider === provider)
      : this.adapterRegistry.findForAction(action);

    if (!candidates.length) {
      const gate = validateExecutionRequest({
        action,
        capabilities,
        authorized,
        adapterAvailable: false
      });
      const error = new Error(gate.reason);
      error.code = gate.code;
      error.details = gate;
      throw error;
    }

    let selected = candidates[0];

    if (typeof this.providerSelector === "function") {
      const chosen = await this.providerSelector({
        action,
        capabilities,
        candidates,
        input,
        metadata
      });
      if (chosen?.name) {
        selected =
          candidates.find((item) => item.name === chosen.name) ||
          selected;
      }
    }

    const execution = await this.adapterRegistry.execute({
      adapter: selected.name,
      action,
      capabilities,
      authorized,
      userId,
      taskId,
      taskRunId,
      input,
      metadata
    });

    let verification = {
      verified: true,
      reason: "Execution completed; no custom execution verifier registered."
    };

    if (typeof this.verifier === "function") {
      verification = await this.verifier({
        action,
        execution,
        userId,
        taskId,
        taskRunId,
        metadata
      });
    }

    if (!verification?.verified) {
      const error = new Error(
        verification?.reason || "Execution verification failed."
      );
      error.code = "EXECUTION_VERIFICATION_FAILED";
      error.execution = execution;
      throw error;
    }

    return {
      ...execution,
      verification
    };
  }
}

module.exports = { ExecutionEngine };
