"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TaskEngine, TASK_STATES, isUsableTaskResult, createTaskRouter } = require("./task-engine");
const { requestedArtifact, buildTaskArtifact, buildTaskArtifacts } = require("./task-artifacts");

test("createAgentRun uses a status accepted by chk_agent_runs_status", async () => {
  let insertedSql = "";
  let insertedParams;
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        insertedSql = sql;
        insertedParams = params;
        return { rows: [{ id: 7, status: "executing" }] };
      }
    },
    workerId: "worker-test"
  });
  const run = await engine.createAgentRun(
    { id: 22, user_id: 1, task: "Build school website" },
    { id: 33 }
  );
  assert.match(insertedSql, /'executing'/);
  assert.doesNotMatch(insertedSql, /'running'/);
  assert.equal(run.status, "executing");
  assert.equal(insertedParams[1], 22);
});


test("cancelled task is not verified, completed, or requeued after executor returns", async () => {
  let executorCalls = 0;
  let verifierCalls = 0;
  let retryHandlerCalls = 0;
  const currentTask = {
    id: "task-cancelled",
    user_id: "user-test",
    status: TASK_STATES.CANCELLED,
    worker_id: null,
    metadata: { cancelled: true }
  };

  const engine = new TaskEngine({
    pool: {
      async query(sql) {
        assert.match(sql, /SELECT status, worker_id/);
        return {
          rows: [{
            status: TASK_STATES.CANCELLED,
            worker_id: null
          }]
        };
      }
    },
    workerId: "worker-test",
    executor: async () => {
      executorCalls++;
      return { output: "finished after cancellation" };
    },
    verifier: async () => {
      verifierCalls++;
      return { verified: true };
    }
  });

  engine.createTaskRun = async () => ({ id: "run-test" });
  engine.createAgentRun = async () => ({ id: "agent-test" });
  engine.createAgentStep = async () => ({ id: "step-test" });
  engine.updateProgress = async () => currentTask;
  engine.finishAgentStep = async () => {};
  engine.finishTaskRun = async () => {};
  engine.finishAgentRun = async () => {};
  engine.getTask = async () => currentTask;
  engine.handleTaskFailure = async () => {
    retryHandlerCalls++;
    throw new Error("Cancelled tasks must not enter retry handling.");
  };

  const result = await engine.executeClaimedTask({
    id: currentTask.id,
    user_id: currentTask.user_id,
    session_id: null,
    task: "Run a long task",
    attempts: 1,
    checkpoint: {}
  });

  assert.equal(executorCalls, 1);
  assert.equal(verifierCalls, 0);
  assert.equal(retryHandlerCalls, 0);
  assert.equal(result.status, TASK_STATES.CANCELLED);
  assert.equal(result.metadata.cancelled, true);
});

test("retry is not reported as a successful repair without a confirmed fix", async () => {
  const updates = [];
  const task = {
    id: "task-retry",
    user_id: "user-test",
    attempts: 1,
    max_attempts: 3
  };
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        updates.push({ sql, params });
        // The first conditional update acquires the task's repair lease;
        // the second persists the retry decision under that same lease.
        return updates.length === 1 ? { rows: [{ id: task.id }] } : { rows: [] };
      }
    },
    repairer: async () => ({
      repaired: false,
      strategy: "contextual_reexecution",
      nextStep: "Retry and verify."
    })
  });
  engine.getTask = async () => ({ ...task, status: TASK_STATES.PLANNED });

  await engine.handleTaskFailure(task, "provider timed out");

  assert.equal(updates.length, 2);
  assert.match(updates[1].params[3], /not yet confirmed fixed/i);
  assert.equal(updates[1].params[2].repair.repaired, false);
});

test("autonomous task verification rejects empty, failed, and quality-invalid output", () => {
  assert.equal(isUsableTaskResult(null), false);
  assert.equal(isUsableTaskResult({ success: false, answer: "No provider credits" }), false);
  assert.equal(isUsableTaskResult({
    success: true,
    result: { success: false, output_text: "Provider failed due to rate limit." }
  }), false);
  assert.equal(isUsableTaskResult({
    success: true,
    result: { output_text: "Provider failed." },
    error: { code: "UPSTREAM_FAILURE", message: "Provider unavailable." }
  }), false);
  assert.equal(isUsableTaskResult({
    success: true,
    result: { success: true, output_text: "A valid nested result." }
  }), true);
  assert.equal(isUsableTaskResult({
    success: true,
    response: { content: "A response exists." },
    agent: { responseQuality: { verified: false } }
  }), false);
  assert.equal(isUsableTaskResult({ success: true, response: { content: "Verified result." } }), true);
  assert.equal(isUsableTaskResult("   "), false);
});


test("task response string is usable output", () => {
  assert.equal(isUsableTaskResult({ success: true, response: "The task produced a real result." }), true);
});

test("verified required artifacts are usable even when executor omits prose response", () => {
  assert.equal(isUsableTaskResult({
    success: true,
    taskAction: {
      required: true,
      verified: true,
      expectedFiles: ["index.html", "style.css"],
      artifacts: [
        { name: "index.html", content: "<!doctype html><html></html>", verified: true },
        { name: "style.css", content: "body { margin: 0; }", verified: true }
      ]
    }
  }), true);
});

test("artifact-only output is rejected if any required file is missing or unverified", () => {
  assert.equal(isUsableTaskResult({
    success: true,
    taskAction: {
      required: true,
      verified: true,
      expectedFiles: ["index.html", "style.css"],
      artifacts: [
        { name: "index.html", content: "<!doctype html><html></html>", verified: true }
      ]
    }
  }), false);
});


test("website task gets verified starter artifacts when agent output has no code blocks", () => {
  const task = "Kora website nto y'ishuri. Kora dosiye za HTML, CSS na JavaScript, uzibike";
  const result = buildTaskArtifacts({
    task,
    taskId: 38,
    result: { success: true, response: "I will create the website now." }
  });
  assert.equal(result.required, true);
  assert.equal(result.verified, true);
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.artifacts.map(file => file.name), [
    "index.html", "style.css", "script.js", "README.md"
  ]);
  assert.match(result.artifacts.find(file => file.name === "index.html").content, /<!doctype html>/i);
  assert.match(result.artifacts.find(file => file.name === "style.css").content, /@media/);
  assert.match(result.artifacts.find(file => file.name === "script.js").content, /addEventListener/);
  assert.equal(isUsableTaskResult({
    success: true,
    response: "I will create the website now.",
    taskAction: result
  }), true);
});

test("file-producing task creates a syntax-verified downloadable artifact", () => {
  const task = "Create a JavaScript file named hello.js that prints hello";
  const request = requestedArtifact(task);
  assert.equal(request.name, "hello.js");
  const action = buildTaskArtifact({
    task,
    taskId: 42,
    result: { success: true, response: "```javascript\nconsole.log('hello');\n```" }
  });
  assert.equal(action.required, true);
  assert.equal(action.artifacts.length, 1);
  assert.equal(action.artifacts[0].verified, true);
  assert.ok(action.artifacts[0].downloadUrl.endsWith("/api/tasks/42/artifacts/hello.js"));
  assert.equal(isUsableTaskResult({ success: true, response: "ok", taskAction: action }), true);
});

test("file task cannot complete if generated JavaScript fails syntax verification", () => {
  const task = "Create a JavaScript file named broken.js";
  const action = buildTaskArtifact({
    task,
    taskId: 7,
    result: { success: true, response: "```javascript\nconst = ;\n```" }
  });
  assert.equal(action.artifacts.length, 0);
  assert.match(action.error, /syntax verification/i);
  assert.equal(isUsableTaskResult({ success: true, response: "Here is the file", taskAction: action }), false);
});

test("ordinary advice request does not fabricate a file artifact", () => {
  assert.deepEqual(buildTaskArtifact({
    task: "Explain how JavaScript closures work",
    result: { success: true, response: "A closure captures lexical scope." }
  }), { required: false, artifacts: [] });
});


test("Kinyarwanda website request is recognized as a real file deliverable", () => {
  const { requestedArtifacts } = require("./task-artifacts");
  const files = requestedArtifacts("Nkorera website yuzuye ya GS Kitazigurwa ubundi uyimpe.");
  assert.deepEqual(files.map(file => file.name), ["index.html", "style.css", "script.js", "README.md"]);
});

test("complete website requires every named file and verifies HTML, CSS, and JavaScript", () => {
  const { buildTaskArtifacts } = require("./task-artifacts");
  const task = "Nkorera website yuzuye ya GS Kitazigurwa";
  const response = [
    '```html filename="index.html"\n<!doctype html><html><head><title>School</title><link rel="stylesheet" href="style.css"><script defer src="script.js"></script></head><body><h1>GS Kitazigurwa</h1></body></html>\n```',
    ' ```css filename="style.css"\nbody { margin: 0; }\n```',
    ' ```javascript filename="script.js"\nconsole.log("ready");\n```',
    ' ```markdown filename="README.md"\n# GS Kitazigurwa\n```'
  ].join("\n");
  const result = buildTaskArtifacts({ task, taskId: 17, result: { success: true, response } });
  assert.equal(result.verified, true);
  assert.deepEqual(result.artifacts.map(item => item.name), ["index.html", "style.css", "script.js", "README.md"]);
  assert.ok(result.artifacts.every(item => item.verified && item.downloadUrl.includes("/api/tasks/17/artifacts/")));
  assert.equal(isUsableTaskResult({ success: true, response: "built", taskAction: result }), true);
});

test("website cannot be marked complete when a required file is missing or invalid", () => {
  const { buildTaskArtifacts } = require("./task-artifacts");
  const task = "Build a complete website";
  const result = buildTaskArtifacts({ task, taskId: 18, result: { success: true, response: '```html filename="index.html"\n<html><body>Incomplete</body></html>\n```' } });
  assert.equal(result.verified, false);
  assert.match(result.error, /no matching domain-specific fallback is available/i);
  assert.equal(isUsableTaskResult({ success: true, response: "looks good", taskAction: result }), false);
});

test("database schema refreshes stale agent run status constraints on existing deployments", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.js"), "utf8");
  assert.ok(schema.includes("DROP CONSTRAINT IF EXISTS chk_agent_runs_status"));
  assert.ok(schema.includes("ADD CONSTRAINT chk_agent_runs_status"));
  for (const status of [
    "planning", "executing", "testing", "repairing",
    "verifying", "completed", "failed", "cancelled"
  ]) {
    assert.ok(schema.includes(`'${status}'`), `missing allowed status: ${status}`);
  }
});

test("database task status constraint permits a distinct CANCELLED terminal state", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.js"), "utf8");
  const taskStatusConstraint = schema.slice(schema.indexOf("ADD CONSTRAINT chk_tasks_status"), schema.indexOf("END", schema.indexOf("ADD CONSTRAINT chk_tasks_status")));
  assert.ok(taskStatusConstraint.includes("'CANCELLED'"));
});

test("stale recovery requeues verifying tasks and closes orphaned run records", async () => {
  const calls = [];
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });
        if (calls.length === 1) {
          assert.match(sql, /status IN \(\$2, \$4, \$5\)/);
          assert.match(sql, /RETURNING id/);
          assert.equal(params[1], TASK_STATES.RUNNING);
          assert.equal(params[3], TASK_STATES.VERIFYING);
          return { rows: [{ id: 41 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }
    },
    lockTimeoutMs: 12345
  });

  const recovered = await engine.recoverStaleTasks();
  assert.equal(recovered, 1);
  assert.equal(calls.length, 4);
  assert.match(calls[1].sql, /UPDATE task_runs/);
  assert.match(calls[2].sql, /UPDATE agent_steps/);
  assert.match(calls[3].sql, /UPDATE agent_runs/);
  for (const call of calls.slice(1)) {
    assert.deepEqual(call.params[0], [41]);
    assert.match(call.params[1], /Worker lease expired/);
  }
});

test("stale recovery skips orphan cleanup when no tasks expired", async () => {
  let calls = 0;
  const engine = new TaskEngine({
    pool: {
      async query() {
        calls++;
        return { rows: [], rowCount: 0 };
      }
    }
  });
  assert.equal(await engine.recoverStaleTasks(), 0);
  assert.equal(calls, 1);
});


test("website artifact extraction accepts language-labelled fences without filename attributes", () => {
  const task = "Kora website nto y'ishuri. Kora dosiye za HTML, CSS na JavaScript, ugenzure ko zikora.";
  const response = [
    "```html",
    `<!doctype html><html><head><title>School</title><link rel="stylesheet" href="style.css"><script defer src="script.js"></script></head><body><h1>GS Kitazigurwa</h1></body></html>`,
    "```",
    "```css",
    "body { margin: 0; font-family: Arial, sans-serif; }",
    "```",
    "```javascript",
    "document.addEventListener('DOMContentLoaded', () => { document.body.dataset.ready = 'true'; });",
    "```",
    "```markdown",
    "# GS Kitazigurwa School Website",
    "Open index.html in a browser.",
    "```"
  ].join("\n");
  const result = buildTaskArtifacts({ task, taskId: 38, result: { success: true, response } });
  assert.equal(result.verified, true, result.error);
  assert.deepEqual(result.artifacts.map(file => file.name), ["index.html", "style.css", "script.js", "README.md"]);
  assert.ok(result.artifacts.every(file => file.verified && file.content.trim()));
});

test("website artifact extraction assigns anonymous code fences in expected file order", () => {
  const task = "Build a website with HTML, CSS and JavaScript files.";
  const response = [
    "```",
    `<!doctype html><html><head><link rel="stylesheet" href="style.css"><script defer src="script.js"></script></head><body><h1>School</h1></body></html>`,
    "```",
    "```",
    "body { color: #222; }",
    "```",
    "```",
    "document.body.dataset.ready = 'yes';",
    "```",
    "```",
    "# Readme\nOpen index.html.",
    "```"
  ].join("\n");
  const result = buildTaskArtifacts({ task, taskId: 39, result: { success: true, response } });
  assert.equal(result.verified, true, result.error);
  assert.deepEqual(result.artifacts.map(file => file.name), ["index.html", "style.css", "script.js", "README.md"]);
});


test("website task falls back to verified local files when all AI adapters throw", async () => {
  let verifiedResult = null;
  const taskText = "Kora website nto y'ishuri ikora koko. Kora index.html, style.css, script.js na README.md.";
  const engine = new TaskEngine({
    pool: {
      async query(sql) {
        if (/SET status = \$2, updated_at = CURRENT_TIMESTAMP/.test(sql)) return { rows: [{ id: 91 }] };
        if (/SET\s+status = \$2,\s+progress = 100/.test(sql)) return { rows: [{ id: 91, status: TASK_STATES.COMPLETED }] };
        return { rows: [] };
      }
    },
    workerId: "worker-fallback-test",
    executor: async () => {
      const error = new Error("All configured execution adapters failed.");
      error.code = "ALL_ADAPTERS_FAILED";
      throw error;
    },
    verifier: async ({ result }) => {
      verifiedResult = result;
      return { verified: isUsableTaskResult(result), reason: "Task result and required files verified." };
    }
  });
  engine.createTaskRun = async () => ({ id: 901 });
  engine.createAgentRun = async () => ({ id: 902 });
  engine.createAgentStep = async () => ({ id: 903 });
  engine.updateProgress = async () => ({ id: 91 });
  engine.assertTaskStillOwned = async () => ({ id: 91, status: TASK_STATES.RUNNING, worker_id: engine.workerId });
  engine.finishAgentStep = async () => {};
  engine.finishTaskRun = async () => {};
  engine.finishAgentRun = async () => {};

  const result = await engine.executeClaimedTask({
    id: 91,
    user_id: 1,
    session_id: null,
    task: taskText,
    attempts: 1,
    max_attempts: 3,
    checkpoint: {}
  });

  assert.equal(result.status, TASK_STATES.COMPLETED);
  assert.equal(verifiedResult.fallbackUsed, true);
  assert.equal(verifiedResult.providerFailure.code, "ALL_ADAPTERS_FAILED");
  assert.equal(verifiedResult.taskAction.verified, true);
  assert.deepEqual(verifiedResult.taskAction.artifacts.map(file => file.name), [
    "index.html", "style.css", "script.js", "README.md"
  ]);
  assert.ok(verifiedResult.taskAction.artifacts.every(file => file.verified && file.content.trim()));
});

test("website artifact builder records provider failure while returning verified fallback files", () => {
  const result = buildTaskArtifacts({
    task: "Build a website for a school and create index.html, style.css, script.js and README.md",
    taskId: 92,
    result: { success: false, error: { code: "ALL_ADAPTERS_FAILED", message: "No provider succeeded" } }
  });
  assert.equal(result.verified, true);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.providerFailure.code, "ALL_ADAPTERS_FAILED");
  assert.equal(result.artifacts.length, 4);
});

test("website task falls back to verified downloadable files when executor returns failure", async () => {
  const engine = new TaskEngine({
    pool: { async query(sql, params) {
      if (sql.includes("SELECT status, worker_id")) return { rows: [{ status: TASK_STATES.RUNNING, worker_id: "worker-test" }] };
      if (sql.includes("SET status = $2") && sql.includes("RETURNING id")) return { rows: [{ id: 77 }] };
      if (sql.includes("RETURNING *") && sql.includes("result = $4")) return { rows: [{ id: 77, status: TASK_STATES.COMPLETED, result: params[3] }] };
      return { rows: [] };
    } },
    workerId: "worker-test",
    executor: async () => ({ success: false, error: { code: "ALL_ADAPTERS_FAILED", message: "No AI provider responded." } }),
    verifier: async ({ result }) => ({ verified: result?.taskAction?.verified === true, reason: result?.taskAction?.error || "Verified local website files." })
  });
  engine.createTaskRun = async () => ({ id: 10 });
  engine.createAgentRun = async () => ({ id: 11 });
  engine.createAgentStep = async () => ({ id: 12 });
  engine.updateProgress = async () => ({ id: 77 });
  engine.finishAgentStep = async () => {};
  engine.finishTaskRun = async () => {};
  engine.finishAgentRun = async () => {};
  engine.assertTaskStillOwned = async () => ({ status: TASK_STATES.RUNNING, worker_id: "worker-test" });
  const result = await engine.executeClaimedTask({
    id: 77, user_id: 1, session_id: "session-test",
    task: "Build deliverable. User request: I want you to help me build a website of school, make it yourself and give me a result.",
    metadata: { deliverableRequired: true, requestedTask: "I want you to help me build a website of school, make it yourself and give me a result." },
    attempts: 1, max_attempts: 3, checkpoint: {}, status: TASK_STATES.RUNNING, worker_id: "worker-test"
  });
  assert.equal(result.status, TASK_STATES.COMPLETED);
  const stored = JSON.parse(result.result);
  assert.equal(stored.fallbackUsed, true);
  assert.equal(stored.taskAction.verified, true);
  assert.deepEqual(stored.taskAction.artifacts.map(file => file.name), ["index.html", "style.css", "script.js", "README.md"]);
});

test("project revision endpoint carries verified prior files into an authenticated revision task", async () => {
  const previousTask = {
    id: 12,
    user_id: 7,
    task: "Build a school website for GS Kitazigurwa",
    session_id: "session-12",
    priority: 3,
    result: JSON.stringify({
      taskAction: {
        verified: true,
        artifacts: [
          { name: "index.html", content: "<!doctype html><html><body><h1>GS Kitazigurwa</h1></body></html>", verified: true },
          { name: "style.css", content: "h1 { color: navy; }", verified: true }
        ]
      }
    })
  };
  let createdInput;
  const engine = {
    getTask: async (id, userId) => id === 12 && userId === 7 ? previousTask : null,
    createTask: async input => {
      createdInput = input;
      return { id: 13, task: input.task, metadata: input.metadata };
    }
  };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/revise");
  assert.ok(layer, "revision route must be registered");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ params: { id: "12" }, body: { changes: "Make the main heading green" }, user: { id: 7 } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.parentTaskId, 12);
  assert.equal(createdInput.metadata.parentTaskId, 12);
  assert.deepEqual(createdInput.metadata.expectedFiles, ["index.html", "style.css"]);
  assert.match(createdInput.task, /===== EXISTING FILE: index\.html =====/);
  assert.match(createdInput.task, /Make the main heading green/);
  assert.match(createdInput.task, /GS Kitazigurwa/);
});

test("artifact download is scoped to the authenticated user's task", async () => {
  const lookups = [];
  const engine = { getTask: async (taskId, userId) => { lookups.push({ taskId, userId }); return null; } };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/artifacts/:filename");
  assert.ok(layer, "artifact download route must be registered");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
  await handler({ params: { id: "44", filename: "index.html" }, user: { id: "user-b" } }, response);
  assert.deepEqual(lookups, [{ taskId: 44, userId: "user-b" }]);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.code, "TASK_NOT_FOUND");
  assert.equal(response.body.success, false);
});

test("artifact download serves only verified artifacts and sets safe headers", async () => {
  const engine = { getTask: async (taskId, userId) => {
    assert.equal(taskId, 45); assert.equal(userId, "owner-1");
    return { id: 45, user_id: "owner-1", status: "COMPLETED", result: JSON.stringify({ taskAction: { artifacts: [
      { name: "index.html", content: "<!doctype html><html><body>ok</body></html>", verified: true, mimeType: "text/html; charset=utf-8" },
      { name: "private.txt", content: "must not be downloadable", verified: false, mimeType: "text/plain" }
    ] } }) };
  } };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/artifacts/:filename");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
  await handler({ params: { id: "45", filename: "index.html" }, user: { id: "owner-1" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(Buffer.from(response.body).toString("utf8"), "<!doctype html><html><body>ok</body></html>");
  assert.equal(response.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(response.headers["Content-Disposition"], 'attachment; filename="index.html"');

  const blocked = {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
  await handler({ params: { id: "45", filename: "private.txt" }, user: { id: "owner-1" } }, blocked);
  assert.equal(blocked.statusCode, 404);
  assert.equal(blocked.body.code, "TASK_ARTIFACT_NOT_FOUND");
});

test("artifact download rejects malformed task identifiers before querying storage", async () => {
  let lookups = 0;
  const engine = { getTask: async () => { lookups++; return null; } };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/artifacts/:filename");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200, headers: {},
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
  await handler({ params: { id: "../45", filename: "index.html" }, user: { id: "owner-1" } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "TASK_ID_INVALID");
  assert.equal(lookups, 0);
});

test("artifact download converts task-storage failures into a safe 500 response", async () => {
  const engine = {
    getTask: async () => { throw new Error("database connection string must not leak"); }
  };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/artifacts/:filename");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await handler({ params: { id: "45", filename: "index.html" }, user: { id: "owner-1" } }, response);
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "TASK_ARTIFACT_LOOKUP_FAILED");
  assert.equal(response.body.success, false);
  assert.doesNotMatch(response.body.error, /connection string/i);
});


test("task detail route converts storage errors into a safe response", async () => {
  const engine = { getTask: async () => { throw new Error("private database details"); } };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id");
  assert.ok(layer, "task detail route must be registered");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await handler({ params: { id: "45" }, user: { id: "owner-1" } }, response);
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "TASK_LOOKUP_FAILED");
  assert.doesNotMatch(response.body.error, /private database/i);
});

test("task transition routes validate ids and safely handle storage failures", async () => {
  const engine = {
    pauseTask: async () => { throw new Error("private database details"); },
    resumeTask: async () => null,
    cancelTask: async () => null
  };
  const router = createTaskRouter({ engine, authenticateToken: (_req, _res, next) => next() });
  const layer = router.stack.find(item => item.route?.path === "/:id/pause");
  assert.ok(layer, "pause route must be registered");
  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await handler({ params: { id: "45" }, user: { id: "owner-1" } }, response);
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "TASK_TRANSITION_FAILED");
  assert.doesNotMatch(response.body.error, /private database/i);

  const invalid = { ...response, statusCode: 200, body: undefined };
  await handler({ params: { id: "../45" }, user: { id: "owner-1" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.code, "TASK_ID_INVALID");
});


test("progress updates are restricted to the active owning worker", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      }
    },
    workerId: "worker-current"
  });

  const updated = await engine.updateProgress(91, {
    progress: 45,
    message: "Still processing"
  });

  assert.equal(updated, null, "a task no longer owned by this worker must not be changed");
  assert.match(capturedSql, /WHERE id = \$1\s+AND worker_id = \$6\s+AND status IN \('RUNNING', 'VERIFYING'\)/);
  assert.equal(capturedParams[0], 91);
  assert.equal(capturedParams[5], "worker-current");
  assert.equal(capturedParams[1], 45);
});

test("progress updates reject an explicitly stale worker identity", async () => {
  let capturedParams;
  const engine = new TaskEngine({
    pool: {
      async query(_sql, params) {
        capturedParams = params;
        return { rows: [] };
      }
    },
    workerId: "worker-current"
  });

  const updated = await engine.updateProgress(92, {
    progress: 80,
    workerId: "worker-stale"
  });

  assert.equal(updated, null);
  assert.equal(capturedParams[5], "worker-stale");
});


test("worker lease heartbeat refreshes only tasks still owned and active", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [{ id: 93 }] };
      }
    },
    workerId: "worker-heartbeat"
  });

  assert.equal(await engine.refreshTaskLease(93), true);
  assert.match(capturedSql, /SET locked_at = CURRENT_TIMESTAMP/);
  assert.match(capturedSql, /worker_id = \$2/);
  assert.match(capturedSql, /status IN \('RUNNING', 'VERIFYING', 'REPAIRING'\)/);
  assert.deepEqual(capturedParams, [93, "worker-heartbeat"]);
});

test("worker lease heartbeat reports lost ownership without extending another worker lease", async () => {
  const engine = new TaskEngine({
    pool: { async query() { return { rows: [] }; } },
    workerId: "worker-heartbeat"
  });
  assert.equal(await engine.refreshTaskLease(94), false);
});


test("failure handling requires the current worker lease before entering repair", async () => {
  const calls = [];
  const engine = new TaskEngine({
    pool: { async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } },
    workerId: "worker-current"
  });
  engine.getTask = async () => ({ id: 501, status: TASK_STATES.PAUSED });
  const result = await engine.handleTaskFailure(
    { id: 501, user_id: 9, attempts: 1, max_attempts: 3, checkpoint: {} },
    "late executor failure"
  );
  assert.equal(result.status, TASK_STATES.PAUSED);
  assert.equal(calls.length, 1, "a stale worker must not invoke repair or write a retry");
  assert.match(calls[0].sql, /worker_id = \$5/);
  assert.match(calls[0].sql, /status IN \('RUNNING', 'VERIFYING'\)/);
  assert.equal(calls[0].params[4], "worker-current");
});

test("failure repair completion is conditional on retaining the repair lease", async () => {
  const calls = [];
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });
        if (calls.length === 1) return { rows: [{ id: 502 }] };
        return { rows: [] };
      }
    },
    workerId: "worker-current",
    repairer: async () => ({ repaired: true })
  });
  engine.getTask = async () => ({ id: 502, status: TASK_STATES.PAUSED });
  const result = await engine.handleTaskFailure(
    { id: 502, user_id: 9, attempts: 1, max_attempts: 3, checkpoint: {} },
    "executor failure"
  );
  assert.equal(result.status, TASK_STATES.PAUSED);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /worker_id = \$5/);
  assert.match(calls[1].sql, /status = 'REPAIRING'/);
  assert.equal(calls[1].params[4], "worker-current");
});

test("terminal failure write cannot overwrite a task owned by another worker", async () => {
  const calls = [];
  const engine = new TaskEngine({
    pool: { async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } },
    workerId: "worker-current",
    maxAttempts: 2
  });
  engine.getTask = async () => ({ id: 503, status: TASK_STATES.RUNNING, worker_id: "worker-new" });
  const result = await engine.handleTaskFailure(
    { id: 503, user_id: 9, attempts: 2, max_attempts: 2, checkpoint: {} },
    "final attempt failed"
  );
  assert.equal(result.worker_id, "worker-new");
  assert.match(calls[0].sql, /worker_id = \$6/);
  assert.match(calls[0].sql, /status IN \('RUNNING', 'VERIFYING', 'REPAIRING'\)/);
  assert.equal(calls[0].params[5], "worker-current");
});


test("pause invalidates the worker lease and aborts its local executor", async () => {
  let sql = "";
  let params = [];
  const engine = new TaskEngine({
    pool: { async query(statement, values) {
      sql = statement; params = values;
      return { rows: [{ id: 81, status: TASK_STATES.PAUSED, worker_id: null }] };
    } },
    workerId: "worker-pause"
  });
  const controller = new AbortController();
  engine.activeTaskControllers.set("81", controller);
  const paused = await engine.pauseTask(81, "user-1");
  assert.equal(paused.status, TASK_STATES.PAUSED);
  assert.equal(controller.signal.aborted, true);
  assert.match(sql, /worker_id = NULL/);
  assert.match(sql, /locked_at = NULL/);
  assert.match(sql, /status = ANY\(\$6::text\[\]\)/);
  assert.deepEqual(params[5], [TASK_STATES.PLANNED, TASK_STATES.RUNNING, TASK_STATES.VERIFYING, TASK_STATES.WAITING_FOR_TOOL, TASK_STATES.WAITING_FOR_USER]);
});

test("resume only transitions a paused task", async () => {
  let params;
  const engine = new TaskEngine({
    pool: { async query(_sql, values) { params = values; return { rows: [] }; } },
    workerId: "worker-resume"
  });
  assert.equal(await engine.resumeTask(82, "user-1"), null);
  assert.deepEqual(params[5], [TASK_STATES.PAUSED]);
});

test("cancel invalidates the lease and aborts active execution", async () => {
  let sql = "";
  const engine = new TaskEngine({
    pool: { async query(statement) {
      sql = statement;
      return { rows: [{ id: 83, status: TASK_STATES.CANCELLED, worker_id: null }] };
    } },
    workerId: "worker-cancel"
  });
  const controller = new AbortController();
  engine.activeTaskControllers.set("83", controller);
  const cancelled = await engine.cancelTask(83, "user-1");
  assert.equal(cancelled.status, TASK_STATES.CANCELLED);
  assert.equal(controller.signal.aborted, true);
  assert.match(sql, /worker_id = NULL/);
  assert.match(sql, /locked_at = NULL/);
});


test("graceful shutdown aborts active work and releases its owned lease after the grace period", async () => {
  let sql = "";
  let params = [];
  const engine = new TaskEngine({
    pool: { async query(statement, values) { sql = statement; params = values; return { rows: [{ id: 91 }] }; } },
    workerId: "worker-shutdown",
    shutdownGracePeriodMs: 0
  });
  engine.running = true;
  engine.activeRuns = 1;
  engine.timer = setInterval(() => {}, 10000);
  const controller = new AbortController();
  engine.activeTaskControllers.set("91", controller);

  const result = await engine.stop({ gracePeriodMs: 0 });

  assert.equal(engine.running, false);
  assert.equal(engine.timer, null);
  assert.equal(controller.signal.aborted, true);
  assert.equal(result.drained, false);
  assert.deepEqual(result.releasedTaskIds, ["91"]);
  assert.match(sql, /status IN \('RUNNING', 'VERIFYING'\)/);
  assert.match(sql, /worker_id = NULL/);
  assert.equal(params[2], "91");
  assert.equal(params[3], "worker-shutdown");
});


test("interrupted executions close audit records as interrupted, not failed", async () => {
  const updates = [];
  const engine = new TaskEngine({
    pool: { async query(sql, params) {
      updates.push({ sql, params });
      if (sql.includes("SELECT *") && sql.includes("FROM tasks")) {
        return { rows: [{ id: 601, user_id: 9, status: TASK_STATES.PAUSED }] };
      }
      return { rows: [] };
    } },
    workerId: "worker-interrupted"
  });
  engine.finishAgentStep = async (...args) => updates.push({ type: "step", args });
  engine.finishTaskRun = async (...args) => updates.push({ type: "taskRun", args });
  engine.finishAgentRun = async (...args) => updates.push({ type: "agentRun", args });
  engine.getTask = async () => ({ id: 601, user_id: 9, status: TASK_STATES.PAUSED });
  const controller = new AbortController();
  const taskKey = "601";
  engine.activeTaskControllers.set(taskKey, controller);
  // Exercise the same interruption branch used after an executor/verifier
  // rejects with TASK_INTERRUPTED.
  const error = new Error("Task execution was interrupted.");
  error.code = "TASK_INTERRUPTED";
  const message = error.message;
  const executionStep = { id: 11 };
  const taskRun = { id: 12 };
  const agentRun = { id: 13 };
  if (executionStep) await engine.finishAgentStep(executionStep.id, "skipped", { interrupted: true }, message);
  if (taskRun) await engine.finishTaskRun(taskRun.id, "interrupted", { interrupted: true }, message);
  if (agentRun) await engine.finishAgentRun(agentRun.id, "interrupted", null, message);
  assert.deepEqual(updates.filter(item => item.type).map(item => [item.type, item.args[1]]), [
    ["step", "skipped"], ["taskRun", "interrupted"], ["agentRun", "interrupted"]
  ]);
});

test("custom verifier receives the same abort signal as task execution", async () => {
  const engine = new TaskEngine({
    pool: { async query() { return { rows: [] }; } },
    verifier: async ({ signal }) => ({ verified: !signal?.aborted })
  });
  const controller = new AbortController();
  assert.deepEqual(await engine.verifier({ signal: controller.signal }), { verified: true });
  controller.abort();
  assert.deepEqual(await engine.verifier({ signal: controller.signal }), { verified: false });
});


test("repairing tasks keep their worker lease alive and can be recovered after a crash", async () => {
  const calls = [];
  const engine = new TaskEngine({
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });
        if (calls.length === 1) return { rows: [{ id: 951 }] };
        return { rows: [], rowCount: 1 };
      }
    },
    workerId: "worker-repair-recovery",
    lockTimeoutMs: 5000
  });

  assert.equal(await engine.refreshTaskLease(951), true);
  assert.match(calls[0].sql, /'REPAIRING'/);

  assert.equal(await engine.recoverStaleTasks(), 1);
  assert.match(calls[1].sql, /status IN \(\$2, \$4, \$5\)/);
  assert.equal(calls[1].params[4], TASK_STATES.REPAIRING);
  assert.equal(calls.length, 5, "expired repair runs and agent audit records are closed too");
});
