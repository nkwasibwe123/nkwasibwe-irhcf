"use strict";

/**
 * Meeting control contract.
 *
 * Google Meet/other meeting providers are injected. The controller
 * only defines the authorization boundary and lifecycle needed by
 * the master orchestrator.
 */

const MEETING_ACTIONS = Object.freeze([
  "create",
  "join",
  "listen",
  "speak",
  "end",
  "participants",
  "transcript"
]);

function requireAuthorization(authorized) {
  if (!authorized) {
    const error = new Error("Explicit meeting authorization is required.");
    error.code = "MEETING_AUTHORIZATION_REQUIRED";
    throw error;
  }
}

async function createMeeting(provider, { authorized = false, ...input } = {}) {
  requireAuthorization(authorized);
  if (!provider || typeof provider.createMeeting !== "function") {
    throw new Error("No configured meeting provider is available.");
  }
  return provider.createMeeting(input);
}

async function joinMeeting(provider, { authorized = false, ...input } = {}) {
  requireAuthorization(authorized);
  if (!provider || typeof provider.joinMeeting !== "function") {
    throw new Error("No configured meeting provider is available.");
  }
  return provider.joinMeeting(input);
}

async function getParticipants(provider, { authorized = false, ...input } = {}) {
  requireAuthorization(authorized);
  if (!provider || typeof provider.getParticipants !== "function") {
    throw new Error("Meeting participant access is not configured.");
  }
  return provider.getParticipants(input);
}

module.exports = {
  MEETING_ACTIONS,
  createMeeting,
  joinMeeting,
  getParticipants
};
