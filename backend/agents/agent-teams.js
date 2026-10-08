"use strict";

/**
 * IRHCF SPECIALIST AGENT TEAM BUILDER
 *
 * This is the declarative team layer. It does not pretend that every
 * specialist already has every external tool. It determines the team
 * required for a request and exposes an execution contract that the
 * orchestrator can fulfill with configured tools/providers.
 */

const TEAMS = Object.freeze({
  software: {
    supervisor: "software_supervisor",
    agents: [
      "requirements",
      "architecture",
      "ui_ux",
      "frontend",
      "backend",
      "database",
      "api",
      "security",
      "testing",
      "deployment",
      "live_verification"
    ]
  },

  research: {
    supervisor: "research_supervisor",
    agents: [
      "research",
      "source_evaluation",
      "data_analysis",
      "fact_checking",
      "synthesis",
      "verification"
    ]
  },

  media: {
    supervisor: "media_supervisor",
    agents: [
      "lyrics",
      "composition",
      "language",
      "voice",
      "audio_processing",
      "mixing",
      "mastering",
      "visual_direction",
      "quality_verification"
    ]
  },

  video: {
    supervisor: "film_supervisor",
    agents: [
      "script",
      "storyboard",
      "character",
      "shot_design",
      "video_generation",
      "editing",
      "vfx",
      "color",
      "audio",
      "subtitles",
      "quality_control",
      "render"
    ]
  },

  automation: {
    supervisor: "automation_supervisor",
    agents: [
      "workflow",
      "integration",
      "scheduler",
      "authorization",
      "execution",
      "audit",
      "verification"
    ]
  },

  general: {
    supervisor: "general_supervisor",
    agents: [
      "planner",
      "research",
      "reasoning",
      "execution",
      "verification"
    ]
  }
});

const AGENT_DESCRIPTIONS = Object.freeze({
  requirements: "Convert natural-language goals into explicit acceptance criteria.",
  architecture: "Design safe, modular system architecture.",
  frontend: "Build user interfaces and client-side behavior.",
  backend: "Build server-side services and APIs.",
  database: "Design and validate persistence and data flows.",
  security: "Review permissions, secrets, inputs and attack surface.",
  testing: "Create and execute tests and regression checks.",
  deployment: "Prepare and verify deployment workflows.",
  research: "Gather and synthesize evidence from available sources.",
  source_evaluation: "Evaluate source quality and conflicting evidence.",
  fact_checking: "Check important claims before delivery.",
  synthesis: "Combine specialist outputs into a coherent result.",
  verification: "Verify final output against acceptance criteria.",
  lyrics: "Develop lyrics and lyrical structure.",
  composition: "Develop musical structure and arrangement plans.",
  language: "Adapt content to the requested language and locale.",
  voice: "Plan authorized voice/audio processing.",
  audio_processing: "Process, clean and transform audio through available tools.",
  mixing: "Balance and combine audio tracks.",
  mastering: "Prepare final audio for target delivery.",
  visual_direction: "Define visual style and media direction.",
  video_generation: "Coordinate available video-generation capabilities.",
  editing: "Assemble and edit media assets.",
  vfx: "Plan and apply available visual effects.",
  color: "Coordinate color treatment and consistency.",
  script: "Develop screenplays and scene dialogue.",
  storyboard: "Turn scripts into visual shot plans.",
  character: "Define characters, continuity and scene requirements.",
  shot_design: "Plan camera, framing and shot continuity.",
  subtitles: "Create and verify subtitles and language variants.",
  render: "Coordinate final rendering and output validation.",
  workflow: "Design executable multi-step workflows.",
  integration: "Coordinate authorized external integrations.",
  scheduler: "Manage recurring and delayed execution.",
  authorization: "Ensure external actions have explicit permission.",
  audit: "Record significant external actions and decisions.",
  execution: "Run approved tool actions.",
  reasoning: "Solve complex planning and reasoning steps.",
  planner: "Decompose goals into executable steps."
});

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function inferTeamTypes({
  taskType = "general",
  capabilities = [],
  mediaType = null
} = {}) {
  const types = new Set(["general"]);
  const type = normalize(taskType);
  const caps = new Set(
    Array.isArray(capabilities)
      ? capabilities.map(normalize)
      : []
  );

  if (
    type.includes("software") ||
    caps.has("code_generation") ||
    caps.has("software_architecture") ||
    caps.has("deployment")
  ) {
    types.add("software");
  }

  if (
    type.includes("research") ||
    caps.has("web_research") ||
    caps.has("source_evaluation")
  ) {
    types.add("research");
  }

  if (
    type.includes("media") ||
    caps.has("media_generation") ||
    caps.has("media_processing") ||
    ["audio", "music", "image"].includes(normalize(mediaType))
  ) {
    types.add("media");
  }

  if (
    type.includes("video") ||
    normalize(mediaType) === "video"
  ) {
    types.add("video");
  }

  if (
    type.includes("automation") ||
    caps.has("scheduling") ||
    caps.has("task_execution")
  ) {
    types.add("automation");
  }

  return [...types];
}

function buildAgentTeam(input = {}) {
  const types = inferTeamTypes(input);
  const teams = types.map((type) => ({
    type,
    ...(TEAMS[type] || TEAMS.general)
  }));

  const seen = new Set();
  const specialists = [];

  for (const team of teams) {
    for (const agent of team.agents) {
      if (!seen.has(agent)) {
        seen.add(agent);
        specialists.push({
          id: agent,
          description:
            AGENT_DESCRIPTIONS[agent] ||
            "Specialist IRHCF agent."
        });
      }
    }
  }

  return {
    teamTypes: types,
    supervisors: teams.map((team) => team.supervisor),
    specialists,
    count: specialists.length,
    executionPolicy: {
      requireVerification: true,
      requireSecurityReview:
        types.includes("software") ||
        types.includes("automation"),
      externalActionsRequireAuthorization:
        true
    }
  };
}

module.exports = {
  TEAMS,
  AGENT_DESCRIPTIONS,
  inferTeamTypes,
  buildAgentTeam
};
