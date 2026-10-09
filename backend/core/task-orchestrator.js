"use strict";

const { evaluateCapabilities } = require("./capability-engine");
const { routeTask } = require("./agent-router");
const { buildAgentTeam } = require("../agents/agent-teams");

/*
 * ============================================================
 * NKWASIBWE IRHCF
 * TASK ORCHESTRATION ENGINE
 * ============================================================
 *
 * Purpose:
 * - Understand the user's task
 * - Classify the task
 * - Detect required capabilities
 * - Build a safe initial execution plan
 * - Describe verification requirements
 *
 * IMPORTANT:
 * This module does NOT execute tools.
 * It does NOT call an AI provider.
 * It does NOT access the database.
 *
 * It is intentionally dependency-free so that the backend
 * can boot even when external AI providers are unavailable.
 * ============================================================
 */

const ENGINE_NAME =
  "Nkwasibwe Task Orchestration Engine";

const ENGINE_VERSION =
  "1.1.0";

/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
}

/* ============================================================
 * KEYWORD MATCHING
 * ============================================================
 */

function containsAny(text, keywords) {
  const normalized = lowerText(text);

  return keywords.some(
    (keyword) =>
      normalized.includes(
        String(keyword).toLowerCase()
      )
  );
}

/* ============================================================
 * TASK CLASSIFICATION
 * ============================================================
 */

function classifyTask(task) {
  const text = lowerText(task);

  if (!text) {
    return {
      type: "unknown",
      confidence: 0,
      reason: "No task was provided."
    };
  }

  // Only explicit build/create requests should enter the long-running
  // software-build path. Merely asking what a website is must stay a
  // normal conversation rather than creating a background project.
  if (
    containsAny(text, [
      "build a website",
      "build website",
      "create a website",
      "create website",
      "make a website",
      "make website",
      "develop a website",
      "develop website",
      "build a web app",
      "create a web app",
      "make a web app",
      "develop a web app",
      "build a web application",
      "create a web application",
      "develop a web application",
      "ubaka urubuga",
      "kora urubuga",
      "tunganya urubuga"
    ])
  ) {
    return {
      type: "software_build",
      confidence: 0.95,
      reason:
        "The request appears to involve building or modifying a website or web application."
    };
  }

  if (
    containsAny(text, [
      "code",
      "program",
      "javascript",
      "typescript",
      "python",
      "node.js",
      "nodejs",
      "api",
      "backend",
      "frontend",
      "database",
      "bug",
      "error",
      "fix this",
      "debug"
    ])
  ) {
    return {
      type: "software_engineering",
      confidence: 0.93,
      reason:
        "The request appears to involve software engineering or debugging."
    };
  }

  if (
    containsAny(text, [
      "research",
      "research this",
      "find information",
      "search",
      "look up",
      "amakuru",
      "shakisha",
      "sesengura amakuru"
    ])
  ) {
    return {
      type: "research",
      confidence: 0.92,
      reason:
        "The request appears to require information discovery or research."
    };
  }

  if (
    containsAny(text, [
      "write",
      "rewrite",
      "draft",
      "article",
      "blog",
      "post",
      "caption",
      "email",
      "message",
      "andika",
      "wandikire"
    ])
  ) {
    return {
      type: "content_creation",
      confidence: 0.91,
      reason:
        "The request appears to involve generating or transforming written content."
    };
  }

  if (
    containsAny(text, [
      "image",
      "photo",
      "picture",
      "logo",
      "design",
      "poster",
      "thumbnail",
      "video",
      "music",
      "song",
      "audio",
      "voice"
    ])
  ) {
    return {
      type: "media",
      confidence: 0.90,
      reason:
        "The request appears to involve media creation or transformation."
    };
  }

  if (
    containsAny(text, [
      "account",
      "my account",
      "login",
      "post for me",
      "send for me",
      "upload for me",
      "publish for me",
      "mu mwanya wanjye",
      "konti yanjye"
    ])
  ) {
    return {
      type: "account_automation",
      confidence: 0.94,
      reason:
        "The request appears to require an authorized action on an external user account."
    };
  }

  if (
    containsAny(text, [
      "meeting",
      "online meeting",
      "google meet",
      "join the meeting",
      "attend the meeting",
      "inama online",
      "jya mu nama"
    ])
  ) {
    return {
      type: "meeting",
      confidence: 0.95,
      reason:
        "The request appears to require meeting participation using voice and external communication."
    };
  }

  if (
    containsAny(text, [
      "start this project",
      "build this project",
      "make this project",
      "turn this idea into",
      "project",
      "igitekerezo",
      "tangira gukora"
    ])
  ) {
    return {
      type: "project_autopilot",
      confidence: 0.88,
      reason:
        "The request appears to require an end-to-end project lifecycle."
    };
  }

  if (
    containsAny(text, [
      "schedule",
      "every day",
      "every week",
      "daily",
      "weekly",
      "monitor",
      "continuously",
      "24/7",
      "remind me",
      "automatic"
    ])
  ) {
    return {
      type: "automation",
      confidence: 0.90,
      reason:
        "The request appears to require scheduling, monitoring, or recurring execution."
    };
  }

  if (
    containsAny(text, [
      "business",
      "company",
      "product",
      "sell",
      "marketing",
      "sales",
      "customer",
      "market",
      "revenue"
    ])
  ) {
    return {
      type: "business",
      confidence: 0.86,
      reason:
        "The request appears to involve business, product, marketing, or sales activity."
    };
  }

  if (
    containsAny(text, [
      "plan",
      "steps",
      "strategy",
      "how do i",
      "how can i",
      "help me",
      "ntegura",
      "tegurira"
    ])
  ) {
    return {
      type: "planning",
      confidence: 0.80,
      reason:
        "The request appears to primarily require planning or structured guidance."
    };
  }

  return {
    type: "general",
    confidence: 0.60,
    reason:
      "The request does not match a specialized task category."
  };
}

/* ============================================================
 * CAPABILITY DETECTION
 * ============================================================
 */

function detectCapabilities(task, classification) {
  const capabilities = [];

  const text = lowerText(task);

  function add(name) {
    if (!capabilities.includes(name)) {
      capabilities.push(name);
    }
  }

  switch (classification.type) {
    case "software_build":
      add("requirements_analysis");
      add("software_architecture");
      add("code_generation");
      add("testing");
      add("verification");
      break;

    case "software_engineering":
      add("code_analysis");
      add("debugging");
      add("code_generation");
      add("testing");
      add("verification");
      break;

    case "research":
      add("web_research");
      add("source_evaluation");
      add("information_synthesis");
      break;

    case "content_creation":
      add("content_generation");
      add("editing");
      add("quality_review");
      break;

    case "media":
      add("media_generation");
      add("media_processing");
      add("quality_review");
      break;

    case "automation":
      add("scheduling");
      add("monitoring");
      add("task_execution");
      break;

    case "account_automation":
      add("account_control");
      add("browser_automation");
      add("task_execution");
      add("verification");
      break;

    case "meeting":
      add("meeting_control");
      add("voice_processing");
      add("task_execution");
      add("verification");
      break;

    case "project_autopilot":
      add("project_autopilot");
      add("task_decomposition");
      add("planning");
      add("verification");
      add("web_research");
      add("task_execution");
      break;

    case "business":
      add("market_analysis");
      add("planning");
      add("content_generation");
      add("analytics");
      break;

    case "planning":
      add("task_decomposition");
      add("planning");
      add("verification");
      break;

    default:
      add("reasoning");
      add("response_generation");
      break;
  }

  if (
    containsAny(text, [
      "database",
      "postgres",
      "sql",
      "data"
    ])
  ) {
    add("database_operations");
  }

  if (
    containsAny(text, [
      "github",
      "git",
      "deploy",
      "deployment",
      "render",
      "hosting"
    ])
  ) {
    add("deployment");
  }

  if (
    containsAny(text, [
      "browser",
      "website",
      "web page",
      "internet"
    ])
  ) {
    add("browser_or_web_access");
  }

  if (
    containsAny(text, [
      "file",
      "pdf",
      "document",
      "upload",
      "download"
    ])
  ) {
    add("file_operations");
  }

  if (
    containsAny(text, [
      "voice",
      "speak",
      "audio",
      "listen"
    ])
  ) {
    add("voice_processing");
  }

  if (
    containsAny(text, [
      "youtube",
      "youtube channel",
      "upload to youtube",
      "publish on youtube"
    ])
  ) {
    add("youtube_publishing");
  }

  if (
    containsAny(text, [
      "account",
      "konti",
      "login",
      "sign in",
      "post for me",
      "send for me"
    ])
  ) {
    add("account_control");
    add("browser_automation");
  }

  return capabilities;
}

/* ============================================================
 * PLAN GENERATION
 * ============================================================
 */

function buildPlan(task, classification, capabilities) {
  const steps = [];

  steps.push({
    step: 1,
    name: "Understand",
    action:
      "Understand the objective, constraints, expected output, and success criteria.",
    status: "planned"
  });

  steps.push({
    step: 2,
    name: "Plan",
    action:
      "Create an execution plan using the capabilities required by the task.",
    status: "planned"
  });

  if (
    capabilities.includes("web_research") ||
    capabilities.includes("browser_or_web_access")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Research",
      action:
        "Gather relevant information from permitted sources and evaluate source reliability.",
      status: "planned"
    });
  }

  if (
    capabilities.includes("code_generation") ||
    capabilities.includes("software_architecture")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Build",
      action:
        "Create or modify the required software components.",
      status: "planned"
    });
  }

  if (
    capabilities.includes("media_generation")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Create",
      action:
        "Generate or transform the requested media.",
      status: "planned"
    });
  }

  if (
    capabilities.includes("account_control") ||
    capabilities.includes("browser_automation")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Authorized Action",
      action:
        "Use the connected account only within granted scopes and explicit authorization boundaries.",
      status: "planned"
    });
  }

  if (
    capabilities.includes("meeting_control")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Meeting",
      action:
        "Join or create the authorized meeting, listen, respond, and verify meeting actions.",
      status: "planned"
    });
  }

  if (
    capabilities.includes("scheduling") ||
    capabilities.includes("monitoring")
  ) {
    steps.push({
      step: steps.length + 1,
      name: "Automate",
      action:
        "Configure recurring execution, monitoring, or scheduling where supported.",
      status: "planned"
    });
  }

  steps.push({
    step: steps.length + 1,
    name: "Test",
    action:
      "Test the result against the task requirements and detect failures.",
    status: "planned"
  });

  steps.push({
    step: steps.length + 1,
    name: "Repair",
    action:
      "If a recoverable failure occurs, diagnose it and prepare a safe correction.",
    status: "planned"
  });

  steps.push({
    step: steps.length + 1,
    name: "Verify",
    action:
      "Verify correctness, completeness, safety, and consistency of the result.",
    status: "planned"
  });

  steps.push({
    step: steps.length + 1,
    name: "Deliver",
    action:
      "Return the verified result and relevant execution information to the user.",
    status: "planned"
  });

  return steps;
}

/* ============================================================
 * VERIFICATION REQUIREMENTS
 * ============================================================
 */

function buildVerification(classification, capabilities) {
  const checks = [
    "Task objective satisfied",
    "Required output is present",
    "No known execution errors remain",
    "Result is internally consistent"
  ];

  if (
    capabilities.includes("code_generation") ||
    capabilities.includes("software_architecture")
  ) {
    checks.push("Software structure is syntactically valid");
    checks.push("Relevant tests pass");
  }

  if (
    capabilities.includes("web_research")
  ) {
    checks.push("Research sources are identified");
    checks.push("Claims are separated from unsupported assumptions");
  }

  if (
    capabilities.includes("deployment")
  ) {
    checks.push("Deployment status is verified before claiming success");
  }

  if (capabilities.includes("account_control")) {
    checks.push("Requested account scope and authorization were valid");
    checks.push("External action result was independently verified");
  }

  if (capabilities.includes("meeting_control")) {
    checks.push("Meeting identity, participation, and response outcome were verified");
  }

  if (capabilities.includes("youtube_publishing")) {
    checks.push("Published media exists and returned platform metadata is verified");
  }

  if (
    classification.type === "automation"
  ) {
    checks.push("Schedule or monitoring configuration is verified");
  }

  return {
    required: true,
    checks
  };
}

/* ============================================================
 * MAIN ANALYZER
 * ============================================================
 */

function analyzeTask(task, context = {}) {
  const normalizedTask = normalizeText(task);

  if (!normalizedTask) {
    throw new Error(
      "Task orchestration requires a non-empty task."
    );
  }

  const classification =
    classifyTask(normalizedTask);

  const capabilities =
    detectCapabilities(
      normalizedTask,
      classification
    );

  const capabilityEvaluation =
    evaluateCapabilities(capabilities);

  const routing =
    routeTask(classification, capabilities);

  const agentTeam =
    buildAgentTeam({
      taskType: classification.type,
      capabilities
    });

  const plan =
    buildPlan(
      normalizedTask,
      classification,
      capabilities
    );

  const verification =
    buildVerification(
      classification,
      capabilities
    );

  return {
    engine: {
      name: ENGINE_NAME,
      version: ENGINE_VERSION
    },

    task: normalizedTask,

    context: {
      userId:
        context?.userId || null,

      sessionId:
        context?.sessionId || null
    },

    classification,

    capabilities,

    capabilityEvaluation,

    routing,

    agentTeam,

    plan,

    verification,

    status: "ready",

    execution: {
      mode: "analysis_only",
      toolsExecuted: false,
      externalActionsExecuted: false
    },

    createdAt:
      new Date().toISOString()
  };
}

/* ============================================================
 * PLAN SUMMARY
 * ============================================================
 */

function summarizePlan(taskAnalysis) {
  if (!taskAnalysis) {
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      status: "empty"
    };
  }

  const classification =
    taskAnalysis.classification || {};

  const plan =
    Array.isArray(taskAnalysis.plan)
      ? taskAnalysis.plan
      : [];

  return {
    engine: ENGINE_NAME,

    version: ENGINE_VERSION,

    status:
      taskAnalysis.status ||
      "ready",

    classification: {
      type:
        classification.type ||
        "unknown",

      confidence:
        classification.confidence ??
        0
    },

    capabilities:
      Array.isArray(
        taskAnalysis.capabilities
      )
        ? taskAnalysis.capabilities
        : [],

    steps:
      plan.map((step) => ({
        step: step.step,
        name: step.name,
        status: step.status
      })),

    verification:
      taskAnalysis.verification || {
        required: true,
        checks: []
      }
  };
}

/* ============================================================
 * PUBLIC API
 * ============================================================
 */

module.exports = {
  analyzeTask,
  summarizePlan,

  // Exported for future unit tests and
  // future orchestration modules.
  classifyTask,
  detectCapabilities,
  buildPlan,
  buildVerification
};
