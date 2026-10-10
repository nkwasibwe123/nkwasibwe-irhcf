"use strict";

/**
 * Search adapters for IRHCF.
 * Preferred no-paid-API option: point SEARXNG_BASE_URL at an instance you
 * operate yourself. It still needs a host with internet access and resources.
 * Optional Brave adapter is only enabled when a server-side key is configured.
 */
function createWebSearchProviders({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const providers = [];
  if (typeof fetchImpl !== "function") return providers;

  const searxBase = String(env.SEARXNG_BASE_URL || "").trim();
  if (searxBase) {
    let base;
    try {
      base = new URL(searxBase);
      if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid protocol");
    } catch {
      throw new Error("SEARXNG_BASE_URL must be a valid HTTP(S) URL.");
    }
    providers.push({
      name: "Self-hosted SearXNG",
      async search({ query, limit = 10, language = "auto" }) {
        const safeQuery = String(query || "").trim().slice(0, 600);
        if (!safeQuery) return { results: [] };
        const url = new URL("/search", base);
        url.searchParams.set("q", safeQuery);
        url.searchParams.set("format", "json");
        url.searchParams.set("safesearch", "1");
        if (language && language !== "auto") url.searchParams.set("language", String(language).slice(0, 10));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetchImpl(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
            signal: controller.signal
          });
          if (!response.ok) {
            const error = new Error("Self-hosted search request failed.");
            error.code = response.status === 429 ? "SEARCH_RATE_LIMITED" : "SEARCH_UPSTREAM_ERROR";
            throw error;
          }
          const data = await response.json();
          const results = Array.isArray(data?.results) ? data.results : [];
          return {
            results: results.slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)))
              .map(item => ({
                title: String(item.title || item.url || "Untitled result"),
                url: item.url,
                snippet: String(item.content || item.description || ""),
                source: "Self-hosted SearXNG"
              }))
              .filter(item => typeof item.url === "string" && /^https?:\/\//i.test(item.url))
          };
        } finally {
          clearTimeout(timer);
        }
      }
    });
  }

  const braveKey = String(env.BRAVE_SEARCH_API_KEY || "").trim();
  if (braveKey) {
    const mode = String(env.BRAVE_SEARCH_MODE || "llm-context").trim().toLowerCase();
    const useContext = mode !== "web";
    providers.push({
      name: useContext ? "Brave LLM Context" : "Brave Web Search",
      async search({ query, limit = 10, language = "auto", country = "US" }) {
        const safeQuery = String(query || "").trim().slice(0, 600);
        if (!safeQuery) return { results: [] };
        const endpoint = useContext
          ? "https://api.search.brave.com/res/v1/llm/context"
          : "https://api.search.brave.com/res/v1/web/search";
        const url = new URL(endpoint);
        url.searchParams.set("q", safeQuery);
        if (!useContext) url.searchParams.set("count", String(Math.max(1, Math.min(Number(limit) || 10, 20))));
        const safeCountry = String(country || "US").toUpperCase();
        if (/^[A-Z]{2}$/.test(safeCountry)) url.searchParams.set("country", safeCountry);
        if (language && language !== "auto" && /^[a-z]{2}(?:-[A-Z]{2})?$/i.test(language)) {
          url.searchParams.set("search_lang", language.toLowerCase().slice(0, 5));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetchImpl(url, {
            method: "GET",
            headers: { "Accept": "application/json", "X-Subscription-Token": braveKey },
            signal: controller.signal
          });
          if (!response.ok) {
            const error = new Error("Brave Search request failed.");
            error.code = response.status === 429 ? "SEARCH_RATE_LIMITED" : "SEARCH_UPSTREAM_ERROR";
            throw error;
          }
          const data = await response.json();
          if (useContext) {
            const items = Array.isArray(data?.grounding?.generic) ? data.grounding.generic : [];
            return { results: items.map(item => ({
              title: item.title || data?.sources?.[item.url]?.title || item.url || "Untitled source",
              url: item.url,
              snippet: Array.isArray(item.snippets) ? item.snippets.join("\n") : String(item.snippet || ""),
              source: "Brave LLM Context"
            })).filter(item => typeof item.url === "string" && /^https?:\/\//i.test(item.url))
              .slice(0, Math.max(1, Math.min(Number(limit) || 10, 50))) };
          }
          const items = Array.isArray(data?.web?.results) ? data.web.results : [];
          return { results: items.map(item => ({
            title: item.title || item.url || "Untitled result",
            url: item.url,
            snippet: item.description || "",
            source: "Brave Web Search"
          })).filter(item => typeof item.url === "string" && /^https?:\/\//i.test(item.url)) };
        } finally {
          clearTimeout(timer);
        }
      }
    });
  }
  return providers;
}

module.exports = { createWebSearchProviders };
