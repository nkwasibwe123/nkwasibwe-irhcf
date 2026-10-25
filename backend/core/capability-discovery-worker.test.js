"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { CapabilityDiscoveryWorker, normalizeDiscovery } = require("./capability-discovery-worker");

test("normalizes evidence-backed capability ideas and marks promotion gates", () => {
  const proposal = normalizeDiscovery({
    title: "Local subtitle generation",
    description: "Generate captions locally and verify timestamp alignment.",
    source: "https://example.org/docs",
    capability: "local-subtitles",
    risks: ["Model size"]
  });
  assert.ok(proposal);
  assert.equal(proposal.status, "PROPOSED");
  assert.equal(proposal.requiresSandbox, true);
  assert.equal(proposal.requiresSecurityReview, true);
  assert.equal(proposal.requiresRegressionTests, true);
  assert.equal(proposal.requiresHumanPromotion, true);
  assert.equal(proposal.risks.length, 1);
});

test("rejects incomplete discoveries", () => {
  assert.equal(normalizeDiscovery({ title: "Missing source" }), null);
});

test("runs autonomous scans, bounds candidates, deduplicates, and saves proposals only", async () => {
  const saved = [];
  let requestedBatchSize = 0;
  const worker = new CapabilityDiscoveryWorker({
    repository: {
      async listKnownCapabilities() { return ["existing-capability"]; },
      async saveProposal(proposal) { saved.push(proposal); return true; }
    },
    async discover(options) {
      requestedBatchSize = options.maxItems;
      return [
        { title: "Idea A", description: "Useful capability A", source: "https://example.org/a", capability: "new-a" },
        { title: "Idea A", description: "Useful capability A", source: "https://example.org/a", capability: "new-a" },
        { title: "Idea B", description: "Useful capability B", source: "https://example.org/b", capability: "existing-capability" },
        { title: "Invalid" }
      ];
    },
    batchSize: 3,
    logger: { info() {}, error() {} }
  });
  const result = await worker.tick();
  assert.equal(requestedBatchSize, 3);
  assert.equal(result.proposalsSaved, 1);
  assert.equal(result.rejected, 2);
  assert.equal(saved.length, 1);
  assert.equal(worker.getRuntimeState().productionMutation, false);
  assert.equal(worker.getRuntimeState().autoDeployment, false);
});

test("prevents overlapping discovery scans", async () => {
  let release;
  const worker = new CapabilityDiscoveryWorker({
    repository: { async listKnownCapabilities() { return []; }, async saveProposal() {} },
    discover: () => new Promise(resolve => { release = () => resolve([]); }),
    logger: { info() {}, error() {} }
  });
  const first = worker.tick();
  await new Promise(resolve => setImmediate(resolve));
  const second = await worker.tick();
  assert.equal(second.skipped, true);
  release();
  await first;
});

test("requires an approved discovery adapter and repository", () => {
  assert.throws(() => new CapabilityDiscoveryWorker(), /requires listKnownCapabilities/);
  assert.throws(() => new CapabilityDiscoveryWorker({
    repository: { async listKnownCapabilities() { return []; }, async saveProposal() {} }
  }), /authorized discovery adapter/);
});
