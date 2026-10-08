"use strict";

/**
 * Deep research coordinator.
 *
 * It creates a research plan that can be executed by the configured
 * web-search/browser/source adapters. It does not pretend that one
 * provider can reach "everywhere"; source coverage is determined by the
 * adapters actually configured at runtime.
 */

const RESEARCH_STAGES = Object.freeze([
  "scope",
  "discover",
  "collect",
  "cross_check",
  "evaluate_sources",
  "synthesize",
  "verify",
  "deliver"
]);

const SOURCE_CLASSES = Object.freeze([
  "official",
  "primary",
  "academic",
  "government",
  "reputable_news",
  "industry",
  "community",
  "search_result"
]);

function normalizeText(value, max = 5000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];

  return sources
    .map((source) => ({
      title: normalizeText(source?.title, 300),
      url: normalizeText(source?.url, 1000),
      publisher: normalizeText(source?.publisher, 200),
      type: SOURCE_CLASSES.includes(source?.type)
        ? source.type
        : "search_result",
      publishedAt: source?.publishedAt || null,
      retrievedAt: source?.retrievedAt || new Date().toISOString()
    }))
    .filter((source) => source.title || source.url);
}

function buildResearchPlan({
  question,
  freshness = "current",
  breadth = "broad",
  domains = [],
  languages = []
} = {}) {
  const cleanQuestion = normalizeText(question);

  if (!cleanQuestion) {
    throw new Error("A research question is required.");
  }

  const normalizedBreadth = ["focused", "broad", "deep"].includes(breadth)
    ? breadth
    : "broad";

  const targetSourceCount =
    normalizedBreadth === "focused" ? 4 :
    normalizedBreadth === "deep" ? 12 : 8;

  return {
    question: cleanQuestion,
    freshness: normalizeText(freshness, 50) || "current",
    breadth: normalizedBreadth,
    domains: Array.from(new Set(domains.map((v) => normalizeText(v, 100)).filter(Boolean))),
    languages: Array.from(new Set(languages.map((v) => normalizeText(v, 50)).filter(Boolean))),
    targetSourceCount,
    stages: RESEARCH_STAGES.map((stage, index) => ({
      step: index + 1,
      stage,
      status: "planned"
    })),
    verification: {
      requireSourceAttribution: true,
      requireCrossCheck: normalizedBreadth !== "focused",
      separateFactFromInference: true,
      checkDatesForCurrentClaims: freshness !== "historical",
      doNotClaimUnverifiedCoverage: true
    }
  };
}

function evaluateResearchSources(sources = []) {
  const normalized = normalizeSources(sources);

  const counts = normalized.reduce((acc, source) => {
    acc[source.type] = (acc[source.type] || 0) + 1;
    return acc;
  }, {});

  const uniqueUrls = new Set(
    normalized.map((source) => source.url).filter(Boolean)
  ).size;

  const primaryCount =
    (counts.official || 0) +
    (counts.primary || 0) +
    (counts.government || 0) +
    (counts.academic || 0);

  return {
    sourceCount: normalized.length,
    uniqueUrlCount: uniqueUrls,
    primarySourceCount: primaryCount,
    sourceClassCounts: counts,
    diversityScore: normalized.length
      ? Math.min(1, Object.keys(counts).length / 5)
      : 0,
    qualitySignal:
      normalized.length >= 8 && primaryCount >= 3
        ? "strong"
        : normalized.length >= 4 && primaryCount >= 1
          ? "moderate"
          : "weak"
  };
}

module.exports = {
  RESEARCH_STAGES,
  SOURCE_CLASSES,
  buildResearchPlan,
  evaluateResearchSources,
  normalizeSources
};
