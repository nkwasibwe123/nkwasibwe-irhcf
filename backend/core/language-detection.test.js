"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { detectAgentLanguage } = require("./language-detection");

test("detects Kinyarwanda tasks", () => {
  assert.equal(detectAgentLanguage("Muraho, ndashaka ko umfasha"), "rw");
  assert.equal(detectAgentLanguage("Mbwira uko iki kibazo cyakemuka"), "rw");
});

test("detects French tasks", () => {
  assert.equal(detectAgentLanguage("Bonjour, pouvez-vous m'aider ?"), "fr");
  assert.equal(detectAgentLanguage("Expliquez-moi ce problème s'il vous plaît"), "fr");
});

test("detects English tasks", () => {
  assert.equal(detectAgentLanguage("Hello, can you help me build a website?"), "en");
});

test("defaults safely for empty, short, and unsupported text", () => {
  assert.equal(detectAgentLanguage(""), "en");
  assert.equal(detectAgentLanguage(null), "en");
  assert.equal(detectAgentLanguage("12345"), "en");
});

test("accepts non-string input without throwing", () => {
  assert.equal(detectAgentLanguage({ task: "Muraho" }), "en");
});
