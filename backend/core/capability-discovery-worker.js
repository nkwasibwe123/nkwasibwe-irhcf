"use strict";

const crypto = require("node:crypto");

function clean(value, max = 2000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function normalizeDiscovery(item = {}) {
  const title = clean(item.title, 180);
  const description = clean(item.description, 1600);
  const source = clean(item.source, 1000);
  const capability = clean(item.capability, 120);
  if (!title || !description || !source || !capability) return null;
  const fingerprint = crypto.createHash("sha256")
    .update([capability, title, source].join("\n").toLowerCase())
    .digest("hex");
  const risks = Array.isArray(item.risks)
    ? item.risks.slice(0, 12).map(value => clean(value, 300)).filter(Boolean)
    : [];
  return {
    fingerprint, title, description, source, capability, risks,
    status: "PROPOSED",
    requiresSandbox: true,
    requiresSecurityReview: true,
    requiresRegressionTests: true,
    requiresHumanPromotion: true,
    discoveredAt: new Date().toISOString()
  };
}

/**
 * Periodic, autonomous capability-discovery coordinator.
 *
 * The discovery provider is injected so deployments can use approved search
 * and model adapters. Results are proposals only: this worker never edits
 * production code, installs packages, spends provider credits, or deploys.
 * Repository adapters must implement listKnownCapabilities() and
 * saveProposal(proposal), ideally with a unique constraint on fingerprint.
 */
class CapabilityDiscoveryWorker {
  constructor({
    repository,
    discover,
    pollIntervalMs = 6 * 60 * 60 * 1000,
    batchSize = 20,
    logger = console
  } = {}) {
    if (!repository || typeof repository.listKnownCapabilities !== "function" ||
        typeof repository.saveProposal !== "function") {
      throw new Error("CapabilityDiscoveryWorker requires listKnownCapabilities() and saveProposal().");
    }
    if (typeof discover !== "function") {
      throw new Error("CapabilityDiscoveryWorker requires an authorized discovery adapter.");
    }
    this.repository = repository;
    this.discover = discover;
    this.pollIntervalMs = Math.max(60000, Number(pollIntervalMs) || 21600000);
    this.batchSize = Math.max(1, Math.min(50, Math.trunc(Number(batchSize) || 20)));
    this.logger = logger;
    this.running = false;
    this.active = false;
    this.timer = null;
    this.lastRunAt = null;
    this.lastResult = null;
    this.lastError = null;
  }

  async tick() {
    if (this.active) return { skipped: true, reason: "discovery_already_running" };
    this.active = true;
    try {
      const known = await this.repository.listKnownCapabilities();
      const knownCapabilities = Array.isArray(known) ? known.slice(0, 2000) : [];
      const discoveries = await this.discover({
        knownCapabilities,
        objective: "Find useful, feasible, safe capability improvements for Nkwasibwe IRHCF.",
        constraints: [
          "Prefer free, open-source, local-first options.",
          "Do not assume paid provider access or spend money.",
          "Return evidence-backed capability ideas, not claims of implemented work.",
          "Do not propose bypassing access controls, licenses, rate limits, or safety controls.",
          "Identify dependencies, security risks, cost, and a testable acceptance criterion.",
          "Do not repeat capabilities already present unless a specific gap is evidenced."
        ],
        maxItems: this.batchSize
      });
      const candidates = Array.isArray(discoveries) ? discoveries.slice(0, this.batchSize) : [];
      const seen = new Set();
      let saved = 0, rejected = 0;
      for (const item of candidates) {
        const proposal = normalizeDiscovery(item);
        if (!proposal || seen.has(proposal.fingerprint)) { rejected++; continue; }
        seen.add(proposal.fingerprint);
        const duplicate = knownCapabilities.some(capability =>
          clean(typeof capability === "string" ? capability : capability?.name || capability?.id, 180).toLowerCase() === proposal.capability.toLowerCase()
        );
        if (duplicate) { rejected++; continue; }
        const result = await this.repository.saveProposal(proposal);
        if (result !== false) saved++;
      }
      this.lastRunAt = new Date().toISOString();
      this.lastResult = { knownCapabilities: knownCapabilities.length, candidates: candidates.length, proposalsSaved: saved, rejected };
      this.lastError = null;
      return this.lastResult;
    } catch (error) {
      this.lastRunAt = new Date().toISOString();
      this.lastError = clean(error?.message || error, 500);
      this.logger.error?.("[CAPABILITY_DISCOVERY] Scan failed:", this.lastError);
      throw error;
    } finally {
      this.active = false;
    }
  }

  start({ runImmediately = true } = {}) {
    if (this.running) return this;
    this.running = true;
    this.timer = setInterval(() => this.tick().catch(() => {}), this.pollIntervalMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
    if (runImmediately) this.tick().catch(() => {});
    this.logger.info?.("[CAPABILITY_DISCOVERY] Autonomous discovery scheduler started.");
    return this;
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getRuntimeState() {
    return {
      running: this.running, active: this.active,
      pollIntervalMs: this.pollIntervalMs, lastRunAt: this.lastRunAt,
      lastResult: this.lastResult, lastError: this.lastError,
      mode: "proposal_only", productionMutation: false, autoDeployment: false
    };
  }
}

module.exports = { CapabilityDiscoveryWorker, normalizeDiscovery };
