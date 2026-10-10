"use strict";

const { IRHCFSearchEngine, normalizeUrl } = require("../core/search-engine");
const { createWebSearchProviders } = require("../core/web-search-providers");
const { createSearchStore } = require("../core/search-store");
const { buildSearchContext } = require("../core/search-context");
const pool = require("../db/pool");

const engine = new IRHCFSearchEngine({
  maxDocuments: Number(process.env.IRHCF_SEARCH_MAX_DOCUMENTS) || 50000,
  providers: createWebSearchProviders()
});
const persistenceConfigured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const store = createSearchStore({ pool, enabled: persistenceConfigured });
let loadingPromise = null;
let storageWarning = null;

const MAX_INDEX_TEXT = 100000;
const MAX_BATCH = 100;

function clean(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function ensureIndexLoaded() {
  if (!store.enabled) return;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const documents = await store.loadAll({ limit: engine.maxDocuments });
      for (const document of documents) {
        try { engine.indexDocument(document); } catch { /* Skip malformed legacy rows safely. */ }
      }
    })().catch(() => {
      storageWarning = "PostgreSQL search persistence is unavailable; in-memory search remains active.";
      // Keep the API usable when the optional database store is temporarily down.
      loadingPromise = Promise.resolve();
    });
  }
  return loadingPromise;
}

async function searchIRHCF(query, options = {}) {
  await ensureIndexLoaded();
  return engine.search(clean(query, 1000), {
    limit: Math.max(1, Math.min(Number(options.limit) || 5, 10)),
    web: options.web !== false,
    language: clean(options.language || "auto", 10)
  });
}

function registerSearchRoutes(app, authenticateToken) {
  app.get("/api/search", authenticateToken, async (req, res) => {
    try {
      await ensureIndexLoaded();
      const query = clean(req.query.q || req.query.query, 1000);
      if (!query) return res.status(400).json({ success: false, error: "A search query is required.", code: "SEARCH_QUERY_REQUIRED" });
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
      const web = String(req.query.web || "true").toLowerCase() !== "false";
      const result = await engine.search(query, { limit, web, language: clean(req.query.language || "auto", 10) });
      return res.json({ success: true, engine: "IRHCF Search", ...result, persistenceWarning: storageWarning });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Search failed.", code: "SEARCH_FAILED" });
    }
  });

  // Source-labelled context endpoint for AI/research workflows. It returns evidence separately from instructions.
  app.get("/api/search/context", authenticateToken, async (req, res) => {
    try {
      await ensureIndexLoaded();
      const query = clean(req.query.q || req.query.query, 1000);
      if (!query) return res.status(400).json({ success: false, error: "A search query is required.", code: "SEARCH_QUERY_REQUIRED" });
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 10));
      const web = String(req.query.web || "true").toLowerCase() !== "false";
      const result = await engine.search(query, { limit, web, language: clean(req.query.language || "auto", 10) });
      return res.json({
        success: true,
        engine: "IRHCF Search",
        ...buildSearchContext(result)
      });
    } catch {
      return res.status(500).json({ success: false, error: "Unable to build search context.", code: "SEARCH_CONTEXT_FAILED" });
    }
  });

  app.get("/api/search/status", authenticateToken, async (req, res) => {
    let persistence = { enabled: false, persistent: false };
    try {
      await ensureIndexLoaded();
      persistence = await store.status();
      storageWarning = null;
    } catch {
      storageWarning = "PostgreSQL search persistence is unavailable; in-memory search remains active.";
    }
    return res.json({
      success: true,
      engine: "IRHCF Search",
      localIndex: { documents: engine.documents.size, maxDocuments: engine.maxDocuments },
      providers: engine.listProviders(),
      webSearchConfigured: engine.listProviders().length > 0,
      persistence,
      persistenceWarning: storageWarning
    });
  });

  app.post("/api/search/documents", authenticateToken, async (req, res) => {
    try {
      await ensureIndexLoaded();
      const body = req.body || {};
      const documents = Array.isArray(body.documents) ? body.documents : [body];
      if (!documents.length || documents.length > MAX_BATCH) {
        return res.status(400).json({ success: false, error: `Provide between 1 and ${MAX_BATCH} documents.`, code: "SEARCH_BATCH_LIMIT" });
      }
      const indexed = [];
      for (const document of documents) {
        if (!document || typeof document !== "object") {
          return res.status(400).json({ success: false, error: "Each document must be an object.", code: "INVALID_SEARCH_DOCUMENT" });
        }
        const text = clean(document.text || document.content, MAX_INDEX_TEXT);
        const title = clean(document.title, 500);
        const id = clean(document.id, 200);
        const url = document.url ? normalizeUrl(document.url) : null;
        if (!id || !title || !text) {
          return res.status(400).json({ success: false, error: "Each document requires id, title, and text/content.", code: "INVALID_SEARCH_DOCUMENT" });
        }
        if (document.url && !url) {
          return res.status(400).json({ success: false, error: "Only valid HTTP or HTTPS document URLs are accepted.", code: "INVALID_SEARCH_URL" });
        }
        indexed.push({ id, title, text, url, language: clean(document.language || "und", 20) });
      }
      // Reject batches that exceed capacity before making any database or memory changes.
      const newIds = new Set(indexed.map(document => document.id)
        .filter(id => !engine.documents.has(id)));
      if (engine.documents.size + newIds.size > engine.maxDocuments) {
        return res.status(413).json({
          success: false,
          error: "The local search index has reached its configured capacity.",
          code: "SEARCH_INDEX_FULL"
        });
      }
      // Persist first so a failed database write never reports a durable success.
      if (store.enabled) {
        for (const document of indexed) await store.upsert(document);
      }
      const results = indexed.map(document => engine.indexDocument(document));
      storageWarning = null;
      return res.status(201).json({
        success: true, indexed: results.length, results,
        index: { documents: engine.documents.size },
        persistence: { enabled: store.enabled, persistent: store.enabled }
      });
    } catch (error) {
      const isLimit = /limit reached/i.test(String(error?.message));
      storageWarning = store.enabled ? "A search index operation failed; check PostgreSQL connectivity." : storageWarning;
      return res.status(isLimit ? 413 : 500).json({
        success: false,
        error: isLimit ? "The local search index has reached its configured capacity." : "Unable to index documents.",
        code: isLimit ? "SEARCH_INDEX_FULL" : "SEARCH_INDEX_FAILED"
      });
    }
  });

  app.delete("/api/search/documents/:id", authenticateToken, async (req, res) => {
    try {
      await ensureIndexLoaded();
      const id = clean(req.params.id, 200);
      if (!id) return res.status(400).json({ success: false, error: "Document id is required." });
      const removedFromMemory = engine.removeDocument(id);
      const removedFromStore = store.enabled ? await store.remove(id) : false;
      const removed = removedFromMemory || removedFromStore;
      return res.status(removed ? 200 : 404).json({
        success: removed,
        removed,
        code: removed ? undefined : "SEARCH_DOCUMENT_NOT_FOUND"
      });
    } catch {
      return res.status(500).json({ success: false, error: "Unable to remove search document.", code: "SEARCH_DELETE_FAILED" });
    }
  });
}

module.exports = { registerSearchRoutes, searchEngine: engine, searchStore: store, searchIRHCF };
