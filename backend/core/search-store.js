"use strict";

/**
 * Optional PostgreSQL persistence for IRHCF's own search index.
 * Search remains usable in memory if PostgreSQL is unavailable; when configured,
 * indexed documents survive process restarts.
 */
function createSearchStore({ pool, enabled = true } = {}) {
  let initPromise;
  const isEnabled = Boolean(enabled && pool && typeof pool.query === "function");

  async function initialize() {
    if (!isEnabled) return false;
    if (!initPromise) {
      initPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS irhcf_search_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            url TEXT,
            language TEXT NOT NULL DEFAULT 'und',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_irhcf_search_documents_updated
          ON irhcf_search_documents (updated_at DESC)
        `);
        return true;
      })().catch(error => {
        initPromise = null;
        throw error;
      });
    }
    return initPromise;
  }

  return {
    enabled: isEnabled,
    async loadAll({ limit = 50000 } = {}) {
      if (!isEnabled) return [];
      await initialize();
      const result = await pool.query(
        "SELECT id, title, content AS text, url, language FROM irhcf_search_documents ORDER BY updated_at DESC LIMIT $1",
        [Math.max(1, Math.min(Number(limit) || 50000, 50000))]
      );
      return result.rows || [];
    },
    async upsert(document) {
      if (!isEnabled) return false;
      await initialize();
      await pool.query(`
        INSERT INTO irhcf_search_documents (id, title, content, url, language, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          url = EXCLUDED.url,
          language = EXCLUDED.language,
          updated_at = NOW()
      `, [document.id, document.title, document.text, document.url || null, document.language || "und"]);
      return true;
    },
    async remove(id) {
      if (!isEnabled) return false;
      await initialize();
      const result = await pool.query("DELETE FROM irhcf_search_documents WHERE id = $1", [id]);
      return Number(result.rowCount || 0) > 0;
    },
    async status() {
      if (!isEnabled) return { enabled: false, persistent: false };
      await initialize();
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM irhcf_search_documents");
      return { enabled: true, persistent: true, documents: Number(result.rows?.[0]?.count || 0) };
    }
  };
}

module.exports = { createSearchStore };
