"use strict";

function validateCriticalConfig({ environment = "development", databaseUrl = "", jwtSecret = "" } = {}) {
  const missing = [];
  if (!String(databaseUrl || "").trim()) missing.push("DATABASE_URL");
  if (!String(jwtSecret || "").trim()) missing.push("JWT_SECRET");

  if (String(environment).trim().toLowerCase() === "production" && missing.length) {
    const error = new Error(`Missing required production configuration: ${missing.join(", ")}`);
    error.code = "CRITICAL_PRODUCTION_CONFIG_MISSING";
    error.missing = missing;
    throw error;
  }

  return { missing };
}

module.exports = { validateCriticalConfig };
