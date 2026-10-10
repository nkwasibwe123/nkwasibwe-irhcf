"use strict";

/**
 * Executable project lifecycle coordinator.
 *
 * The planner defines intended phases; this runner makes phase execution
 * explicit and observable. It does not invent providers or perform external
 * side effects itself: every phase is delegated to an injected handler.
 */

const TERMINAL_PHASES = new Set(["DELIVER"]);
const APPROVAL_PHASES = new Set(["DEPLOY"]);

function normalizePhase(phase) {
  return String(phase || "").trim().toUpperCase();
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.phases) || !plan.phases.length) {
    throw new TypeError("A project plan with phases is required.");
  }
  const seen = new Set();
  for (const item of plan.phases) {
    const phase = normalizePhase(item && item.phase);
    if (!phase || seen.has(phase)) throw new Error("Project plan contains a missing or duplicate phase.");
    seen.add(phase);
  }
  return plan.phases.map((item, index) => ({
    ...item,
    phase: normalizePhase(item.phase),
    order: Number.isFinite(item.order) ? item.order : index + 1
  })).sort((a, b) => a.order - b.order);
}

function createProjectLifecycleRunner({ handlers = {}, checkpoint = async () => {}, authorize = async () => false } = {}) {
  return async function runProjectLifecycle({ plan, context = {}, startAtPhase = null } = {}) {
    const phases = validatePlan(plan);
    const startPhase = startAtPhase ? normalizePhase(startAtPhase) : null;
    if (startPhase && !phases.some((item) => item.phase === startPhase)) {
      throw new Error("Requested start phase is not present in the project plan.");
    }

    const results = [];
    let started = !startPhase;

    for (const item of phases) {
      if (!started && item.phase === startPhase) started = true;
      if (!started) continue;

      const handler = handlers[item.phase];
      const startedAt = new Date().toISOString();
      await checkpoint({
        projectId: plan.projectId || null,
        phase: item.phase,
        status: "running",
        order: item.order,
        startedAt
      });

      try {
        if (APPROVAL_PHASES.has(item.phase)) {
          const allowed = await authorize({ plan, phase: item.phase, context });
          if (allowed !== true) {
            const paused = {
              phase: item.phase,
              status: "waiting_for_user",
              reason: "Explicit authorization is required before an external or irreversible action."
            };
            results.push(paused);
            await checkpoint({ projectId: plan.projectId || null, ...paused, order: item.order });
            return { status: "waiting_for_user", results, completedPhases: results.filter((r) => r.status === "complete").length };
          }
        }

        if (typeof handler !== "function") {
          const skipped = {
            phase: item.phase,
            status: "blocked",
            reason: "No execution handler is configured for this phase."
          };
          results.push(skipped);
          await checkpoint({ projectId: plan.projectId || null, ...skipped, order: item.order });
          return { status: "blocked", results, completedPhases: results.filter((r) => r.status === "complete").length };
        }

        const output = await handler({ plan, phase: item.phase, context, previousResults: results.slice() });
        if (output && output.success === false) {
          throw new Error(output.error || item.phase + " phase reported failure.");
        }

        const result = {
          phase: item.phase,
          status: "complete",
          output: output === undefined ? null : output,
          startedAt,
          completedAt: new Date().toISOString()
        };
        results.push(result);
        await checkpoint({ projectId: plan.projectId || null, ...result, order: item.order });

        if (TERMINAL_PHASES.has(item.phase)) {
          return { status: "complete", results, completedPhases: results.length };
        }
      } catch (error) {
        const failure = {
          phase: item.phase,
          status: "failed",
          error: String(error && error.message || error),
          startedAt,
          failedAt: new Date().toISOString()
        };
        results.push(failure);
        await checkpoint({ projectId: plan.projectId || null, ...failure, order: item.order });
        return { status: "failed", results, completedPhases: results.filter((r) => r.status === "complete").length };
      }
    }

    return {
      status: "complete",
      results,
      completedPhases: results.filter((r) => r.status === "complete").length
    };
  };
}

module.exports = { createProjectLifecycleRunner, validatePlan };
