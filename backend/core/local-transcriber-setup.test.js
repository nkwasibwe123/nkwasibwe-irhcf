"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("local transcriber setup reuses a healthy cached binary and model", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "irhcf-whisper-cache-test-"));
  const whisperRoot = path.join(temp, "whisper.cpp");
  const modelDir = path.join(temp, "models");
  const fakeBinDir = path.join(temp, "fake-bin");
  const binary = path.join(whisperRoot, "build", "bin", "whisper-cli");
  const model = path.join(modelDir, "ggml-tiny.bin");
  const callLog = path.join(temp, "unexpected-build-tool.log");
  const setupScripts = [
    path.join(__dirname, "..", "..", "scripts", "setup-local-transcriber.sh"),
    path.join(__dirname, "..", "scripts", "setup-local-transcriber.sh")
  ];

  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });
  fs.mkdirSync(fakeBinDir, { recursive: true });
  fs.writeFileSync(path.join(whisperRoot, "CMakeLists.txt"), "cached build marker");
  fs.writeFileSync(model, "cached model");
  fs.writeFileSync(binary, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(binary, 0o755);

  for (const tool of ["git", "cmake", "c++", "curl"]) {
    const fake = path.join(fakeBinDir, tool);
    fs.writeFileSync(fake, "#!/bin/sh\necho called >> \"$CALL_LOG\"\nexit 91\n");
    fs.chmodSync(fake, 0o755);
  }

  try {
    for (const setupScript of setupScripts) {
      const result = spawnSync("bash", [setupScript], {
      cwd: temp,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        WHISPER_CPP_DIR: whisperRoot,
        WHISPER_MODEL_DIR: modelDir,
        WHISPER_MODEL_NAME: "ggml-tiny",
        CALL_LOG: callLog,
        PATH: fakeBinDir + path.delimiter + process.env.PATH
      }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Using cached self-hosted transcription engine/);
    assert.match(result.stdout, /WHISPER_MODEL_PATH=/);
      assert.equal(fs.existsSync(callLog), false, "cache hit must not invoke git/cmake/compiler/curl");
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
