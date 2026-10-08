"use strict";

const { decryptJson, encryptJson } = require("../core/secure-credentials");
const { refreshAccessToken } = require("./google-oauth");

async function getActiveAccount(pool, userId, platform) {
  const result = await pool.query(
    `SELECT *
     FROM connected_accounts
     WHERE user_id = $1
       AND platform = $2
       AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, platform]
  );

  return result.rows[0] || null;
}

async function getGoogleCredentials(pool, account) {
  if (!account) throw new Error("Connected Google account not found.");

  const credentials = decryptJson(account.encrypted_credentials);

  const expiresAt =
    Number(credentials.expires_at || 0) ||
    (credentials.expires_in
      ? Date.now() + Number(credentials.expires_in) * 1000
      : 0);

  if (
    credentials.access_token &&
    (!expiresAt || Date.now() + 60000 < expiresAt)
  ) {
    return credentials;
  }

  if (!credentials.refresh_token) {
    throw new Error("Google account requires reauthorization.");
  }

  const refreshed = await refreshAccessToken({
    refreshToken: credentials.refresh_token
  });

  const next = {
    ...credentials,
    ...refreshed,
    refresh_token:
      refreshed.refresh_token || credentials.refresh_token,
    expires_at:
      Date.now() + Number(refreshed.expires_in || 3600) * 1000
  };

  await pool.query(
    `UPDATE connected_accounts
     SET encrypted_credentials = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [encryptJson(next), account.id]
  );

  return next;
}

module.exports = {
  getActiveAccount,
  getGoogleCredentials
};
