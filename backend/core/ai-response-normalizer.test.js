"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { extractAIResponse } = require("./ai-response-normalizer");

test("extracts OpenAI-compatible chat completion content", () => {
  assert.equal(extractAIResponse({ choices: [{ message: { content: "Hello!" } }] }), "Hello!");
});

test("extracts provider output_text", () => {
  assert.equal(extractAIResponse({ output_text: "  A result  " }), "A result");
});

test("extracts text from content-part arrays", () => {
  assert.equal(
    extractAIResponse({ choices: [{ message: { content: [{ type: "text", text: "One" }, { type: "text", text: "Two" }] } }] }),
    "One\nTwo"
  );
});

test("unwraps JSON-encoded assistant messages", () => {
  assert.equal(extractAIResponse({ response: '{"role":"assistant","content":"Hello from JSON"}' }), "Hello from JSON");
});

test("returns null for missing or empty responses", () => {
  assert.equal(extractAIResponse(null), null);
  assert.equal(extractAIResponse({ choices: [] }), null);
  assert.equal(extractAIResponse({ response: "  " }), null);
});

test("does not stringify an unknown object as [object Object]", () => {
  assert.equal(extractAIResponse({ response: { metadata: true } }), null);
});
