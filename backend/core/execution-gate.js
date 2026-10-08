"use strict";

const crypto = require("crypto");

const ACTIONS = Object.freeze({
  GENERATE_TEXT: "generate_text",
  GENERATE_IMAGE: "generate_image",
  PROCESS_AUDIO: "process_audio",
  GENERATE_VIDEO: "generate_video",
  BUILD_SOFTWARE: "build_software",
  RESEARCH: "research",
  EXTERNAL_ACTION: "external_action",
  ACCOUNT_ACTION: "account_action",
  BROWSE_AND_ACT: "browse_and_act",
  MEETING_ACTION: "meeting_action",
  PUBLISH_YOUTUBE: "publish_youtube",
  PROJECT_BUILD: "project_build"
});

const ACTION_POLICIES = Object.freeze({
  generate_text: { capabilities: ["response_generation"], verification: true, authorization: false },
  generate_image: { capabilities: ["media_generation"], verification: true, authorization: false },
  process_audio: { capabilities: ["audio_processing"], verification: true, authorization: false },
  generate_video: { capabilities: ["media_generation"], verification: true, authorization: false },
  build_software: { capabilities: ["software_architecture", "code_generation", "testing"], verification: true, authorization: false },
  research: { capabilities: ["web_research", "source_evaluation"], verification: true, authorization: false },
  external_action: { capabilities: ["task_execution"], verification: true, authorization: true },
  account_action: { capabilities: ["account_control", "task_execution"], verification: true, authorization: true },
  browse_and_act: { capabilities: ["browser_automation", "task_execution"], verification: true, authorization: true },
  meeting_action: { capabilities: ["meeting_control", "voice_processing", "task_execution"], verification: true, authorization: true },
  publish_youtube: { capabilities: ["youtube_publishing", "media_generation"], verification: true, authorization: true },
  project_build: { capabilities: ["project_autopilot", "task_decomposition", "verification"], verification: true, authorization: false }
});

function createExecutionId() {
  return "exec_" + Date.now() + "_" + crypto.randomBytes(5).toString("hex");
}

function normalizeAction(value) {
  return String(value || "").trim().toLowerCase();
}

function getActionPolicy(action) {
  return ACTION_POLICIES[normalizeAction(action)] || null;
}

function validateExecutionRequest({
  action,
  capabilities = [],
  authorized = false,
  adapterAvailable = false
} = {}) {
  const normalizedAction = normalizeAction(action);
  const policy = getActionPolicy(normalizedAction);

  if (!policy) {
    return { allowed: false, code: "UNKNOWN_ACTION", reason: "No execution policy is registered." };
  }

  const available = new Set(
    Array.isArray(capabilities)
      ? capabilities.map((value) => String(value).toLowerCase())
      : []
  );

  const missingCapabilities = policy.capabilities.filter(
    (capability) => !available.has(String(capability).toLowerCase())
  );

  if (missingCapabilities.length) {
    return {
      allowed: false,
      code: "CAPABILITY_MISSING",
      missingCapabilities,
      reason: "A required capability is not currently available."
    };
  }

  if (!adapterAvailable) {
    return { allowed: false, code: "ADAPTER_UNAVAILABLE", reason: "No configured execution adapter is available." };
  }

  if (policy.authorization && !authorized) {
    return { allowed: false, code: "AUTHORIZATION_REQUIRED", reason: "Explicit authorization is required." };
  }

  return {
    allowed: true,
    code: "EXECUTION_ALLOWED",
    executionId: createExecutionId(),
    policy
  };
}

function createExecutionContext(request = {}) {
  return {
    executionId: request.executionId || createExecutionId(),
    userId: request.userId || null,
    taskId: request.taskId || null,
    taskRunId: request.taskRunId || null,
    action: normalizeAction(request.action),
    startedAt: new Date().toISOString(),
    metadata: request.metadata || {}
  };
}

module.exports = {
  ACTIONS,
  ACTION_POLICIES,
  getActionPolicy,
  validateExecutionRequest,
  createExecutionContext
};
