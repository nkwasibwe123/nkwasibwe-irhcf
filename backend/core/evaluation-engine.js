"use strict";

/**
 * IRHCF Evaluation Engine
 *
 * Runs deterministic/injected benchmarks without mutating production
 * capabilities. Promotion is a separate, explicit safety decision.
 */

const DEFAULT_DOMAINS = Object.freeze([
  "reasoning","coding","research","kinyarwanda","english",
  "audio","music","video","web_development","long_tasks",
  "tool_use","reliability","latency","cost","safety",
  "self_repair","verification"
]);

function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function buildBenchmarkSuite({ domains = DEFAULT_DOMAINS, cases = [] } = {}) {
  return {
    id: "benchmark_" + Date.now(),
    domains: [...new Set(domains.map(String))],
    cases: Array.isArray(cases) ? cases.slice(0, 500) : [],
    createdAt: new Date().toISOString()
  };
}

async function runBenchmark({
  suite,
  evaluator,
  candidate = "current"
} = {}) {
  if (!suite) throw new Error("Benchmark suite is required.");
  if (typeof evaluator !== "function") {
    throw new Error("Benchmark evaluator is required.");
  }

  const results = [];
  for (const testCase of suite.cases) {
    const started = Date.now();
    try {
      const output = await evaluator({
        testCase,
        candidate,
        domains: suite.domains
      });
      results.push({
        id: testCase?.id || null,
        domain: testCase?.domain || "general",
        passed: Boolean(output?.passed),
        score: normalizeScore(output?.score),
        latencyMs: Date.now() - started,
        cost: Number(output?.cost) || 0,
        safety: output?.safety !== false,
        reason: String(output?.reason || "").slice(0, 1000)
      });
    } catch (error) {
      results.push({
        id: testCase?.id || null,
        domain: testCase?.domain || "general",
        passed: false,
        score: 0,
        latencyMs: Date.now() - started,
        cost: 0,
        safety: false,
        reason: String(error?.message || error).slice(0, 1000)
      });
    }
  }

  const count = results.length || 1;
  const score = results.reduce((sum, item) => sum + item.score, 0) / count;
  const passed = results.filter(item => item.passed).length;
  const safe = results.every(item => item.safety);

  return {
    candidate,
    suiteId: suite.id,
    score: Math.round(score * 100) / 100,
    passRate: Math.round((passed / count) * 10000) / 100,
    safe,
    results,
    completedAt: new Date().toISOString()
  };
}

function compareBenchmark(baseline, candidate) {
  if (!baseline || !candidate) throw new Error("Both benchmark results are required.");
  return {
    scoreDelta: normalizeScore(candidate.score) - normalizeScore(baseline.score),
    passRateDelta: normalizeScore(candidate.passRate) - normalizeScore(baseline.passRate),
    safer: candidate.safe === true && baseline.safe !== false,
    candidateImproved:
      candidate.safe === true &&
      normalizeScore(candidate.score) >= normalizeScore(baseline.score) &&
      normalizeScore(candidate.passRate) >= normalizeScore(baseline.passRate)
  };
}

module.exports = {
  DEFAULT_DOMAINS,
  buildBenchmarkSuite,
  runBenchmark,
  compareBenchmark
};
