"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSearchContext, MAX_CONTEXT_LENGTH, MAX_SOURCES } = require("./search-context");

test("builds structured sources and source-labelled context", () => {
  const output = buildSearchContext({
    query: " climate research ",
    webSearchPerformed: true,
    localIndexSearched: true,
    results: [
      { title: "Report", url: "https://example.org/report", source: "web", snippet: "Verified evidence" }
    ]
  });
  assert.equal(output.query, "climate research");
  assert.equal(output.sources.length, 1);
  assert.equal(output.sources[0].url, "https://example.org/report");
  assert.match(output.context, /\[Source 1\] Report/);
  assert.match(output.context, /Evidence: Verified evidence/);
  assert.equal(output.webSearchPerformed, true);
  assert.match(output.warning, /untrusted evidence/i);
});

test("does not allow non-http URLs and normalizes missing data", () => {
  const output = buildSearchContext({ results: [{ title: "", url: "javascript:alert(1)", snippet: "  a  b " }] });
  assert.equal(output.sources[0].title, "Untitled source");
  assert.equal(output.sources[0].url, null);
  assert.equal(output.sources[0].snippet, "a b");
  assert.equal(output.webSearchPerformed, false);
});

test("caps sources, snippets, and total context size", () => {
  const results = Array.from({ length: MAX_SOURCES + 5 }, (_, i) => ({
    title: "Title " + i,
    url: "https://example.org/" + i,
    snippet: "x".repeat(3000)
  }));
  const output = buildSearchContext({ results });
  assert.equal(output.sources.length, MAX_SOURCES);
  assert.ok(output.context.length <= MAX_CONTEXT_LENGTH);
});
