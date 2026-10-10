"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { IRHCFSearchEngine, normalizeUrl, tokenize } = require("./search-engine");

test("local index ranks matching documents", async () => {
  const engine = new IRHCFSearchEngine();
  engine.indexDocument({ id: "a", title: "Rwanda renewable energy", text: "Solar energy projects in Rwanda." });
  engine.indexDocument({ id: "b", title: "Coffee farming", text: "Agriculture and export markets." });
  const result = await engine.search("Rwanda energy", { web: false });
  assert.equal(result.total, 1);
  assert.equal(result.results[0].title, "Rwanda renewable energy");
  assert.equal(result.webSearchPerformed, false);
});

test("web results are validated and provider failures reported", async () => {
  const engine = new IRHCFSearchEngine({ providers: [
    { name: "web-one", search: async () => ({ results: [
      { title: "Example", url: "https://example.com/path#section", snippet: "A result" },
      { title: "Unsafe", url: "javascript:alert(1)" }
    ] }) },
    { name: "offline", search: async () => { const e = new Error("down"); e.code = "OFFLINE"; throw e; } }
  ] });
  const result = await engine.search("example");
  assert.equal(result.webSearchPerformed, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].url, "https://example.com/path");
  assert.equal(result.providerErrors[0].code, "OFFLINE");
});

test("empty query and invalid document fail safely", async () => {
  const engine = new IRHCFSearchEngine();
  await assert.rejects(engine.search("   "), /query is required/);
  assert.throws(() => engine.indexDocument({ id: "x", title: "Only title" }), /required/);
  assert.equal(normalizeUrl("file:///etc/passwd"), null);
  assert.equal(normalizeUrl("https://user:secret@example.com/private"), null);
  assert.equal(normalizeUrl("https://example.com/path#section"), "https://example.com/path");
  assert.deepEqual(tokenize("Énergie à Kigali"), ["energie", "a", "kigali"]);
});
