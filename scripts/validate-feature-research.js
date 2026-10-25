"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MIN_DISTINCT_SITES = 6;
const CANONICAL_RECORDS = [
  ["Account & settings", "research/ACCOUNT_SETTINGS_OPERATIONS_RESEARCH.md"],
  ["Agent orchestration", "research/AGENT_ORCHESTRATION_RESEARCH.md"],
  ["Chat assistant", "research/CHAT_ASSISTANT_RESEARCH.md"],
  ["Download manager", "research/DOWNLOAD_MANAGER_RESEARCH.md"],
  ["Files & knowledge workspace", "research/FILES_KNOWLEDGE_WORKSPACE.md"],
  ["Nkwasibwe Market", "research/MARKETPLACE_FEATURE_RESEARCH.md"],
  ["Media Studio", "research/MEDIA_STUDIO_RESEARCH.md"],
  ["Research & search workspace", "research/RESEARCH_SEARCH_WORKSPACE.md"],
  ["Chat with Friends / social integrations", "research/SOCIAL_FEATURE_RESEARCH.md"]
];

function siteKey(rawUrl) {
  let hostname;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  // Project docs hosted on GitHub Pages are distinct from github.com itself.
  if (hostname.endsWith(".github.io")) return hostname;

  const labels = hostname.split(".");
  const multiLabelPublicSuffixes = new Set([
    "co.uk", "org.uk", "gov.uk", "com.au", "net.au", "org.au",
    "co.nz", "com.br", "com.mx", "co.za", "com.sg", "com.tr"
  ]);
  if (labels.length >= 3 && multiLabelPublicSuffixes.has(labels.slice(-2).join("."))) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

function extractUrls(content) {
  return [...content.matchAll(/https?:\/\/[^\s)>\]]+/g)]
    .map(match => match[0].replace(/[.,;]+$/, ""));
}

function distinctSites(content) {
  return [...new Set(extractUrls(content).map(siteKey).filter(Boolean))].sort();
}

function extractArchitectureSection(content, headingText) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith("## ") && line.includes(headingText));
  if (start < 0) throw new Error("Missing architecture section: " + headingText);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

function validateSources(label, content) {
  const sites = distinctSites(content);
  if (sites.length < MIN_DISTINCT_SITES) {
    throw new Error(label + " has " + sites.length + " distinct sites; requires at least " +
      MIN_DISTINCT_SITES + ". Found: " + (sites.join(", ") || "(none)"));
  }
  console.log("OK " + label + ": " + sites.length + " distinct sites");
}

function main() {
  const root = path.resolve(__dirname, "..");
  for (const [label, relativePath] of CANONICAL_RECORDS) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error("Missing research record: " + relativePath);
    validateSources(label, fs.readFileSync(absolutePath, "utf8"));
  }

  const architecturePath = path.join(root, "FEATURE_ARCHITECTURE.md");
  const architecture = fs.readFileSync(architecturePath, "utf8");
  validateSources("Dashboard & product architecture", extractArchitectureSection(
    architecture, "Research baseline for dashboard and product architecture"));
  validateSources("Software & Website Factory", extractArchitectureSection(
    architecture, "Feature research record — Software & Website Factory"));

  for (const linkedPath of [
    "research/MARKETPLACE_FEATURE_RESEARCH.md",
    "research/SOCIAL_FEATURE_RESEARCH.md",
    "research/FEATURE_DEEP_DIVE_TEMPLATE.md"
  ]) {
    if (!architecture.includes(linkedPath)) {
      throw new Error("FEATURE_ARCHITECTURE.md must link " + linkedPath);
    }
  }

  console.log("Feature research gate passed: every canonical record has at least " +
    MIN_DISTINCT_SITES + " distinct sites.");
}

try {
  main();
} catch (error) {
  console.error("Feature research gate failed:", error.message);
  process.exitCode = 1;
}
