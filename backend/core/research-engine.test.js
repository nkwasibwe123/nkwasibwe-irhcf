"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RESEARCH_STAGES,
  buildResearchPlan,
  evaluateResearchSources,
  normalizeSources
} = require("./research-engine");

test("deep research plan defines staged work and explicit verification rules", () => {
  const plan = buildResearchPlan({
    question: "Compare renewable energy options",
    breadth: "deep",
    domains: ["energy.example", "energy.example"],
    languages: ["en", "rw"]
  });

  assert.equal(plan.targetSourceCount, 12);
  assert.deepEqual(plan.stages.map((stage) => stage.stage), [...RESEARCH_STAGES]);
  assert.equal(plan.verification.requireSourceAttribution, true);
  assert.equal(plan.verification.requireCrossCheck, true);
  assert.equal(plan.verification.separateFactFromInference, true);
  assert.deepEqual(plan.domains, ["energy.example"]);
});

test("research plan rejects an empty question and bounds unknown breadth", () => {
  assert.throws(() => buildResearchPlan({ question: "   " }), /question is required/i);
  assert.equal(buildResearchPlan({ question: "A question", breadth: "unbounded" }).breadth, "broad");
});

test("source normalization accepts only HTTP(S), strips fragments and credentials, and deduplicates", () => {
  const sources = normalizeSources([
    { title: "Official", url: "https://user:secret@example.org/report#part", type: "official" },
    { title: "Duplicate", url: "https://example.org/report", type: "primary" },
    { title: "Unsafe", url: "javascript:alert(1)", type: "official" },
    { title: "No URL", url: "", type: "academic" },
    { title: "Bad URL", url: "not a url", type: "academic" }
  ]);

  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, "https://example.org/report");
  assert.equal(sources[0].type, "official");
  assert.equal(sources[0].url.includes("secret"), false);
});

test("source evaluation counts unique, normalized sources and describes evidence strength", () => {
  const sources = [
    { title: "Government data", url: "https://data.example/a", type: "government" },
    { title: "University study", url: "https://uni.example/b", type: "academic" },
    { title: "Official report", url: "https://official.example/c", type: "official" },
    { title: "News analysis", url: "https://news.example/d", type: "reputable_news" },
    { title: "Industry report", url: "https://industry.example/e", type: "industry" },
    { title: "Duplicate", url: "https://data.example/a#copy", type: "government" }
  ];
  const evaluation = evaluateResearchSources(sources);

  assert.equal(evaluation.sourceCount, 5);
  assert.equal(evaluation.uniqueUrlCount, 5);
  assert.equal(evaluation.primarySourceCount, 3);
  assert.equal(evaluation.qualitySignal, "moderate");
  assert.ok(evaluation.diversityScore > 0);
});
