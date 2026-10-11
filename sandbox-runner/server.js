"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Math.max(1, Math.min(65535, Number(process.env.PORT) || 8080));
const TOKEN = process.env.IRHCF_SANDBOX_RUNNER_TOKEN || "";
const IMAGE = process.env.IRHCF_SANDBOX_IMAGE || "irhcf-sandbox:latest";
const MAX_BODY = 52 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 500000;
const MAX_TIMEOUT_MS = 120000;
const ALLOWED = new Set(["node --test", "npm test", "npm run build", "python -m pytest", "python -m unittest"]);

function send(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
  res.end(body);
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function validate(payload) {
  if (!payload || payload.protocolVersion !== 1 || !ALLOWED.has(payload.command)) throw Object.assign(new Error("Invalid protocol or command"), { status: 400 });
  if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > MAX_FILES) throw Object.assign(new Error("Invalid file count"), { status: 400 });
  const seen = new Set();
  for (const file of payload.files) {
    const name = String(file?.name || "");
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === ".." || name.startsWith("." ) || seen.has(name)) throw Object.assign(new Error("Unsafe or duplicate filename"), { status: 400 });
    if (Buffer.byteLength(String(file.content ?? ""), "utf8") > MAX_FILE_BYTES) throw Object.assign(new Error("File too large"), { status: 413 });
    seen.add(name);
  }
  const timeoutMs = Math.max(1000, Math.min(MAX_TIMEOUT_MS, Number(payload.timeoutMs) || 30000));
  return { files: payload.files, command: payload.command, timeoutMs };
}
async function runDocker(payload) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "irhcf-run-"));
  const runnerId = crypto.randomUUID();
  let timer; let timedOut = false; let stdout = ""; let stderr = "";
  try {
    for (const file of payload.files) {
      await fs.writeFile(path.join(dir, file.name), String(file.content ?? ""), { encoding: "utf8", mode: 0o444, flag: "wx" });
    }
    await fs.chmod(dir, 0o555);
    const args = [
      "run", "--rm", "--label", "irhcf.runner=true", "--label", "irhcf.run=" + runnerId,
      "--network=none", "--memory=256m", "--memory-swap=256m", "--cpus=1",
      "--pids-limit=64", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
      "--user=65532:65532", "--init", "--tmpfs=/tmp:rw,noexec,nosuid,size=16m",
      "--mount", "type=bind,src=" + dir + ",dst=/workspace,readonly",
      "--workdir=/workspace", IMAGE, "sh", "-lc", payload.command
    ];
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH || "/usr/bin:/bin" } });
    child.stdout.on("data", chunk => { if (stdout.length < 20000) stdout += chunk.toString("utf8").slice(0, 20000 - stdout.length); });
    child.stderr.on("data", chunk => { if (stderr.length < 20000) stderr += chunk.toString("utf8").slice(0, 20000 - stderr.length); });
    const started = Date.now();
    const outcome = await new Promise(resolve => {
      let done = false;
      const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        // Kill the labeled container as well; terminating the docker CLI alone
        // does not guarantee the daemon stopped the workload.
        const cleanup = spawn("docker", ["ps", "-q", "--filter", "label=irhcf.run=" + runnerId], { stdio: ["ignore", "pipe", "ignore"] });
        let ids = ""; cleanup.stdout.on("data", c => ids += c.toString("utf8"));
        cleanup.on("close", () => { for (const id of ids.trim().split(/\s+/).filter(Boolean)) spawn("docker", ["kill", id], { stdio: "ignore" }); });
        finish({ exitCode: 124 });
      }, payload.timeoutMs);
      child.on("error", error => { stderr += String(error.message).slice(0, 1000); finish({ exitCode: 127 }); });
      child.on("close", code => finish({ exitCode: Number.isInteger(code) ? code : 1 }));
    });
    return { protocolVersion: 1, passed: outcome.exitCode === 0 && !timedOut, exitCode: outcome.exitCode, stdout, stderr, durationMs: Date.now() - started, timedOut, isolation: "hardened_container", runnerId };
  } finally {
    await fs.chmod(dir, 0o755).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  }
}
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, runner: "irhcf-sandbox-runner" });
  if (req.method !== "POST" || req.url !== "/v1/execute") return send(res, 404, { error: "not_found" });
  if (!TOKEN) return send(res, 503, { error: "runner_token_not_configured" });
  if (!safeEqual((req.headers.authorization || "").replace(/^Bearer\s+/i, ""), TOKEN)) return send(res, 401, { error: "unauthorized" });
  try {
    const payload = validate(await readBody(req));
    const result = await runDocker(payload);
    return send(res, 200, result);
  } catch (error) {
    return send(res, error.status || 500, { protocolVersion: 1, passed: false, exitCode: null, stdout: "", stderr: String(error.message || error).slice(0, 2000), durationMs: 0, timedOut: false, isolation: "unverified", runnerId: null });
  }
});
if (!TOKEN && process.env.NODE_ENV === "production") console.error("FATAL: IRHCF_SANDBOX_RUNNER_TOKEN is required in production.");
server.listen(PORT, "0.0.0.0", () => console.log("IRHCF sandbox runner listening on " + PORT));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
