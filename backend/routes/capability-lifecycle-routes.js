"use strict";

const express = require("express");
const { createCapabilityLifecycleRuntime } = require("../capabilities/capability-lifecycle-runtime");
const { createCapabilityLifecycleAdapters } = require("../capabilities/lifecycle-ai-adapters");
const { runIsolatedCommand } = require("../capabilities/sandbox-runner");

function createCapabilityLifecycleRouter({ pool, search, generateText, runner = runIsolatedCommand, authenticateToken } = {}) {
  if (typeof authenticateToken !== "function") throw new TypeError("Authentication middleware is required.");
  const router = express.Router();
  const adapters = createCapabilityLifecycleAdapters({ search, generateText, runner });
  const runtime = createCapabilityLifecycleRuntime({ pool, adapters });

  router.post("/", authenticateToken, async (req, res) => {
    const capability = String(req.body?.capability || "").trim().toLowerCase();
    const goal = String(req.body?.goal || "").trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(capability) || !goal) {
      return res.status(400).json({ success: false, code: "INVALID_CAPABILITY_REQUEST", error: "Provide a safe capability identifier and a clear goal." });
    }
    try {
      const { record, completion } = await runtime.start({
        capability,
        goal: goal.slice(0, 2000),
        reason: String(req.body?.reason || "").slice(0, 2000),
        constraints: Array.isArray(req.body?.constraints) ? req.body.constraints.slice(0, 30) : [],
        explicitDeploymentAuthorization: false,
        ownerUserId: Number(req.user?.id)
      });
      // Work continues after the initial durable checkpoint; clients poll GET /:id.
      completion.catch(error => {
        console.error("[capability-lifecycle] background run failed", {
          lifecycleId: record.id,
          code: error?.code || "CAPABILITY_LIFECYCLE_FAILED"
        });
      });
      return res.status(202).json({
        success: true,
        accepted: true,
        lifecycleId: record.id,
        lifecycle: record,
        statusUrl: req.baseUrl + "/" + encodeURIComponent(record.id),
        deploymentPerformed: false
      });
    } catch (error) {
      const record = error?.lifecycleRecord;
      return res.status(503).json({
        success: false,
        code: error?.code || "CAPABILITY_LIFECYCLE_FAILED",
        error: String(error?.message || "Capability lifecycle failed").slice(0, 1000),
        lifecycleId: error?.lifecycleId || null,
        lifecycle: record ? { id: record.id, status: record.status, stage: record.stage, blockers: record.blockers } : null
      });
    }
  });

  router.get("/:id", authenticateToken, async (req, res) => {
    try {
      const record = await runtime.store.get(String(req.params.id || ""));
      if (!record || Number(record.ownerUserId) !== Number(req.user?.id)) {
        return res.status(404).json({ success: false, code: "LIFECYCLE_NOT_FOUND", error: "Lifecycle record not found." });
      }
      return res.json({ success: true, lifecycle: record, deploymentPerformed: record.deployment?.attempted === true });
    } catch {
      return res.status(500).json({ success: false, code: "LIFECYCLE_READ_FAILED", error: "Unable to read lifecycle record." });
    }
  });
  return router;
}

module.exports = { createCapabilityLifecycleRouter };
