"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("frontend source has no standalone async tokens before section comments", () => {
  const appPath = path.join(__dirname, "..", "..", "..", "app.js");
  const source = fs.readFileSync(appPath, "utf8");
  const lines = source.split(/\r?\n/);
  const malformed = [];

  lines.forEach((line, index) => {
    if (/^\s*async\s*(?:\/\/|$)/.test(line)) {
      malformed.push({ line: index + 1, text: line.trim() });
    }
  });

  assert.deepEqual(
    malformed,
    [],
    "Remove standalone async tokens; they execute as identifiers and can throw ReferenceError."
  );
});
