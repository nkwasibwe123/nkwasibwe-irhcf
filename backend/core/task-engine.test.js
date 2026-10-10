"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TaskEngine, TASK_STATES, isUsableTaskResult } = require("./task-engine");
const { requestedArtifact, buildTaskArtifact } = require("./task-artifacts");

test("cancelled task is not verified, completed, or requeued after executor returns", async () => {
  let executorCalls = 0;
  let verifierCalls = 0;
  let retryHandlerCalls = 0;
  const currentTask = {
    id: "task-cancelled",
    user_id: "user-test",
    status: TASK_STATES.FAILED,
    worker_id: "worker-test",
    metadata: { cancelled: true }
  };

  const engine = new TaskEngine({
    pool: {
      async query(sql) {
        assert.match(sql, /SELECT status, worker_id/);
        return {
          rows: [{
            status: TASK_STATES.FAILED,
            worker_id: "worker-test"
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
  assert.equal(result.status, TASK_STATES.FAILED);
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
        return { rows: [] };
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
    response: { content: "A response exists." },
    agent: { responseQuality: { verified: false } }
  }), false);
  assert.equal(isUsableTaskResult({ success: true, response: { content: "Verified result." } }), true);
  assert.equal(isUsableTaskResult("   "), false);
});


test("task response string is usable output", () => {
  assert.equal(isUsableTaskResult({ success: true, response: "The task produced a real result." }), true);
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
