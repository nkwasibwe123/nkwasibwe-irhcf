"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyTask } = require("./task-orchestrator");

test("greetings stay general chat", () => {
  assert.equal(classifyTask("Hi").type, "general");
  assert.equal(classifyTask("Hey").type, "general");
  assert.equal(classifyTask("Umezute se").type, "general");
});

test("a question about websites is not misclassified as a build project", () => {
  assert.equal(classifyTask("What is a website?").type, "general");
});

test("an explicit website creation request is classified as a software build", () => {
  assert.equal(
    classifyTask("Create a website for my shop with an admin dashboard").type,
    "software_build"
  );
});

test("a website error is classified as engineering rather than a new project", () => {
  assert.equal(
    classifyTask("Please debug this website error").type,
    "software_engineering"
  );
});
