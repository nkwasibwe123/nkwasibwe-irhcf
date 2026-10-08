"use strict";

/**
 * Project Autopilot.
 *
 * Converts a project idea into an executable lifecycle. It intentionally
 * separates "idea detected" from "side effects performed". Actual work
 * is delegated to the persistent task engine and approved execution
 * adapters.
 */

const PROJECT_TYPES = Object.freeze([
  "software",
  "website",
  "mobile_app",
  "media",
  "music",
  "video",
  "research",
  "business",
  "automation",
  "general"
]);

const PROJECT_PHASES = Object.freeze([
  "DISCOVER",
  "REQUIREMENTS",
  "RESEARCH",
  "ARCHITECTURE",
  "BUILD",
  "TEST",
  "SECURITY_REVIEW",
  "VERIFY",
  "DEPLOY",
  "MONITOR",
  "DELIVER"
]);

function normalize(value, max = 5000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function inferProjectType(idea) {
  const text = normalize(idea).toLowerCase();

  if (/website|web app|web application|urubuga/.test(text)) return "website";
  if (/mobile app|android app|ios app|app/.test(text)) return "mobile_app";
  if (/song|music|indirimbo/.test(text)) return "music";
  if (/video|film|movie|cinema/.test(text)) return "video";
  if (/image|photo|poster|logo/.test(text)) return "media";
  if (/research|study|sesengura|shakisha/.test(text)) return "research";
  if (/business|company|startup|ubucuruzi/.test(text)) return "business";
  if (/schedule|daily|weekly|automatic|automation/.test(text)) return "automation";
  if (/software|program|system|platform|api|database|code/.test(text)) return "software";
  return "general";
}

function buildProjectPlan({
  idea,
  userId = null,
  requestedDeadline = null,
  autonomous = true
} = {}) {
  const cleanIdea = normalize(idea, 20000);

  if (!cleanIdea) throw new Error("A project idea is required.");

  const type = inferProjectType(cleanIdea);

  return {
    projectId: "project_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9),
    userId,
    type,
    idea: cleanIdea,
    autonomous: Boolean(autonomous),
    requestedDeadline: requestedDeadline || null,
    phases: PROJECT_PHASES.map((phase, index) => ({
      order: index + 1,
      phase,
      status: "planned",
      checkpointRequired: ["TEST", "SECURITY_REVIEW", "VERIFY", "DEPLOY"].includes(phase)
    })),
    policies: {
      researchBeforeBuild: true,
      testBeforeDeploy: true,
      securityReviewBeforeExternalAction: true,
      verifyBeforeClaimingCompletion: true,
      askUserBeforeIrreversibleAction: true,
      preserveExistingWork: true
    },
    createdAt: new Date().toISOString()
  };
}

function shouldBecomeLongRunning(projectPlan) {
  if (!projectPlan) return false;

  return (
    projectPlan.phases.length >= 7 ||
    ["software", "website", "mobile_app", "video", "business", "automation"].includes(projectPlan.type)
  );
}

module.exports = {
  PROJECT_TYPES,
  PROJECT_PHASES,
  inferProjectType,
  buildProjectPlan,
  shouldBecomeLongRunning
};
