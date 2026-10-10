"use strict";

/**
 * Optional live-web adapters for IRHCF Search.
 * Configure BRAVE_SEARCH_API_KEY in the server environment to enable live results.
 * The key stays server-side and is never returned by the API.
 */
function createWebSearchProviders({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const providers = [];
  const braveKey = String(env.BRAVE_SEARCH_API_KEY || "").trim();
  if (braveKey && typeof fetchImpl === "function") {
    providers.push({
      name: "Brave Web Search",
      async search({ query, limit = 10, language = "auto" }) {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", String(query).slice(0, 1000));
        url.searchParams.set("count", String(Math.max(1, Math.min(Number(limit) || 10, 20))));
        if (language && language !== "auto" && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)) {
          url.searchParams.set("search_lang", language.toLowerCase().slice(0, 5));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetchImpl(url, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "X-Subscription-Token": braveKey
            },
            signal: controller.signal
          });
          if (!response.ok) {
            const error = new Error("Brave Search request failed.");
            error.code = response.status === 429 ? "SEARCH_RATE_LIMITED" : "SEARCH_UPSTREAM_ERROR";
            throw error;
          }
          const data = await response.json();
          const items = Array.isArray(data?.web?.results) ? data.web.results : [];
          return {
            results: items.map(item => ({
              title: item.title,
              url: item.url,
              snippet: item.description || ""
            }))
          };
        } finally {
          clearTimeout(timer);
        }
      }
    });
  }
  return providers;
}

module.exports = { createWebSearchProviders };
