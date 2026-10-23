"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTaskArtifacts } = require("./task-artifacts");

const websiteTask = "Kora website nto y'ishuri ikora koko. Kora index.html, style.css, script.js na README.md.";

test("verified local website fallback survives total AI adapter failure", () => {
  const result = buildTaskArtifacts({
    task: websiteTask,
    taskId: "task-40",
    result: {
      success: false,
      error: {
        code: "ALL_ADAPTERS_FAILED",
        message: "All configured execution adapters failed."
      }
    }
  });

  assert.equal(result.required, true);
  assert.equal(result.verified, true);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.artifacts.length, 4);
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.name).sort(),
    ["README.md", "index.html", "script.js", "style.css"]
  );
  assert.ok(result.artifacts.every((artifact) => artifact.verified && artifact.content.length > 0));
  assert.match(result.fallbackReason, /AI provider execution failed/i);
});

test("partial website output does not silently become a fallback site", () => {
  const result = buildTaskArtifacts({
    task: websiteTask,
    taskId: "task-partial",
    result: {
      success: true,
      response: 'Here is the file:\n```html filename="index.html"\n<!doctype html><html><body><h1>School</h1></body></html>\n```'
    }
  });

  assert.equal(result.required, true);
  assert.equal(result.verified, false);
  assert.equal(result.fallbackUsed, undefined);
  assert.match(result.error, /Missing required file/);
});


test("trading website fallback matches the requested domain and stays paper-trading only", () => {
  const result = buildTaskArtifacts({
    task: "I want to make for me a website of trading with all requirements",
    taskId: "task-trading-46",
    result: {
      success: false,
      error: { code: "ALL_ADAPTERS_FAILED", message: "AI providers failed before generating files." }
    }
  });
  assert.equal(result.required, true);
  assert.equal(result.verified, true);
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.artifacts.map(item => item.name).sort(), ["README.md", "index.html", "script.js", "style.css"]);
  const html = result.artifacts.find(item => item.name === "index.html").content;
  const js = result.artifacts.find(item => item.name === "script.js").content;
  assert.match(html, /Market[s]?/i);
  assert.match(html, /Paper portfolio/);
  assert.match(html, /DEMO · PAPER TRADING/);
  assert.doesNotMatch(html, /Welcome to our school|Every learner matters/);
  assert.match(js, /paper buy|virtual only/i);
});
