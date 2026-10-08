"use strict";

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function validateFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("Sandbox requires at least one file.");
  if (files.length > 100) throw new Error("Sandbox file limit exceeded.");
  for (const file of files) {
    const name = String(file?.name || "");
    if (!name || name.includes("/") || name.includes("\\") || !SAFE_NAME.test(name)) throw new Error("Unsafe sandbox file name.");
    if (name.startsWith(".") && name !== ".gitignore") throw new Error("Hidden sandbox files are not allowed.");
    if (Buffer.byteLength(String(file?.content || ""), "utf8") > 500000) throw new Error("Sandbox file is too large.");
  }
}

async function buildSandbox({ files, entry = null } = {}) {
  validateFiles(files);
  const id = crypto.randomBytes(12).toString("hex");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `irhcf-sandbox-${id}-`));
  try {
    for (const file of files) await fs.writeFile(path.join(root, file.name), String(file.content || ""), "utf8");
    const javascriptFiles = files.filter(f => /\.m?js$/.test(f.name));
    for (const file of javascriptFiles) await execFileAsync(process.execPath, ["--check", path.join(root, file.name)], { timeout: 15000 });
    return { id, root, entry: entry || javascriptFiles[0]?.name || null, validatedFiles: files.map(f => f.name), syntaxChecked: javascriptFiles.map(f => f.name), promotion: "NOT_APPROVED" };
  } catch (error) {
    error.code = error.code || "SANDBOX_VALIDATION_FAILED";
    throw error;
  }
}

async function cleanupSandbox(root) {
  if (!root || !String(root).startsWith(path.join(os.tmpdir(), "irhcf-sandbox-"))) return false;
  await fs.rm(root, { recursive: true, force: true });
  return true;
}

module.exports = { validateFiles, buildSandbox, cleanupSandbox };