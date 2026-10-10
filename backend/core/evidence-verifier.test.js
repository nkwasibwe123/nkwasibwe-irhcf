"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeHttpUrl, verifyEvidence } = require("./evidence-verifier");

test("accepts citations only when their URLs belong to supplied evidence", () => {
  const result = verifyEvidence("According to the report https://example.com/report, the result is X.", {
    researchRequired: true,
    researchPerformed: true,
    sources: [{ title: "Report", url: "https://example.com/report#section" }]
  });
  assert.equal(result.valid, true);
  assert.equal(result.status, "sources_available_not_fact_proof");
  assert.equal(result.sourceCount, 1);
  assert.deepEqual(result.unsupportedCitations, []);
  assert.match(result.disclaimer, /does not prove/);
});

test("flags a URL citation that was not returned by research", () => {
  const result = verifyEvidence("See https://fake.example/claim for proof.", {
    researchRequired: true,
    researchPerformed: true,
    sources: [{ title: "Trusted source", url: "https://trusted.example/" }]
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["UNSUPPORTED_CITATION"]);
  assert.deepEqual(result.unsupportedCitations, ["https://fake.example/claim"]);
});

test("explicitly reports missing evidence when research was required", () => {
  const result = verifyEvidence("The latest figure is 42.", {
    researchRequired: true,
    researchPerformed: false,
    sources: []
  });
  assert.equal(result.valid, false);
  assert.equal(result.status, "insufficient_evidence");
  assert.deepEqual(result.issues, ["RESEARCH_EVIDENCE_UNAVAILABLE"]);
});

test("does not treat a source list as proof that claims are true", () => {
  const result = verifyEvidence("A claim is stated here.", {
    sources: [{ title: "Source", url: "https://source.example/page" }]
  });
  assert.equal(result.valid, true);
  assert.match(result.disclaimer, /does not prove/);
});

test("rejects unsafe URLs and normalizes fragments", () => {
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), "");
  assert.equal(normalizeHttpUrl("https://user:pass@example.com/"), "");
  assert.equal(normalizeHttpUrl("https://example.com/a#part"), "https://example.com/a");
});

test("caps source processing and handles empty/non-string answers", () => {
  const sources = Array.from({ length: 30 }, (_, i) => ({
    title: "Source " + i,
    url: "https://example.com/" + i
  }));
  const result = verifyEvidence(null, { sources });
  assert.equal(result.valid, false);
  assert.equal(result.sourceCount, 20);
  assert.deepEqual(result.issues, ["EMPTY_RESPONSE"]);
});
