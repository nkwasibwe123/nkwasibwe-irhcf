"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCandidateFiles, parseJson, createCapabilityLifecycleAdapters } = require("./lifecycle-ai-adapters");

test("candidate files are bounded and reject unsafe paths", () => {
  assert.throws(() => validateCandidateFiles([{ name: "../escape.js", content: "" }]));
  assert.throws(() => validateCandidateFiles([{ name: "index.js", content: "x".repeat(250001) }]));
  assert.deepEqual(validateCandidateFiles([{ name: "index.test.js", content: "test('ok',()=>{});" }]).map(file => file.name), ["index.test.js"]);
});

test("JSON adapter parses JSON and rejects prose", () => {
  assert.deepEqual(parseJson({ output_text: '{"ok":true}' }, "test"), { ok: true });
  assert.throws(() => parseJson({ output_text: "not-json" }, "test"), /valid JSON/);
});

test("real provider callbacks are mandatory", () => {
  assert.throws(() => createCapabilityLifecycleAdapters({}), /search provider callback/);
  assert.throws(() => createCapabilityLifecycleAdapters({ search: async () => ({ results: [] }) }), /AI text provider callback/);
});
