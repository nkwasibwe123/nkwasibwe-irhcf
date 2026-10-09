"use strict";

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const SANDBOX_PREFIX = "irhcf-sandbox-";
const MAX_FILES = 100;
const MAX_FILE_BYTES = 500000;

function validateFiles(files, entry = null) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Sandbox requires at least one file.");
  }

  if (files.length > MAX_FILES) {
    throw new Error("Sandbox file limit exceeded.");
  }

  const names = new Set();

  for (const file of files) {
    const name = String(file?.name || "");

    if (
      !name ||
      name.includes("/") ||
      name.includes("\\") ||
      !SAFE_NAME.test(name) ||
      name === "." ||
      name === ".."
    ) {
      throw new Error("Unsafe sandbox file name.");
    }

    if (name.startsWith(".") && name !== ".gitignore") {
      throw new Error("Hidden sandbox files are not allowed.");
    }

    if (names.has(name)) {
      throw new Error("Duplicate sandbox file name.");
    }
    names.add(name);

    if (Buffer.byteLength(String(file?.content || ""), "utf8") > MAX_FILE_BYTES) {
      throw new Error("Sandbox file is too large.");
    }
  }

  if (entry !== null && entry !== undefined && entry !== "") {
    const entryName = String(entry);
    if (!SAFE_NAME.test(entryName) || !names.has(entryName)) {
      throw new Error("Sandbox entry must name one of the supplied files.");
    }
  }
}

async function buildSandbox({ files, entry = null } = {}) {
  validateFiles(files, entry);

  const id = crypto.randomBytes(12).toString("hex");
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), `${SANDBOX_PREFIX}${id}-`)
  );

  try {
    for (const file of files) {
      await fs.writeFile(
        path.join(root, file.name),
        String(file.content || ""),
        { encoding: "utf8", flag: "wx" }
      );
    }

    const javascriptFiles = files.filter((file) => /\.m?js$/.test(file.name));

    for (const file of javascriptFiles) {
      await execFileAsync(
        process.execPath,
        ["--check", path.join(root, file.name)],
        { timeout: 15000, windowsHide: true }
      );
    }

    return {
      id,
      root,
      entry: entry || javascriptFiles[0]?.name || null,
      validatedFiles: files.map((file) => file.name),
      syntaxChecked: javascriptFiles.map((file) => file.name),
      promotion: "NOT_APPROVED"
    };
  } catch (error) {
    try {
      await cleanupSandbox(root);
    } catch {
      // Preserve the original validation error.
    }

    error.code = "SANDBOX_VALIDATION_FAILED";
    throw error;
  }
}

async function cleanupSandbox(root) {
  if (!root || typeof root !== "string") return false;

  const resolvedRoot = path.resolve(root);
  const resolvedTemp = path.resolve(os.tmpdir());
  const parent = path.dirname(resolvedRoot);
  const base = path.basename(resolvedRoot);

  if (
    parent !== resolvedTemp ||
    !base.startsWith(SANDBOX_PREFIX) ||
    base.length <= SANDBOX_PREFIX.length
  ) {
    return false;
  }

  await fs.rm(resolvedRoot, { recursive: true, force: true });
  return true;
}

module.exports = {
  validateFiles,
  buildSandbox,
  cleanupSandbox
};
