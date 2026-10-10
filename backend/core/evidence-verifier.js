"use strict";

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function verifyEvidence(answer, options = {}) {
  const text = typeof answer === "string" ? answer.trim() : "";
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const required = options.researchRequired === true;
  const performed = options.researchPerformed === true;
  const normalizedSources = [];
  const sourceUrls = new Set();

  for (const source of sources.slice(0, 20)) {
    const url = normalizeHttpUrl(source?.url);
    if (!url || sourceUrls.has(url)) continue;
    sourceUrls.add(url);
    normalizedSources.push({
      title: String(source?.title || new URL(url).hostname).replace(/\s+/g, " ").trim().slice(0, 300),
      url
    });
  }

  const citedUrls = [];
  const urlPattern = /https?:\/\/[^\s<>\])}"]+/gi;
  for (const match of text.matchAll(urlPattern)) {
    const url = normalizeHttpUrl(match[0].replace(/[.,;:!?]+$/, ""));
    if (url && !citedUrls.includes(url)) citedUrls.push(url);
  }

  const unsupportedCitations = citedUrls.filter(url => !sourceUrls.has(url));
  const issues = [];
  if (!text) issues.push("EMPTY_RESPONSE");
  if (required && (!performed || normalizedSources.length === 0)) {
    issues.push("RESEARCH_EVIDENCE_UNAVAILABLE");
  }
  if (unsupportedCitations.length) issues.push("UNSUPPORTED_CITATION");

  let status = "not_required";
  if (required && (!performed || normalizedSources.length === 0)) status = "insufficient_evidence";
  else if (unsupportedCitations.length) status = "unsupported_citations";
  else if (required && normalizedSources.length) status = "sources_available_not_fact_proof";
  else if (normalizedSources.length) status = "sources_available_not_fact_proof";

  return {
    valid: issues.length === 0,
    status,
    issues,
    sourceCount: normalizedSources.length,
    sources: normalizedSources,
    citedUrls,
    unsupportedCitations,
    disclaimer: normalizedSources.length
      ? "Sources were checked for URL provenance only; their presence does not prove that every claim in the answer is true."
      : "No source evidence was supplied; factual claims have not been independently verified."
  };
}

module.exports = { normalizeHttpUrl, verifyEvidence };
