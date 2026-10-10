"use strict";

const vm = require("node:vm");

const FILE_REQUEST = /\b(create|write|generate|build|make|produce|save|export)\b.{0,100}\b(file|script|code|document|report|page|website|app|application|component|module|spreadsheet|csv|json|html|css|javascript|typescript)\b|\b(file|script|code|document|report|website|app|application|component|module)\b.{0,80}\b(for me|please|that works|with|named|called)\b/i;
const EXTENSION = /\b([\w.-]+\.(?:js|cjs|mjs|ts|tsx|jsx|html|css|json|md|txt|csv|xml|svg))\b/i;
const EXT_TO_MIME = Object.freeze({
  js: "text/javascript", cjs: "text/javascript", mjs: "text/javascript",
  ts: "text/plain", tsx: "text/plain", jsx: "text/javascript",
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json", md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8",
  xml: "application/xml", svg: "image/svg+xml"
});

function requestedArtifact(task) {
  const text = String(task || "").trim();
  if (!FILE_REQUEST.test(text)) return null;
  const match = text.match(EXTENSION);
  const defaultName = /\b(website|html|web page)\b/i.test(text) ? "index.html"
    : /\b(csv|spreadsheet)\b/i.test(text) ? "output.csv"
    : /\bjson\b/i.test(text) ? "output.json"
    : /\b(code|script|javascript|typescript|app|application|component|module)\b/i.test(text) ? "index.js"
    : "task-deliverable.md";
  let name = match?.[1] || defaultName;
  name = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  if (name === "." || name === ".." || name.includes("..")) name = "task-deliverable.md";
  const ext = name.split(".").pop().toLowerCase();
  return { name, extension: ext, mimeType: EXT_TO_MIME[ext] || "text/plain; charset=utf-8" };
}

function getResponseText(result) {
  const candidates = [
    result?.response,
    result?.answer,
    result?.output,
    result?.content,
    result?.result?.output_text
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value.content === "string" && value.content.trim()) return value.content.trim();
  }
  return "";
}

function extractDeliverable(text, extension) {
  const source = String(text || "").trim();
  const codeLike = new Set(["js", "cjs", "mjs", "ts", "tsx", "jsx", "html", "css", "json", "csv", "xml", "svg"]);
  if (codeLike.has(extension)) {
    const fence = source.match(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```/);
    if (fence) return fence[1].trim() + "\n";
    // Do not turn prose into a pretend source file.
    if (/^(here(?:'s| is)|below is|this code|the following|sure[,!])/i.test(source)) return "";
    return source + "\n";
  }
  return source + "\n";
}

function buildTaskArtifact({ task, result, taskId } = {}) {
  const request = requestedArtifact(task);
  if (!request) return { required: false, artifacts: [] };
  if (!result || result.success === false) {
    return { required: true, artifacts: [], error: "Agent execution failed; no artifact was created." };
  }
  const responseText = getResponseText(result);
  const content = extractDeliverable(responseText, request.extension);
  if (!content.trim()) {
    return {
      required: true,
      artifacts: [],
      error: "The agent did not return file content; no artifact was created."
    };
  }

  let syntaxVerified = false;
  let verification = "non-empty content";
  if (["js", "cjs", "mjs"].includes(request.extension)) {
    try {
      new vm.Script(content, { filename: request.name });
      syntaxVerified = true;
      verification = "JavaScript syntax passed";
    } catch (error) {
      return {
        required: true,
        artifacts: [],
        error: "Generated JavaScript did not pass syntax verification: " + String(error.message || error).slice(0, 500)
      };
    }
  } else {
    syntaxVerified = true;
  }

  const artifact = {
    name: request.name,
    mimeType: request.mimeType,
    content,
    bytes: Buffer.byteLength(content, "utf8"),
    verified: syntaxVerified,
    verification,
    downloadUrl: "/api/tasks/" + encodeURIComponent(String(taskId)) + "/artifacts/" + encodeURIComponent(request.name)
  };
  return { required: true, artifacts: [artifact], verification };
}

module.exports = {
  requestedArtifact,
  getResponseText,
  extractDeliverable,
  buildTaskArtifact
};
