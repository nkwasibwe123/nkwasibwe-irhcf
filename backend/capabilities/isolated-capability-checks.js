"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { runIsolatedCommand } = require("./sandbox-runner");

/**
 * Adapter for Capability Factory's runTests callback. Source is read from the
 * temporary candidate workspace, then sent to the dedicated runner. The
 * local workspace is NOT considered an execution security boundary.
 */
function createIsolatedTestAdapter({ runner = runIsolatedCommand, command = "node --test", timeoutMs = 60000 } = {}) {
  if (typeof runner !== "function") throw new TypeError("runner must be a function");
  return async function runCandidateTests({ root, files, entry = null } = {}) {
    if (!root || !Array.isArray(files) || files.length === 0) {
      return { passed: false, reason: "Candidate workspace and files are required." };
    }
    const payload = [];
    for (const rawName of files) {
      const name = String(rawName || "");
      if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === ".." || name.startsWith(".")) {
        return { passed: false, reason: "Unsafe candidate file name rejected." };
      }
      const fullPath = path.join(root, name);
      if (path.dirname(fullPath) !== path.resolve(root)) {
        return { passed: false, reason: "Candidate path escaped its workspace." };
      }
      payload.push({ name, content: await fs.readFile(fullPath, "utf8") });
    }
    try {
      const result = await runner({ files: payload, command, entry, timeoutMs });
      return {
        passed: result?.passed === true && result?.timedOut !== true && result?.exitCode === 0,
        runner: result,
        reason: result?.passed === true ? null : "Remote isolated tests did not pass."
      };
    } catch (error) {
      return { passed: false, reason: String(error?.message || error).slice(0, 1000), code: error?.code || "ISOLATED_TEST_FAILED" };
    }
  };
}

module.exports = { createIsolatedTestAdapter };
