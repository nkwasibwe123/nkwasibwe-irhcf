"use strict";

/** IRHCF-owned local index plus optional federated web-search adapters. */
const MAX_QUERY_LENGTH = 1000;
const MAX_DOCUMENTS = 50000;
const MAX_TEXT_LENGTH = 100000;
const MAX_RESULTS = 50;

function normalizeText(value, limit = MAX_TEXT_LENGTH) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}
function tokenize(value) {
  return normalizeText(value).toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[\p{L}\p{N}]+/gu) || [];
}
function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

class IRHCFSearchEngine {
  constructor({ providers = [], maxDocuments = MAX_DOCUMENTS } = {}) {
    this.providers = providers.filter(p => p && typeof p.search === "function");
    this.maxDocuments = Math.max(1, Math.min(Number(maxDocuments) || MAX_DOCUMENTS, MAX_DOCUMENTS));
    this.documents = new Map();
  }
  listProviders() {
    return this.providers.map((p, i) => ({
      name: normalizeText(p.name || `provider_${i + 1}`, 80),
      type: "external_web_adapter", configured: true
    }));
  }
  indexDocument(document = {}) {
    const id = normalizeText(document.id, 200);
    const title = normalizeText(document.title, 500);
    const text = normalizeText(document.text || document.content);
    if (!id || !title || !text) throw new Error("Document id, title and text are required.");
    if (this.documents.size >= this.maxDocuments && !this.documents.has(id)) {
      throw new Error("Local search index document limit reached.");
    }
    this.documents.set(id, {
      id, title, text,
      url: document.url ? normalizeUrl(document.url) : null,
      language: normalizeText(document.language || "und", 20),
      terms: tokenize(title + " " + text)
    });
    return { id, indexed: true, documentCount: this.documents.size };
  }
  removeDocument(id) { return this.documents.delete(normalizeText(id, 200)); }
  searchLocal(query, limit = 10) {
    const queryTerms = [...new Set(tokenize(query))];
    const ranked = [];
    for (const doc of this.documents.values()) {
      const titleTerms = tokenize(doc.title);
      const counts = new Map();
      for (const term of doc.terms) counts.set(term, (counts.get(term) || 0) + 1);
      let score = 0;
      for (const term of queryTerms) {
        const count = counts.get(term) || 0;
        if (count) score += (titleTerms.includes(term) ? 4 : 1) * (1 + Math.log(count));
      }
      if (score) ranked.push({
        title: doc.title, url: doc.url, snippet: doc.text.slice(0, 400),
        source: "irhcf_local_index", score: Number(score.toFixed(4)),
        language: doc.language, retrievedAt: new Date().toISOString()
      });
    }
    return ranked.sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(limit, MAX_RESULTS)));
  }
  async search(query, { limit = 10, web = true, language = "auto" } = {}) {
    const cleanQuery = normalizeText(query, MAX_QUERY_LENGTH);
    if (!cleanQuery) throw new Error("A search query is required.");
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, MAX_RESULTS));
    const localResults = this.searchLocal(cleanQuery, safeLimit);
    const webResults = [];
    const providerErrors = [];
    if (web) {
      for (const provider of this.providers) {
        try {
          const response = await provider.search({ query: cleanQuery, limit: safeLimit, language });
          const items = Array.isArray(response) ? response : response?.results;
          if (!Array.isArray(items)) continue;
          for (const item of items.slice(0, safeLimit)) {
            const url = normalizeUrl(item?.url || item?.uri);
            const title = normalizeText(item?.title, 500);
            if (!url || !title) continue;
            webResults.push({
              title, url, snippet: normalizeText(item?.snippet || item?.description || item?.text, 2000),
              source: normalizeText(provider.name || "web_provider", 80),
              score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
              retrievedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          providerErrors.push({
            provider: normalizeText(provider.name || "web_provider", 80),
            code: normalizeText(error?.code || "SEARCH_PROVIDER_FAILED", 100)
          });
        }
      }
    }
    const unique = new Map();
    for (const item of [...webResults, ...localResults]) {
      const key = item.url || `local:${item.title.toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    const results = [...unique.values()].slice(0, safeLimit);
    return {
      query: cleanQuery, results, total: results.length,
      sources: [...new Set(results.map(item => item.source))],
      webSearchPerformed: webResults.length > 0, localIndexSearched: true,
      providers: this.listProviders(), providerErrors,
      notice: webResults.length ? null :
        "No live web results were returned. Results, if any, come only from the IRHCF local index."
    };
  }
}
module.exports = { IRHCFSearchEngine, tokenize, normalizeUrl };
