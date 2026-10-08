"use strict";

/**
 * Database-backed capability registry.
 * Keeps the declarative capability engine and persistent DB registry aligned.
 */

const { listCapabilities } = require("../core/capability-engine");

class CapabilityRegistry {
  constructor(pool) {
    if (!pool) throw new Error("CapabilityRegistry requires a PostgreSQL pool.");
    this.pool = pool;
  }

  async syncBuiltIns() {
    const capabilities = listCapabilities();

    for (const capability of capabilities) {
      await this.pool.query(
        `INSERT INTO capabilities
          (name, description, category, module_path, enabled, version, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           module_path = EXCLUDED.module_path,
           version = EXCLUDED.version,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [
          capability.name,
          `IRHCF registered capability: ${capability.name}`,
          capability.category,
          null,
          capability.status === "available",
          "1.0.0",
          JSON.stringify({
            agent: capability.agent,
            declaredStatus: capability.status
          })
        ]
      );
    }

    return capabilities.length;
  }

  async list({ enabledOnly = false } = {}) {
    const result = await this.pool.query(
      `SELECT *
       FROM capabilities
       ${enabledOnly ? "WHERE enabled = TRUE" : ""}
       ORDER BY category ASC, name ASC`
    );
    return result.rows;
  }

  async get(name) {
    const result = await this.pool.query(
      `SELECT *
       FROM capabilities
       WHERE name = $1
       LIMIT 1`,
      [String(name || "").trim().toLowerCase()]
    );
    return result.rows[0] || null;
  }

  async setEnabled(name, enabled) {
    const result = await this.pool.query(
      `UPDATE capabilities
       SET enabled = $2, updated_at = CURRENT_TIMESTAMP
       WHERE name = $1
       RETURNING *`,
      [String(name || "").trim().toLowerCase(), Boolean(enabled)]
    );
    return result.rows[0] || null;
  }
}

module.exports = { CapabilityRegistry };
