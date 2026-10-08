"use strict";

/*
 * ============================================================
 * NKWASIBWE IRHCF
 * MASTER AGENT ROUTER
 * PART 1 / SAFE ROUTING FOUNDATION
 * ============================================================
 *
 * The router decides WHICH specialized agent should own a task.
 * It does not execute arbitrary tools and does not bypass
 * authentication, capability checks, security policy, testing,
 * or verification.
 * ============================================================
 */

const ROUTER_NAME = "Nkwasibwe Master Agent Router";
const ROUTER_VERSION = "1.0.0";

const ROUTES = Object.freeze({
  software_build: ["coding", "verification"],
  software_engineering: ["coding", "verification"],
  research: ["research", "verification"],
  content_creation: ["writing", "verification"],
  media: ["media", "verification"],
  automation: ["automation", "verification"],
  account_automation: ["automation", "security", "verification"],
  meeting: ["voice", "automation", "verification"],
  project_autopilot: ["planner", "research", "coding", "media", "automation", "security", "verification"],
  business: ["research", "data", "writing", "verification"],
  planning: ["planner", "verification"],
  general: ["core", "verification"]
});

const AGENT_ROLES = Object.freeze({
  core: {
    name: "Core Reasoning Agent",
    domains: ["reasoning", "response_generation"]
  },
  planner: {
    name: "Planner Agent",
    domains: ["planning", "task_decomposition"]
  },
  research: {
    name: "Research Agent",
    domains: [
      "web_research",
      "source_evaluation",
      "information_synthesis"
    ]
  },
  coding: {
    name: "Coding Agent",
    domains: [
      "requirements_analysis",
      "software_architecture",
      "code_analysis",
      "code_generation",
      "debugging"
    ]
  },
  education: {
    name: "Education Agent",
    domains: ["reasoning", "content_generation"]
  },
  writing: {
    name: "Writing Agent",
    domains: ["content_generation", "editing"]
  },
  data: {
    name: "Data Agent",
    domains: ["database_operations", "analytics"]
  },
  media: {
    name: "Media Agent",
    domains: [
      "media_generation",
      "media_processing"
    ]
  },
  voice: {
    name: "Voice Agent",
    domains: ["voice_processing", "meeting_control"]
  },
  automation: {
    name: "Automation Agent",
    domains: [
      "account_control",
      "browser_automation",
      "youtube_publishing",
      "meeting_control",
      "task_execution",
      "scheduling",
      "monitoring",
      "deployment"
    ]
  },
  security: {
    name: "Security Agent",
    domains: ["verification", "quality_review"]
  },
  verification: {
    name: "Verification Agent",
    domains: ["testing", "verification", "quality_review"]
  }
});

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function routeTask(classification = {}, capabilities = []) {
  const type = normalizeType(classification.type) || "general";
  const requested = Array.isArray(capabilities) ? capabilities : [];

  const roleNames = ROUTES[type] || ROUTES.general;
  const agents = roleNames.map((role) => {
    const definition = AGENT_ROLES[role];
    const matchedCapabilities = requested.filter((capability) =>
      definition?.domains.includes(capability)
    );

    return {
      role,
      name: definition?.name || role,
      matchedCapabilities,
      primary: role === roleNames[0]
    };
  });

  return {
    router: {
      name: ROUTER_NAME,
      version: ROUTER_VERSION
    },
    classificationType: type,
    agents,
    collaboration: agents.length > 1,
    executionPolicy: {
      authenticated: true,
      capabilityCheckRequired: true,
      securityReviewRequired: true,
      verificationRequired: true,
      externalActionRequiresAuthorization: true
    }
  };
}

function getAgentDefinition(role) {
  return AGENT_ROLES[normalizeType(role)] || null;
}

module.exports = {
  ROUTER_NAME,
  ROUTER_VERSION,
  ROUTES,
  AGENT_ROLES,
  routeTask,
  getAgentDefinition
};
