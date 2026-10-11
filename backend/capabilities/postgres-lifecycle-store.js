"use strict";

/**
 * Durable adapter for capability-lifecycle.js. The JSONB record is the
 * canonical checkpoint; indexed columns support operations dashboards.
 * Supply the application's existing pg Pool. No schema migration deletes data.
 */
function createPostgresLifecycleStore(pool) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL pool is required.");
  let schemaPromise;
  async function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = pool.query(`
        CREATE TABLE IF NOT EXISTS capability_lifecycle_runs (
          id UUID PRIMARY KEY,
          capability VARCHAR(64) NOT NULL,
          goal TEXT NOT NULL,
          status VARCHAR(24) NOT NULL,
          stage VARCHAR(40) NOT NULL,
          record JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).then(() => pool.query(`
        CREATE INDEX IF NOT EXISTS idx_capability_lifecycle_status_updated
        ON capability_lifecycle_runs (status, updated_at DESC)
      `)).catch(error => {
        schemaPromise = null;
        throw error;
      });
    }
    return schemaPromise;
  }
  return {
    async create(record) {
      await ensureSchema();
      if (!record?.id || !record?.capability || !record?.goal) throw new Error("Invalid lifecycle record.");
      const result = await pool.query(
        `INSERT INTO capability_lifecycle_runs (id, capability, goal, status, stage, record)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
        [record.id, record.capability, record.goal, record.status, record.stage, JSON.stringify(record)]
      );
      if (!result.rows?.[0]) throw new Error("Lifecycle record was not persisted.");
      return record;
    },
    async update(id, record) {
      await ensureSchema();
      if (String(id) !== String(record?.id)) throw new Error("Lifecycle update ID mismatch.");
      const result = await pool.query(
        `UPDATE capability_lifecycle_runs
         SET capability=$2, goal=$3, status=$4, stage=$5, record=$6::jsonb, updated_at=CURRENT_TIMESTAMP
         WHERE id=$1::uuid RETURNING id`,
        [id, record.capability, record.goal, record.status, record.stage, JSON.stringify(record)]
      );
      if (!result.rows?.[0]) throw new Error("Lifecycle record does not exist; update refused.");
      return record;
    },
    async get(id) {
      await ensureSchema();
      const result = await pool.query(
        "SELECT record FROM capability_lifecycle_runs WHERE id=$1::uuid LIMIT 1",
        [id]
      );
      return result.rows?.[0]?.record || null;
    },
    async list({ status = null, limit = 50, offset = 0 } = {}) {
      await ensureSchema();
      const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 50)));
      const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
      const result = status
        ? await pool.query("SELECT record FROM capability_lifecycle_runs WHERE status=$1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3", [String(status).slice(0, 24), safeLimit, safeOffset])
        : await pool.query("SELECT record FROM capability_lifecycle_runs ORDER BY updated_at DESC LIMIT $1 OFFSET $2", [safeLimit, safeOffset]);
      return (result.rows || []).map(row => row.record);
    }
  };
}

module.exports = { createPostgresLifecycleStore };
