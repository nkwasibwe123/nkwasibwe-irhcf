"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createWebSearchProviders } = require("./web-search-providers");

test("Brave provider is absent without server-side API key", () => {
  assert.deepEqual(createWebSearchProviders({ env: {}, fetchImpl: async () => {} }), []);
});

test("Brave provider normalizes a successful response into search results", async () => {
  let requestedUrl;
  let requestOptions;
  const providers = createWebSearchProviders({
    env: { BRAVE_SEARCH_API_KEY: "test-secret" },
    fetchImpl: async (url, options) => {
      requestedUrl = new URL(url);
      requestOptions = options;
      return {
        ok: true,
        json: async () => ({ web: { results: [
          { title: "IRHCF example", url: "https://example.com", description: "A test result" }
        ] } })
      };
    }
  });
  assert.equal(providers.length, 1);
  const result = await providers[0].search({ query: "IRHCF", limit: 5, language: "en" });
  assert.equal(result.results[0].title, "IRHCF example");
  assert.equal(result.results[0].url, "https://example.com");
  assert.equal(requestedUrl.searchParams.get("q"), "IRHCF");
  assert.equal(requestedUrl.searchParams.get("count"), "5");
  assert.equal(requestedUrl.searchParams.get("search_lang"), "en");
  assert.equal(requestOptions.headers["X-Subscription-Token"], "test-secret");
  assert.equal(requestOptions.signal instanceof AbortSignal, true);
});

test("Brave provider reports upstream errors without exposing credentials", async () => {
  const [provider] = createWebSearchProviders({
    env: { BRAVE_SEARCH_API_KEY: "secret" },
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  await assert.rejects(provider.search({ query: "test" }), error => error.code === "SEARCH_RATE_LIMITED");
});
