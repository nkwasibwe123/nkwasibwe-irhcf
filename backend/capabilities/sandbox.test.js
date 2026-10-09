"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  validateFiles,
  buildSandbox,
  cleanupSandbox
} = require("./sandbox");

test("sandbox accepts a valid JavaScript file and cleans it up", async () => {
  const sandbox = await buildSandbox({
    files: [{ name: "index.js", content: '"use strict";\nmodule.exports = 1;\n' }],
    entry: "index.js"
  });

  try {
    assert.equal(sandbox.entry, "index.js");
    assert.deepEqual(sandbox.syntaxChecked, ["index.js"]);
    assert.equal(sandbox.promotion, "NOT_APPROVED");
    await fs.access(path.join(sandbox.root, "index.js"));
  } finally {
    assert.equal(await cleanupSandbox(sandbox.root), true);
  }

  await assert.rejects(fs.access(sandbox.root));
});

test("sandbox rejects traversal, hidden files, duplicates and invalid entries", () => {
  assert.throws(
    () => validateFiles([{ name: "../escape.js", content: "" }]),
    /Unsafe sandbox file name/
  );
  assert.throws(
    () => validateFiles([{ name: ".env", content: "secret" }]),
    /Hidden sandbox files/
  );
  assert.throws(
    () => validateFiles([
      { name: "same.js", content: "" },
      { name: "same.js", content: "" }
    ]),
    /Duplicate sandbox file name/
  );
  assert.throws(
    () => validateFiles([{ name: "index.js", content: "" }], "../outside.js"),
    /entry must name one of the supplied files/
  );
  assert.throws(
    () => validateFiles([{ name: "index.js", content: "" }], "missing.js"),
    /entry must name one of the supplied files/
  );
});

test("sandbox enforces file count and per-file size limits", () => {
  assert.throws(
    () => validateFiles(Array.from({ length: 101 }, (_, i) => ({
      name: `file-${i}.txt`,
      content: ""
    }))),
    /file limit exceeded/
  );
  assert.throws(
    () => validateFiles([{ name: "large.txt", content: "x".repeat(500001) }]),
    /file is too large/
  );
});

test("syntax failure removes the temporary sandbox before rejecting", async () => {
  const before = new Set(
    (await fs.readdir(os.tmpdir())).filter((name) => name.startsWith("irhcf-sandbox-"))
  );
  let caught;
  try {
    await buildSandbox({
      files: [{ name: "broken.js", content: "function { this is not valid javascript" }]
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, "invalid JavaScript should fail validation");
  assert.equal(caught.code, "SANDBOX_VALIDATION_FAILED");
  assert.match(caught.message, /SyntaxError|Unexpected token|Function statements require a function name/i);

  const after = (await fs.readdir(os.tmpdir()))
    .filter((name) => name.startsWith("irhcf-sandbox-"));
  assert.deepEqual(
    after.filter((name) => !before.has(name)),
    [],
    "failed validation should not leave a new sandbox directory behind"
  );
});

test("cleanup refuses paths outside its dedicated temp-directory namespace", async () => {
  const unrelated = await fs.mkdtemp(path.join(os.tmpdir(), "unrelated-irhcf-test-"));
  try {
    assert.equal(await cleanupSandbox(unrelated), false);
    await fs.access(unrelated);
  } finally {
    await fs.rm(unrelated, { recursive: true, force: true });
  }
});
