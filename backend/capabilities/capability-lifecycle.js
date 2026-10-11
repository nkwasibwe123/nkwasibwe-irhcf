"use strict";

/**
 * Capability lifecycle coordinator.
 *
 * Orchestrates adapters; it does not itself browse the web, generate code,
 * run untrusted code, deploy, or approve production changes. Those actions
 * must be supplied by explicitly configured adapters and durable storage.
 * Every transition is persisted. Promotion/deployment are fail-closed.
 */

const STAGES = Object.freeze([
  "research",
  "design",
  "implement",
  "test",
  "security_review",
  "regression",
  "repair",
  "release_candidate",
  "deploy",
  "verify_deployment"
]);

const TERMINAL = new Set(["completed", "blocked", "failed"]);
const MAX_REPAIRS = 3;
const MAX_TEXT = 4000;

function clean(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function requireAdapter(adapters, name) {
  if (typeof adapters?.[name] !== "function") {
    throw Object.assign(new Error("Required lifecycle adapter is not configured: " + name), {
      code: "CAPABILITY_ADAPTER_MISSING",
      adapter: name
    });
  }
  return adapters[name];
}

function validateRequest(request) {
  const capability = clean(request?.capability, 80).toLowerCase();
  const goal = clean(request?.goal, 2000);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(capability)) {
    throw Object.assign(new Error("Capability must be a safe 2-64 character identifier."), {
      code: "CAPABILITY_NAME_INVALID"
    });
  }
  if (!goal) {
    throw Object.assign(new Error("A clear capability goal is required."), {
      code: "CAPABILITY_GOAL_REQUIRED"
    });
  }
  return {
    capability,
    goal,
    reason: clean(request?.reason, 2000),
    constraints: Array.isArray(request?.constraints)
      ? request.constraints.slice(0, 30).map(v => clean(v, 500)).filter(Boolean)
      : [],
    explicitDeploymentAuthorization: request?.explicitDeploymentAuthorization === true,
    ownerUserId: Number.isSafeInteger(Number(request?.ownerUserId)) && Number(request?.ownerUserId) > 0 ? Number(request.ownerUserId) : null,
    metadata: request?.metadata && typeof request.metadata === "object" ? request.metadata : {}
  };
}

async function runCapabilityLifecycle({
  request,
  adapters = {},
  store,
  maxRepairs = MAX_REPAIRS,
  clock = () => new Date().toISOString(),
  onCreated = null
} = {}) {
  const normalized = validateRequest(request);
  if (!store || typeof store.create !== "function" || typeof store.update !== "function") {
    throw new Error("A durable lifecycle store implementing create() and update() is required.");
  }
  const repairLimit = Math.max(0, Math.min(MAX_REPAIRS, Math.trunc(Number(maxRepairs) || 0)));
  const id = require("node:crypto").randomUUID();
  const record = {
    id,
    capability: normalized.capability,
    goal: normalized.goal,
    reason: normalized.reason,
    ownerUserId: normalized.ownerUserId,
    status: "running",
    stage: "research",
    createdAt: clock(),
    updatedAt: clock(),
    repairAttempts: 0,
    stages: [],
    evidence: [],
    artifacts: [],
    blockers: [],
    deployment: { attempted: false, verified: false }
  };

  const persist = async patch => {
    Object.assign(record, patch, { updatedAt: clock() });
    await store.update(id, structuredClone(record));
  };
  const stage = async (name, handler, input) => {
    await persist({ stage: name });
    const startedAt = clock();
    const entry = { name, status: "running", startedAt, finishedAt: null };
    record.stages.push(entry);
    await store.update(id, structuredClone(record));
    try {
      const result = await handler({ ...input, lifecycleId: id, capability: normalized.capability, goal: normalized.goal });
      entry.status = result?.passed === false ? "failed" : "completed";
      entry.finishedAt = clock();
      entry.result = result ?? null;
      if (Array.isArray(result?.evidence)) record.evidence.push(...result.evidence.slice(0, 20));
      if (Array.isArray(result?.artifacts)) record.artifacts.push(...result.artifacts.slice(0, 20));
      await store.update(id, structuredClone(record));
      return result;
    } catch (error) {
      entry.status = "failed";
      entry.finishedAt = clock();
      entry.error = clean(error?.message || error, 1000);
      entry.errorCode = clean(error?.code, 100);
      await store.update(id, structuredClone(record));
      throw error;
    }
  };
  const block = async (stageName, reason, evidence = []) => {
    record.blockers.push({ stage: stageName, reason: clean(reason, 1000), at: clock() });
    if (Array.isArray(evidence)) record.evidence.push(...evidence.slice(0, 20));
    await persist({ status: "blocked", stage: stageName });
    return structuredClone(record);
  };

  await store.create(structuredClone(record));
  if (typeof onCreated === "function") await onCreated(structuredClone(record));
  try {
    const research = await stage("research", requireAdapter(adapters, "research"), { request: normalized });
    if (research?.passed !== true || !Array.isArray(research.sources) || research.sources.length === 0) {
      return await block("research", "Research must pass and return at least one source.", research?.evidence);
    }

    const design = await stage("design", requireAdapter(adapters, "design"), { request: normalized, research });
    if (design?.passed !== true || !design.plan) {
      return await block("design", "Architecture/design plan was not approved.", design?.evidence);
    }

    let build = await stage("implement", requireAdapter(adapters, "implement"), { request: normalized, research, design });
    if (build?.passed !== true || !Array.isArray(build.files) || build.files.length === 0) {
      return await block("implement", "Implementation did not produce a passing candidate with source files.", build?.evidence);
    }

    let quality;
    for (;;) {
      const functional = await stage("test", requireAdapter(adapters, "test"), { request: normalized, build, research, design });
      const security = await stage("security_review", requireAdapter(adapters, "securityReview"), { request: normalized, build, functional });
      const regression = await stage("regression", requireAdapter(adapters, "regression"), { request: normalized, build, functional, security });
      quality = { functional, security, regression };
      const passed = functional?.passed === true && security?.passed === true && regression?.passed === true;
      if (passed) break;

      if (record.repairAttempts >= repairLimit) {
        return await block("repair", "Quality gates still fail after " + record.repairAttempts + " repair attempt(s).", [
          { functionalPassed: functional?.passed === true },
          { securityPassed: security?.passed === true },
          { regressionPassed: regression?.passed === true }
        ]);
      }

      record.repairAttempts += 1;
      const repaired = await stage("repair", requireAdapter(adapters, "repair"), {
        request: normalized, build, quality, attempt: record.repairAttempts,
        failedGates: [
          ...(functional?.passed === true ? [] : ["test"]),
          ...(security?.passed === true ? [] : ["security_review"]),
          ...(regression?.passed === true ? [] : ["regression"])
        ]
      });
      if (repaired?.passed !== true || !Array.isArray(repaired.files) || repaired.files.length === 0) {
        return await block("repair", "Repair agent did not return a valid replacement candidate.", repaired?.evidence);
      }
      build = repaired;
    }

    const release = await stage("release_candidate", requireAdapter(adapters, "releaseCandidate"), {
      request: normalized, build, research, design, quality
    });
    if (release?.passed !== true || !release.artifact) {
      return await block("release_candidate", "A verified release artifact was not produced.", release?.evidence);
    }

    if (!normalized.explicitDeploymentAuthorization) {
      record.artifacts.push(release.artifact);
      return await block("deploy", "Deployment requires explicit authorization; release candidate is prepared but not deployed.", release?.evidence);
    }

    record.deployment.attempted = true;
    const deployed = await stage("deploy", requireAdapter(adapters, "deploy"), {
      request: normalized, release, quality
    });
    if (deployed?.passed !== true || !deployed.deploymentId) {
      return await block("deploy", "Deployment adapter did not confirm a deployment identifier.", deployed?.evidence);
    }
    record.deployment.id = clean(deployed.deploymentId, 300);
    record.deployment.url = clean(deployed.url, 1000) || null;

    const verification = await stage("verify_deployment", requireAdapter(adapters, "verifyDeployment"), {
      request: normalized, release, deployed, quality
    });
    if (verification?.passed !== true || verification.liveTaskPassed !== true) {
      return await block("verify_deployment", "Live deployment and end-to-end task verification did not both pass.", verification?.evidence);
    }

    record.deployment.verified = true;
    record.artifacts.push(release.artifact);
    await persist({ status: "completed", stage: "completed" });
    return structuredClone(record);
  } catch (error) {
    record.blockers.push({
      stage: record.stage,
      reason: clean(error?.message || error, 1000),
      code: clean(error?.code, 100),
      at: clock()
    });
    await persist({ status: "failed" });
    throw Object.assign(error, { lifecycleId: id, lifecycleRecord: structuredClone(record) });
  }
}

module.exports = { STAGES, MAX_REPAIRS, validateRequest, runCapabilityLifecycle };
