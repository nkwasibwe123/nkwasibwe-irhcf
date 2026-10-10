"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildClaimVerificationPrompt,
  validateClaimAssessments,
  buildCorrectionInstruction
} = require("./claim-verification-engine");

const sources = [
  { title: "Official report", url: "https://example.org/report", snippet: "The report says the project started in 2024." },
  { title: "News report", url: "https://news.example.org/item", snippet: "The project started in 2025, according to the article." }
];

test("prompt asks for atomic claims and distinguishes contradiction from missing evidence", () => {
  const prompt = buildClaimVerificationPrompt("It started in 2024.", sources, "rw");
  assert.equal(prompt.language, "rw");
  assert.match(prompt.instruction, /atomic/);
  assert.match(prompt.instruction, /absence of evidence is not contradiction/);
  assert.match(prompt.instruction, /Assess EACH source separately/);
  assert.match(prompt.instruction, /sourceAssessments/);
  assert.equal(prompt.sources.length, 2);
});

test("validates supported claims only when they reference a supplied source", () => {
  const result = validateClaimAssessments({
    claims: [
      { claim: "The project started in 2024.", status: "supported", sourceIds: [1], reason: "Direct match." },
      { claim: "It started in 2023.", status: "supported", sourceIds: [], reason: "No source." }
    ]
  }, sources);
  assert.equal(result.claims[0].status, "supported");
  assert.equal(result.claims[0].sourceAssessments[0].title, "Official report");
  assert.equal(result.claims[0].sourceAssessments[0].url, "https://example.org/report");
  assert.equal(result.claims[1].status, "insufficient_evidence");
  assert.ok(result.issues.includes("SUPPORTED_WITHOUT_VALID_SOURCE"));
});

test("distinguishes contradictory claims from claims with insufficient evidence", () => {
  const result = validateClaimAssessments({
    claims: [
      { claim: "Start year is 2024.", status: "contradicted", sourceAssessments: [{ sourceId: 2, relationship: "contradicts", reason: "Excerpt says 2025." }], reason: "Excerpt says 2025." },
      { claim: "Budget is 2 million.", status: "insufficient_evidence", sourceIds: [], reason: "No excerpt addresses budget." }
    ]
  }, sources);
  assert.equal(result.overall, "contradicted_claims_found");
  assert.equal(result.counts.contradicted, 1);
  assert.equal(result.claims[0].sourceAssessments[0].relationship, "contradicts");
  assert.equal(result.counts.insufficient_evidence, 1);
});

test("rejects source IDs not present in supplied evidence and downgrades unsupported judgments", () => {
  const result = validateClaimAssessments({
    claims: [{ claim: "Claim X", status: "contradicted", sourceIds: [99], reason: "Invalid source ID." }]
  }, sources);
  assert.equal(result.claims[0].status, "insufficient_evidence");
  assert.ok(result.issues.includes("INVALID_SOURCE_REFERENCE"));
});

test("correction instructions require transparent uncertainty and no invented citations", () => {
  const result = validateClaimAssessments({ claims: [
    { claim: "Unknown fact", status: "insufficient_evidence", sourceIds: [], reason: "No evidence." }
  ] }, sources);
  const prompt = buildCorrectionInstruction(result, "rw");
  assert.match(prompt, /Kinyarwanda/);
  assert.match(prompt, /instead of guessing/);
  assert.match(prompt, /which source supports each key claim/);
  assert.match(prompt, /Where sources disagree/);
  assert.match(prompt, /validated source IDs/);
});

test("caps claims, normalizes duplicates, and never returns unvalidated status values", () => {
  const claims = Array.from({ length: 60 }, (_, i) => ({
    claim: i < 2 ? "Same claim" : "Claim " + i,
    status: i === 3 ? "definitely_true" : "supported",
    sourceIds: [1]
  }));
  const result = validateClaimAssessments({ claims }, sources);
  assert.ok(result.claims.length <= 50);
  assert.equal(result.claims.filter(item => item.claim === "Same claim").length, 1);
  assert.equal(result.claims.find(item => item.claim === "Claim 3").status, "insufficient_evidence");
});
