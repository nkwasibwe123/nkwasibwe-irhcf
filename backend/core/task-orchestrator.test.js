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

test("video, image, and audio tasks receive distinct specialist routes", () => {
  const { analyzeTask } = require("./task-orchestrator");
  const video = analyzeTask("Create a short video with music");
  const image = analyzeTask("Create a logo image");
  const audio = analyzeTask("Generate a music song");
  assert.equal(video.classification.type, "video");
  assert.ok(video.routing.agents.some(agent => agent.role === "video"));
  assert.ok(video.agentTeam.teamTypes.includes("video"));
  assert.equal(image.classification.type, "image");
  assert.ok(image.routing.agents.some(agent => agent.role === "image"));
  assert.ok(image.capabilities.includes("image_generation"));
  assert.equal(audio.classification.type, "audio");
  assert.ok(audio.routing.agents.some(agent => agent.role === "audio"));
  assert.ok(audio.capabilities.includes("music_generation"));
});

test("file and link requests get dedicated specialist teams", () => {
  const { analyzeTask } = require("./task-orchestrator");
  const files = analyzeTask("Analyze this PDF document file");
  const links = analyzeTask("Find links to official documentation");
  assert.equal(files.classification.type, "file_operations");
  assert.ok(files.agentTeam.teamTypes.includes("files"));
  assert.ok(files.routing.agents.some(agent => agent.role === "files"));
  assert.equal(links.classification.type, "link_research");
  assert.ok(links.agentTeam.teamTypes.includes("links"));
  assert.ok(links.routing.agents.some(agent => agent.role === "links"));
});

test("Kinyarwanda website creation requests route to the software build team", () => {
  const { analyzeTask } = require("./task-orchestrator");
  const result = analyzeTask("Nkorera website yuzuye ya GS Kitazigurwa ubundi uyimpe.");
  assert.equal(result.classification.type, "software_build");
  assert.ok(result.agentTeam.teamTypes.includes("software"));
  assert.ok(result.routing.agents.some(agent => agent.role === "coding"));
  assert.ok(result.capabilities.includes("code_generation"));
});

test("a general question about a website remains normal conversation", () => {
  assert.equal(classifyTask("What is a website?").type, "general");
});
