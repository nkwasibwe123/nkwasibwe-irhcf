"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCriticalConfig } = require("./production-config");

test("production config fails closed when database URL is missing", () => {
  assert.throws(
    () => validateCriticalConfig({ environment: "production", databaseUrl: "", jwtSecret: "configured" }),
    error => error.code === "CRITICAL_PRODUCTION_CONFIG_MISSING" && error.missing.includes("DATABASE_URL")
  );
});

test("production config fails closed when JWT secret is missing", () => {
  assert.throws(
    () => validateCriticalConfig({ environment: "production", databaseUrl: "postgres://configured", jwtSecret: "" }),
    error => error.code === "CRITICAL_PRODUCTION_CONFIG_MISSING" && error.missing.includes("JWT_SECRET")
  );
});

test("development config remains non-fatal but reports missing values", () => {
  assert.deepEqual(
    validateCriticalConfig({ environment: "development", databaseUrl: "", jwtSecret: "" }),
    { missing: ["DATABASE_URL", "JWT_SECRET"] }
  );
});

test("complete production config passes", () => {
  assert.deepEqual(
    validateCriticalConfig({ environment: "production", databaseUrl: "postgres://configured", jwtSecret: "configured" }),
    { missing: [] }
  );
});
