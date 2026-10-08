"use strict";

/**
 * Central execution coordinator.
 *
 * It delegates work to registered adapters and keeps policy,
 * provider selection, fallback and verification outside agents.
 *
 * Important:
 * - It never creates provider clients.
 * - It never bypasses execution-gate.
 * - It may fail over to another registered adapter when the
 *   selected adapter fails.
 * - Verification failure is terminal for that execution result.
 */

const { validateExecutionRequest } = require("./execution-gate");

function normalizeProvider(value) {
  return String(value || "").trim().toLowerCase();
}

function toErrorRecord(error) {
  return {
    code: error?.code || "EXECUTION_FAILED",
    message: String(
      error?.message || "Execution adapter failed."
    ).slice(0, 1000)
  };
}

class ExecutionEngine {
  constructor({
    adapterRegistry,
    providerSelector = null,
    verifier = null,
    allowFailover = true
  } = {}) {
    if (!adapterRegistry) {
      throw new Error(
        "ExecutionEngine requires an adapter registry."
      );
    }

    this.adapterRegistry = adapterRegistry;
    this.providerSelector = providerSelector;
    this.verifier = verifier;
    this.allowFailover = allowFailover !== false;
  }

  listAdapters() {
    return this.adapterRegistry.list();
  }

  async selectCandidates({
    action,
    capabilities,
    input,
    metadata,
    provider
  }) {
    let candidates =
      this.adapterRegistry.findForAction(action);

    if (provider) {
      const requestedProvider =
        normalizeProvider(provider);

      candidates =
        candidates.filter(
          (item) =>
            normalizeProvider(item.provider) ===
            requestedProvider
        );
    }

    if (!candidates.length) {
      return [];
    }

    if (typeof this.providerSelector !== "function") {
      return candidates;
    }

    const chosen =
      await this.providerSelector({
        action,
        capabilities,
        candidates,
        input,
        metadata
      });

    if (!chosen?.name) {
      return candidates;
    }

    const selected =
      candidates.find(
        (item) => item.name === chosen.name
      );

    if (!selected) {
      return candidates;
    }

    return [
      selected,
      ...candidates.filter(
        (item) => item.name !== selected.name
      )
    ];
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
    const initialGate =
      validateExecutionRequest({
        action,
        capabilities,
        authorized,
        adapterAvailable: false
      });

    if (
      initialGate.code === "UNKNOWN_ACTION" ||
      initialGate.code === "CAPABILITY_MISSING" ||
      initialGate.code === "AUTHORIZATION_REQUIRED"
    ) {
      const error = new Error(
        initialGate.reason
      );
      error.code = initialGate.code;
      error.details = initialGate;
      throw error;
    }

    const candidates =
      await this.selectCandidates({
        action,
        capabilities,
        input,
        metadata,
        provider
      });

    if (!candidates.length) {
      const error = new Error(
        "No configured execution adapter is available."
      );
      error.code = "ADAPTER_UNAVAILABLE";
      error.details = {
        ...initialGate,
        adapterAvailable: false
      };
      throw error;
    }

    const failures = [];
    const attempted = [];

    const maxAttempts =
      this.allowFailover
        ? candidates.length
        : 1;

    for (
      let index = 0;
      index < maxAttempts;
      index++
    ) {
      const selected = candidates[index];

      attempted.push(selected.name);

      try {
        const execution =
          await this.adapterRegistry.execute({
            adapter: selected.name,
            action,
            capabilities,
            authorized,
            userId,
            taskId,
            taskRunId,
            input,
            metadata: {
              ...metadata,
              failoverAttempt: index + 1,
              failoverAvailable:
                Math.max(0, candidates.length - index - 1)
            }
          });

        let verification = {
          verified: true,
          reason:
            "Execution completed; no custom execution verifier registered."
        };

        if (typeof this.verifier === "function") {
          verification =
            await this.verifier({
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
            verification?.reason ||
              "Execution verification failed."
          );
          error.code =
            "EXECUTION_VERIFICATION_FAILED";
          error.execution = execution;
          error.verification = verification;
          throw error;
        }

        return {
          ...execution,
          verification,
          attempts: index + 1,
          attemptedAdapters: attempted
        };
      } catch (error) {
        failures.push({
          adapter: selected.name,
          provider: selected.provider,
          ...toErrorRecord(error)
        });

        if (
          error?.code ===
          "EXECUTION_VERIFICATION_FAILED"
        ) {
          throw error;
        }

        if (!this.allowFailover) {
          break;
        }
      }
    }

    const error = new Error(
      "All configured execution adapters failed."
    );
    error.code = "ALL_ADAPTERS_FAILED";
    error.failures = failures;
    error.attemptedAdapters = attempted;
    throw error;
  }
}

module.exports = {
  ExecutionEngine
};
