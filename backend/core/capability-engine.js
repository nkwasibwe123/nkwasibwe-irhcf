"use strict";

/*
 * ============================================================
 * NKWASIBWE IRHCF
 * CAPABILITY ENGINE
 * PART 1 / FOUNDATION
 * ============================================================
 *
 * Safe capability lifecycle:
 *
 * REQUEST
 *   -> CHECK
 *   -> DISCOVER
 *   -> DESIGN
 *   -> BUILD PLAN
 *   -> SANDBOX
 *   -> TEST
 *   -> SECURITY REVIEW
 *   -> REGISTER
 *   -> EXECUTE
 *   -> VERIFY
 *
 * This module is intentionally dependency-free.
 * It does not execute arbitrary code and does not mutate
 * production files. It produces a safe capability decision
 * and an expansion plan for the execution layer.
 * ============================================================
 */

const ENGINE_NAME = "Nkwasibwe Capability Engine";
const ENGINE_VERSION = "1.0.0";

const STATUS = Object.freeze({
  AVAILABLE: "available",
  MISSING: "missing",
  DISCOVERY_REQUIRED: "discovery_required",
  BLOCKED: "blocked"
});

const CAPABILITIES = Object.freeze({
  reasoning: {
    name: "reasoning",
    category: "core",
    status: STATUS.AVAILABLE,
    agent: "core"
  },

  response_generation: {
    name: "response_generation",
    category: "core",
    status: STATUS.AVAILABLE,
    agent: "core"
  },

  requirements_analysis: {
    name: "requirements_analysis",
    category: "software",
    status: STATUS.AVAILABLE,
    agent: "coding"
  },

  software_architecture: {
    name: "software_architecture",
    category: "software",
    status: STATUS.AVAILABLE,
    agent: "coding"
  },

  code_analysis: {
    name: "code_analysis",
    category: "software",
    status: STATUS.AVAILABLE,
    agent: "coding"
  },

  code_generation: {
    name: "code_generation",
    category: "software",
    status: STATUS.AVAILABLE,
    agent: "coding"
  },

  debugging: {
    name: "debugging",
    category: "software",
    status: STATUS.AVAILABLE,
    agent: "coding"
  },

  testing: {
    name: "testing",
    category: "verification",
    status: STATUS.AVAILABLE,
    agent: "verification"
  },

  verification: {
    name: "verification",
    category: "verification",
    status: STATUS.AVAILABLE,
    agent: "verification"
  },

  quality_review: {
    name: "quality_review",
    category: "verification",
    status: STATUS.AVAILABLE,
    agent: "verification"
  },

  task_decomposition: {
    name: "task_decomposition",
    category: "orchestration",
    status: STATUS.AVAILABLE,
    agent: "planner"
  },

  planning: {
    name: "planning",
    category: "orchestration",
    status: STATUS.AVAILABLE,
    agent: "planner"
  },

  web_research: {
    name: "web_research",
    category: "research",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "research"
  },

  source_evaluation: {
    name: "source_evaluation",
    category: "research",
    status: STATUS.AVAILABLE,
    agent: "research"
  },

  information_synthesis: {
    name: "information_synthesis",
    category: "research",
    status: STATUS.AVAILABLE,
    agent: "research"
  },

  content_generation: {
    name: "content_generation",
    category: "writing",
    status: STATUS.AVAILABLE,
    agent: "writing"
  },

  editing: {
    name: "editing",
    category: "writing",
    status: STATUS.AVAILABLE,
    agent: "writing"
  },

  media_generation: {
    name: "media_generation",
    category: "media",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "media"
  },

  media_processing: {
    name: "media_processing",
    category: "media",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "media"
  },

  voice_processing: {
    name: "voice_processing",
    category: "media",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "voice"
  },

  database_operations: {
    name: "database_operations",
    category: "data",
    status: STATUS.AVAILABLE,
    agent: "data"
  },

  file_operations: {
    name: "file_operations",
    category: "data",
    status: STATUS.AVAILABLE,
    agent: "data"
  },

  deployment: {
    name: "deployment",
    category: "automation",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "automation"
  },

  browser_or_web_access: {
    name: "browser_or_web_access",
    category: "research",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "research"
  },

  scheduling: {
    name: "scheduling",
    category: "automation",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "automation"
  },

  monitoring: {
    name: "monitoring",
    category: "automation",
    status: STATUS.DISCOVERY_REQUIRED,
    agent: "automation"
  },

  task_execution: {
    name: "task_execution",
    category: "execution",
    status: STATUS.AVAILABLE,
    agent: "executor"
  },

  market_analysis: {
    name: "market_analysis",
    category: "business",
    status: STATUS.AVAILABLE,
    agent: "research"
  },

  analytics: {
    name: "analytics",
    category: "data",
    status: STATUS.AVAILABLE,
    agent: "data"
  }
});

function normalizeCapabilityName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_:-]/g, "");
}

function getCapability(name) {
  const key = normalizeCapabilityName(name);
  return CAPABILITIES[key] || null;
}

function listCapabilities() {
  return Object.values(CAPABILITIES).map((capability) => ({
    ...capability
  }));
}

function checkCapabilities(requiredCapabilities = []) {
  const required = Array.isArray(requiredCapabilities)
    ? requiredCapabilities
    : [];

  const results = required.map((name) => {
    const key = normalizeCapabilityName(name);
    const capability = getCapability(key);

    if (!capability) {
      return {
        name: key,
        status: STATUS.MISSING,
        available: false,
        discoveryRequired: true,
        agent: null
      };
    }

    return {
      name: capability.name,
      status: capability.status,
      available: capability.status === STATUS.AVAILABLE,
      discoveryRequired:
        capability.status === STATUS.DISCOVERY_REQUIRED,
      agent: capability.agent
    };
  });

  return {
    required: results,
    allAvailable: results.every((item) => item.available),
    missing: results.filter(
      (item) => item.status === STATUS.MISSING
    ),
    discoveryRequired: results.filter(
      (item) => item.discoveryRequired
    )
  };
}

function buildExpansionPlan(capabilityResult) {
  const targets = [
    ...(capabilityResult?.missing || []),
    ...(capabilityResult?.discoveryRequired || [])
  ];

  const unique = [];
  const seen = new Set();

  for (const target of targets) {
    if (!target?.name || seen.has(target.name)) {
      continue;
    }

    seen.add(target.name);
    unique.push(target);
  }

  return {
    required: unique.length > 0,
    safe: true,
    stages: unique.length
      ? [
          {
            stage: 1,
            name: "discover",
            action:
              "Identify approved providers, tools, APIs, libraries, and implementation options."
          },
          {
            stage: 2,
            name: "research",
            action:
              "Evaluate reliability, compatibility, licensing, security, cost, and operational requirements."
          },
          {
            stage: 3,
            name: "design",
            action:
              "Define an isolated adapter and capability contract without modifying unrelated production modules."
          },
          {
            stage: 4,
            name: "build",
            action:
              "Implement the capability adapter in an isolated module."
          },
          {
            stage: 5,
            name: "sandbox",
            action:
              "Run the new implementation in an isolated test environment."
          },
          {
            stage: 6,
            name: "test",
            action:
              "Run unit, integration, failure, regression, and boundary tests."
          },
          {
            stage: 7,
            name: "security_review",
            action:
              "Review permissions, secrets, input validation, network access, data isolation, and abuse controls."
          },
          {
            stage: 8,
            name: "register",
            action:
              "Register only a verified capability with explicit metadata and version information."
          },
          {
            stage: 9,
            name: "execute",
            action:
              "Allow production execution only after verification and policy checks pass."
          },
          {
            stage: 10,
            name: "verify",
            action:
              "Verify the actual result before reporting completion."
          }
        ]
      : []
  };
}

function evaluateCapabilities(requiredCapabilities = []) {
  const checked = checkCapabilities(requiredCapabilities);

  return {
    engine: {
      name: ENGINE_NAME,
      version: ENGINE_VERSION
    },
    ...checked,
    expansion: buildExpansionPlan(checked),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  ENGINE_NAME,
  ENGINE_VERSION,
  STATUS,
  CAPABILITIES,
  normalizeCapabilityName,
  getCapability,
  listCapabilities,
  checkCapabilities,
  buildExpansionPlan,
  evaluateCapabilities
};
