"use strict";

const { IRHCFSearchEngine, normalizeUrl } = require("../core/search-engine");

const engine = new IRHCFSearchEngine({
  maxDocuments: Number(process.env.IRHCF_SEARCH_MAX_DOCUMENTS) || 50000
});

const MAX_INDEX_TEXT = 100000;
const MAX_BATCH = 100;

function clean(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function registerSearchRoutes(app, authenticateToken) {
  app.get("/api/search", authenticateToken, async (req, res) => {
    try {
      const query = clean(req.query.q || req.query.query, 1000);
      if (!query) return res.status(400).json({ success: false, error: "A search query is required.", code: "SEARCH_QUERY_REQUIRED" });
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
      const result = await engine.search(query, { limit });
      return res.json({ success: true, engine: "IRHCF Search", ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Search failed.", code: "SEARCH_FAILED" });
    }
  });

  app.get("/api/search/status", authenticateToken, (req, res) => {
    res.json({
      success: true,
      engine: "IRHCF Search",
      localIndex: { documents: engine.documents.size, maxDocuments: engine.maxDocuments },
      providers: engine.listProviders(),
      webSearchConfigured: engine.listProviders().length > 0
    });
  });

  app.post("/api/search/documents", authenticateToken, (req, res) => {
    try {
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
      const results = indexed.map(document => engine.indexDocument(document));
      return res.status(201).json({ success: true, indexed: results.length, results, index: { documents: engine.documents.size } });
    } catch (error) {
      const isLimit = /limit reached/i.test(String(error?.message));
      return res.status(isLimit ? 413 : 500).json({
        success: false,
        error: isLimit ? "The local search index has reached its configured capacity." : "Unable to index documents.",
        code: isLimit ? "SEARCH_INDEX_FULL" : "SEARCH_INDEX_FAILED"
      });
    }
  });

  app.delete("/api/search/documents/:id", authenticateToken, (req, res) => {
    const id = clean(req.params.id, 200);
    if (!id) return res.status(400).json({ success: false, error: "Document id is required." });
    const removed = engine.removeDocument(id);
    return res.status(removed ? 200 : 404).json({
      success: removed,
      removed,
      code: removed ? undefined : "SEARCH_DOCUMENT_NOT_FOUND"
    });
  });
}

module.exports = { registerSearchRoutes, searchEngine: engine };
