"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createWebSearchProviders } = require("./web-search-providers");

test("Brave provider is absent without server-side API key", () => {
  assert.deepEqual(createWebSearchProviders({ env: {}, fetchImpl: async () => {} }), []);
});

test("default Brave LLM Context mode normalizes grounding snippets for AI", async () => {
  let requestedUrl;
  let requestOptions;
  const providers = createWebSearchProviders({
    env: { BRAVE_SEARCH_API_KEY: "test-secret" },
    fetchImpl: async (url, options) => {
      requestedUrl = new URL(url);
      requestOptions = options;
      return {
        ok: true,
        json: async () => ({
          grounding: { generic: [
            { title: "IRHCF example", url: "https://example.com", snippets: ["First snippet", "Second snippet"] }
          ] },
          sources: { "https://example.com": { title: "IRHCF example", hostname: "example.com" } }
        })
      };
    }
  });
  assert.equal(providers.length, 1);
  assert.equal(providers[0].name, "Brave LLM Context");
  const result = await providers[0].search({ query: "IRHCF", limit: 5, language: "en" });
  assert.equal(result.results[0].title, "IRHCF example");
  assert.equal(result.results[0].url, "https://example.com");
  assert.equal(result.results[0].snippet, "First snippet\nSecond snippet");
  assert.equal(requestedUrl.pathname, "/res/v1/llm/context");
  assert.equal(requestedUrl.searchParams.get("q"), "IRHCF");
  assert.equal(requestedUrl.searchParams.get("search_lang"), "en");
  assert.equal(requestOptions.headers["X-Subscription-Token"], "test-secret");
  assert.equal(requestOptions.signal instanceof AbortSignal, true);
});

test("BRAVE_SEARCH_MODE=web uses ranked web search results", async () => {
  let requestedUrl;
  const [provider] = createWebSearchProviders({
    env: { BRAVE_SEARCH_API_KEY: "test-secret", BRAVE_SEARCH_MODE: "web" },
    fetchImpl: async url => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({ web: { results: [
          { title: "Web result", url: "https://example.com", description: "A test result" }
        ] } })
      };
    }
  });
  const result = await provider.search({ query: "IRHCF", limit: 5 });
  assert.equal(provider.name, "Brave Web Search");
  assert.equal(requestedUrl.pathname, "/res/v1/web/search");
  assert.equal(requestedUrl.searchParams.get("count"), "5");
  assert.equal(result.results[0].snippet, "A test result");
});

test("Brave provider reports upstream errors without exposing credentials", async () => {
  const [provider] = createWebSearchProviders({
    env: { BRAVE_SEARCH_API_KEY: "secret" },
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  await assert.rejects(provider.search({ query: "test" }), error => error.code === "SEARCH_RATE_LIMITED");
});
