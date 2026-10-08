"use strict";

/**
 * Nkwasibwe IRHCF Action Center
 *
 * Converts blocked/missing prerequisites into short user-facing
 * instructions with a direct action URL whenever one exists.
 *
 * It never exposes credentials or secrets.
 */

function createAction({
  id,
  severity = "info",
  title,
  message,
  actionLabel = null,
  actionUrl = null,
  category = "system",
  blocking = false,
  metadata = {}
}) {
  return {
    id: String(id),
    severity,
    title: String(title),
    message: String(message),
    actionLabel: actionLabel ? String(actionLabel) : null,
    actionUrl: actionUrl ? String(actionUrl) : null,
    category,
    blocking: Boolean(blocking),
    metadata
  };
}

function buildActionCenter({
  apiBaseUrl = "",
  authenticated = false,
  hasYoutubeAccount = false,
  hasMeetAccount = false,
  credentialsKeyConfigured = true,
  aiProviderConfigured = true,
  googleOAuthConfigured = true
} = {}) {
  const actions = [];

  if (!authenticated) {
    actions.push(
      createAction({
        id: "login-required",
        severity: "warning",
        title: "Injira muri konti yawe",
        message: "Kugira ngo ukoreshe tasks zihoraho, integrations na automation, banza winjire muri IRHCF.",
        actionLabel: "Injira",
        actionUrl: "/",
        category: "account",
        blocking: true
      })
    );
  }

  if (!aiProviderConfigured) {
    actions.push(
      createAction({
        id: "ai-provider-required",
        severity: "critical",
        title: "AI provider iracyakeneye configuration",
        message: "IRHCF ntishobora gutangiza AI execution yuzuye kugeza AI provider/API key ibonetse.",
        actionLabel: "Fungura Render",
        actionUrl: "https://dashboard.render.com",
        category: "configuration",
        blocking: true
      })
    );
  }

  if (!credentialsKeyConfigured) {
    actions.push(
      createAction({
        id: "credentials-key-required",
        severity: "critical",
        title: "Secure credentials key irakenewe",
        message: "Shyiraho IRHCF_CREDENTIALS_KEY mbere yo kubika OAuth/payment credentials mu buryo bwizewe.",
        actionLabel: "Fungura Render",
        actionUrl: "https://dashboard.render.com",
        category: "security",
        blocking: true
      })
    );
  }

  if (authenticated && !googleOAuthConfigured) {
    actions.push(
      createAction({
        id: "google-oauth-config-required",
        severity: "critical",
        title: "Google OAuth iracyakeneye configuration",
        message: "YouTube/Google Meet connection ntizakora kugeza Google OAuth Client ID, Client Secret na Redirect URI bishyizwe muri server.",
        actionLabel: "Fungura Render",
        actionUrl: "https://dashboard.render.com",
        category: "integration",
        blocking: true,
        metadata: { service: "google_oauth" }
      })
    );
  }

  if (authenticated && !hasYoutubeAccount) {
    actions.push(
      createAction({
        id: "youtube-connect-required",
        severity: "action",
        title: "Huza YouTube",
        message: "Kugira ngo IRHCF ibashe gutegura no kohereza videos kuri YouTube, huza channel yawe.",
        actionLabel: "Huza YouTube",
        actionUrl: `${apiBaseUrl}/api/integrations/google/authorize?service=youtube`,
        category: "integration",
        blocking: false,
        metadata: { service: "youtube" }
      })
    );
  }

  if (authenticated && !hasMeetAccount) {
    actions.push(
      createAction({
        id: "meet-connect-required",
        severity: "action",
        title: "Huza Google Meet",
        message: "Kugira ngo IRHCF ibashe gukoresha meeting workflows zemewe, huza Google account yawe.",
        actionLabel: "Huza Google Meet",
        actionUrl: `${apiBaseUrl}/api/integrations/google/authorize?service=meet`,
        category: "integration",
        blocking: false,
        metadata: { service: "google_meet" }
      })
    );
  }

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    actions,
    count: actions.length,
    blockingCount: actions.filter(action => action.blocking).length
  };
}

module.exports = {
  createAction,
  buildActionCenter
};
