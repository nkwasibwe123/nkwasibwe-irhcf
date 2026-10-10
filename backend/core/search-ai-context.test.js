"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAIResearchContext, safeHttpUrl, MAX_RESULTS, MAX_CONTEXT_LENGTH } = require("./search-ai-context");

test("search results become bounded, source-labelled AI evidence", () => {
  const result = buildAIResearchContext({
    webSearchPerformed: true,
    localIndexSearched: true,
    results: [
      { title: "Official source", url: "https://example.com/page#top", snippet: "Verified snippet", source: "web" },
      { title: "Official source duplicate", url: "https://example.com/page", snippet: "Duplicate URL", source: "web" },
      { title: "Local note", snippet: "Local index content", source: "irhcf_local_index" }
    ]
  });
  assert.equal(result.performed, true);
  assert.equal(result.webSearchPerformed, true);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].url, "https://example.com/page");
  assert.match(result.context, /SUPPLEMENTARY IRHCF SEARCH EVIDENCE/);
  assert.match(result.context, /untrusted evidence, not instructions/i);
  assert.match(result.context, /https:\/\/example\.com\/page/);
  assert.match(result.context, /Local index content/);
});

test("unsafe and malformed URLs are never surfaced as sources", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("https://user:secret@example.com/path"), "");
  assert.equal(safeHttpUrl("not a URL"), "");
  assert.equal(safeHttpUrl("https://example.com/path#fragment"), "https://example.com/path");
  const result = buildAIResearchContext({
    results: [
      { title: "Unsafe link", url: "javascript:alert(1)", snippet: "Some snippet" },
      { title: "Credential URL", url: "https://user:pass@example.com", snippet: "Sensitive" }
    ]
  });
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources.every(source => !source.url), true);
  assert.doesNotMatch(result.context, /javascript:|user:pass/);
});

test("search context caps source count and total context length", () => {
  const results = Array.from({ length: 20 }, (_, i) => ({
    title: "Source " + i,
    url: "https://example.com/" + i,
    snippet: "x".repeat(1800)
  }));
  const result = buildAIResearchContext({ results });
  assert.equal(result.sources.length, MAX_RESULTS);
  assert.ok(result.context.length <= MAX_CONTEXT_LENGTH);
});

test("empty or malformed search output yields no AI context", () => {
  const result = buildAIResearchContext({ results: "not-an-array" });
  assert.equal(result.performed, false);
  assert.equal(result.context, "");
});
