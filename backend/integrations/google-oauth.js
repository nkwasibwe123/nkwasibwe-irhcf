"use strict";

const crypto = require("crypto");

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured.");
  return value;
}

function createState() {
  return crypto.randomBytes(32).toString("hex");
}

function buildAuthorizationUrl({
  clientId = requiredEnv("GOOGLE_CLIENT_ID"),
  redirectUri = requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  scopes = [],
  state = createState()
} = {}) {
  if (!Array.isArray(scopes) || !scopes.length) {
    throw new Error("At least one Google OAuth scope is required.");
  }

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

async function exchangeAuthorizationCode({
  code,
  clientId = requiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET"),
  redirectUri = requiredEnv("GOOGLE_OAUTH_REDIRECT_URI")
} = {}) {
  if (!code) throw new Error("Google authorization code is required.");

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error_description || "Google OAuth token exchange failed.");
    error.code = "GOOGLE_OAUTH_EXCHANGE_FAILED";
    throw error;
  }

  return payload;
}

async function refreshAccessToken({
  refreshToken,
  clientId = requiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET")
} = {}) {
  if (!refreshToken) throw new Error("Google refresh token is required.");

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token"
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error_description || "Google OAuth token refresh failed.");
    error.code = "GOOGLE_OAUTH_REFRESH_FAILED";
    throw error;
  }

  return payload;
}

module.exports = {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  createState,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken
};
