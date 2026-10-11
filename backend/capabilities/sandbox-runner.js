"use strict";

/**
 * Remote isolated execution adapter.
 *
 * This module is deliberately only a client contract: it does not pretend
 * that a temporary directory or Node syntax check is a security boundary.
 * A separately deployed runner MUST enforce OS/container/microVM isolation,
 * no host mounts/secrets, network policy, CPU/memory/PID limits and hard
 * deadlines. If no runner is configured, execution fails closed.
 */

const { validateFiles } = require("./sandbox");

const MAX_TIMEOUT_MS = 120000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ALLOWED_COMMANDS = Object.freeze([
  "node --test",
  "npm test",
  "npm run build",
  "python -m pytest",
  "python -m unittest"
]);

function cleanText(value, max = 2000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function getRunnerConfig(env = process.env) {
  const endpoint = cleanText(env.IRHCF_SANDBOX_RUNNER_URL, 1000);
  const token = cleanText(env.IRHCF_SANDBOX_RUNNER_TOKEN, 4000);
  if (!endpoint || !token) {
    return { configured: false, endpoint: null };
  }

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw Object.assign(new Error("Sandbox runner URL is invalid."), {
      code: "SANDBOX_RUNNER_URL_INVALID"
    });
  }

  const localDevelopment = env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localDevelopment) {
    throw Object.assign(new Error("Sandbox runner must use HTTPS outside local development."), {
      code: "SANDBOX_RUNNER_HTTPS_REQUIRED"
    });
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw Object.assign(new Error("Sandbox runner URL must not contain credentials or a fragment."), {
      code: "SANDBOX_RUNNER_URL_INVALID"
    });
  }
  return { configured: true, endpoint: parsed.toString().replace(/\/$/, ""), token };
}

async function runIsolatedCommand({
  files,
  command,
  entry = null,
  timeoutMs = 30000,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  validateFiles(files, entry);
  const normalizedCommand = cleanText(command, 100);
  if (!ALLOWED_COMMANDS.includes(normalizedCommand)) {
    throw Object.assign(new Error("Sandbox command is not in the approved command allowlist."), {
      code: "SANDBOX_COMMAND_NOT_ALLOWED"
    });
  }

  const config = getRunnerConfig(env);
  if (!config.configured) {
    throw Object.assign(new Error("Isolated execution is disabled: configure IRHCF_SANDBOX_RUNNER_URL and IRHCF_SANDBOX_RUNNER_TOKEN."), {
      code: "SANDBOX_RUNNER_NOT_CONFIGURED"
    });
  }
  if (typeof fetchImpl !== "function") {
    throw Object.assign(new Error("Fetch is unavailable for the sandbox runner."), {
      code: "SANDBOX_RUNNER_FETCH_UNAVAILABLE"
    });
  }

  const boundedTimeout = Math.max(1000, Math.min(MAX_TIMEOUT_MS, Number(timeoutMs) || 30000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout);
  if (typeof timer.unref === "function") timer.unref();

  try {
    const response = await fetchImpl(config.endpoint + "/v1/execute", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + config.token,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        protocolVersion: 1,
        command: normalizedCommand,
        entry: entry || null,
        timeoutMs: boundedTimeout,
        limits: {
          maxFiles: 100,
          maxFileBytes: 500000,
          maxResponseBytes: MAX_RESPONSE_BYTES
        },
        files: files.map(file => ({
          name: file.name,
          content: String(file.content || "")
        }))
      }),
      signal: controller.signal,
      redirect: "error"
    });

    if (!response || !response.ok) {
      throw Object.assign(new Error("Isolated runner returned HTTP " + (response?.status || "unknown") + "."), {
        code: "SANDBOX_RUNNER_HTTP_ERROR",
        status: response?.status || null
      });
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
      throw Object.assign(new Error("Isolated runner response exceeded the size limit."), {
        code: "SANDBOX_RUNNER_RESPONSE_TOO_LARGE"
      });
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      throw Object.assign(new Error("Isolated runner returned invalid JSON."), {
        code: "SANDBOX_RUNNER_INVALID_RESPONSE"
      });
    }

    if (result?.protocolVersion !== 1 || typeof result?.passed !== "boolean") {
      throw Object.assign(new Error("Isolated runner response did not match protocol version 1."), {
        code: "SANDBOX_RUNNER_INVALID_RESPONSE"
      });
    }

    return {
      passed: result.passed,
      exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
      stdout: cleanText(result.stdout, 20000),
      stderr: cleanText(result.stderr, 20000),
      durationMs: Number.isFinite(Number(result.durationMs)) ? Math.max(0, Number(result.durationMs)) : null,
      timedOut: result.timedOut === true,
      isolation: result.isolation === "microvm" || result.isolation === "hardened_container"
        ? result.isolation
        : "unverified",
      runnerId: cleanText(result.runnerId, 200) || null,
      verification: {
        runnerReportedPass: result.passed,
        isolationVerifiedByClient: false
      }
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Isolated execution exceeded its deadline."), {
        code: "SANDBOX_RUNNER_TIMEOUT"
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  MAX_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  ALLOWED_COMMANDS,
  getRunnerConfig,
  runIsolatedCommand
};
